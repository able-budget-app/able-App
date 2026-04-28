#!/usr/bin/env python3
"""
Marketing footage recorder for Able.

Drives the demo seed (?demo=1) at iPhone 14 Pro vertical (390x844), records
each clip with Playwright (WebM), then transcodes to MP4 H.264 1080x1920 30fps
with a silent AAC track. Emits manifest.json with key-moment timestamps.

Run:  python3 scripts/record-clips.py
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable

from playwright.async_api import (  # type: ignore
    Page,
    Playwright,
    async_playwright,
)

# ──────────────────────────────────────────────────────────────────────────
# Paths and config
# ──────────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "marketing-footage"
RAW_DIR = OUT_DIR / "_raw"
PORT = 8765
APP_URL = f"http://localhost:{PORT}/app.html?demo=1"

VIEWPORT = {"width": 390, "height": 844}
RECORD_FPS = 30          # final mp4 framerate
TARGET_W, TARGET_H = 1080, 1920  # final mp4 size (3x upscale of viewport)

# ──────────────────────────────────────────────────────────────────────────
# Cursor + easing
# ──────────────────────────────────────────────────────────────────────────
# Inject a visible cursor so screen recordings show pointer motion.
# Called via page.evaluate AFTER load — init scripts run too early to attach
# reliably (documentElement is sometimes absent and the cursor element gets
# stomped during HTML parsing).
CURSOR_SETUP = r"""
() => {
  if (document.getElementById('__demo_cursor')) return 'already-attached';
  const c = document.createElement('div');
  c.id = '__demo_cursor';
  c.style.cssText = [
    'position: fixed',
    'top: 50%', 'left: 50%',
    'width: 22px', 'height: 22px',
    'border-radius: 50%',
    'background: rgba(20,20,20,0.9)',
    'border: 2.5px solid white',
    'box-shadow: 0 4px 14px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.15)',
    'pointer-events: none',
    'z-index: 2147483647',
    'transform: translate(-50%, -50%)',
    'transition: transform 0.08s ease-out, background 0.1s'
  ].join(';');
  document.body.appendChild(c);
  // Refresh on mousemove. We use capture: true so the cursor tracks even
  // when the underlying DOM swallows the event (rare; mostly defensive).
  window.addEventListener('mousemove', (e) => {
    c.style.left = e.clientX + 'px';
    c.style.top  = e.clientY + 'px';
  }, { passive: true, capture: true });
  window.addEventListener('mousedown', () => {
    c.style.transform = 'translate(-50%, -50%) scale(0.65)';
    c.style.background = 'rgba(42,122,74,0.95)';
  }, { passive: true, capture: true });
  window.addEventListener('mouseup', () => {
    c.style.transform = 'translate(-50%, -50%) scale(1)';
    c.style.background = 'rgba(20,20,20,0.9)';
  }, { passive: true, capture: true });
  return 'attached';
}
"""


def ease_in_out_cubic(t: float) -> float:
    if t < 0.5:
        return 4 * t * t * t
    return 1 - pow(-2 * t + 2, 3) / 2


@dataclass
class CursorState:
    x: float = 195.0  # viewport center-ish for opening pose
    y: float = 750.0


async def ease_move(page: Page, st: CursorState, x: float, y: float, ms: int = 700) -> None:
    """Move the cursor with a cubic ease-in-out over `ms` milliseconds."""
    steps = max(2, ms // 16)
    x0, y0 = st.x, st.y
    per_step = ms / steps
    for i in range(1, steps + 1):
        t = i / steps
        e = ease_in_out_cubic(t)
        nx = x0 + (x - x0) * e
        ny = y0 + (y - y0) * e
        await page.mouse.move(nx, ny)
        await page.wait_for_timeout(per_step)
    st.x, st.y = x, y


async def click_el(page: Page, st: CursorState, selector: str, ms: int = 700, hold: int = 120) -> tuple[float, float]:
    """Move smoothly to an element, click, return its center coords.

    Uses real Playwright click() under the hood (after the easing motion) so
    inline onclick handlers fire reliably even when the visible cursor lags
    behind the synthesized mousedown.
    """
    loc = page.locator(selector).first
    box = await loc.bounding_box()
    if not box:
        raise RuntimeError(f"no bounding box for {selector!r}")
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2
    await ease_move(page, st, cx, cy, ms)
    await page.wait_for_timeout(80)
    # Use Locator.click() — handles the press/release reliably and respects
    # the real DOM event semantics. We pass a `force=False` (default) so any
    # actionability checks still run.
    await loc.click(delay=hold)
    return cx, cy


async def slow_type(page: Page, text: str, per_char_ms: int = 110) -> None:
    await page.keyboard.type(text, delay=per_char_ms)


async def beat(page: Page, ms: int = 500) -> None:
    """Default inter-action pause."""
    await page.wait_for_timeout(ms)


# ──────────────────────────────────────────────────────────────────────────
# Clip framework
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class Clip:
    slug: str
    target_seconds: float
    record: Callable[..., Awaitable[dict]]


@dataclass
class Marker:
    name: str
    seconds: float


@dataclass
class ClipResult:
    slug: str
    mp4: Path
    duration: float
    markers: list[Marker] = field(default_factory=list)
    captions: list[dict] = field(default_factory=list)


class TimestampLogger:
    def __init__(self) -> None:
        self.t0 = time.monotonic()
        self.markers: list[Marker] = []
        self.captions: list[dict] = []

    def reset(self) -> None:
        self.t0 = time.monotonic()
        self.markers = []
        self.captions = []

    def _now(self) -> float:
        return round(time.monotonic() - self.t0, 3)

    def mark(self, name: str) -> None:
        self.markers.append(Marker(name=name, seconds=self._now()))

    def cap_open(self, text: str) -> None:
        # Auto-close any hanging caption so consecutive cap_open calls work
        # like a tape: the previous caption ends exactly where the next begins.
        if self.captions and self.captions[-1].get("end") is None:
            self.captions[-1]["end"] = self._now()
        self.captions.append({"start": self._now(), "end": None, "text": text})

    def cap_close(self) -> None:
        if self.captions and self.captions[-1].get("end") is None:
            self.captions[-1]["end"] = self._now()

    def to_list(self) -> list[dict]:
        return [{"name": m.name, "seconds": m.seconds} for m in self.markers]

    def to_caption_list(self) -> list[dict]:
        return [c for c in self.captions if c.get("end") is not None]


# ──────────────────────────────────────────────────────────────────────────
# Per-clip recordings
# ──────────────────────────────────────────────────────────────────────────
async def record_clip_1_deposit(page: Page, ts: TimestampLogger) -> dict:
    """deposit-allocation.mp4 — log $3,000, watch allocation, end on home."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 800)

    # Tap "Log income →" CTA in the hero card.
    await click_el(page, st, ".db-hero-cta", ms=700)
    ts.mark("allocate_sheet_opened")
    await beat(page, 800)

    # Type amount slowly.
    await page.locator("#inc-amount").click()
    await beat(page, 300)
    await slow_type(page, "3000", per_char_ms=180)
    ts.mark("amount_entered")
    await beat(page, 500)

    # Pick income source via direct value set (the <select> picker on
    # mobile is OS-native and disrupts recording). The app reads .value.
    await page.locator("#inc-source").select_option("Freelance design")
    await beat(page, 600)

    # Tap "Tell me where it goes →". This opens the alloc-preview modal,
    # but the bottom sheet's z-index sits above it; close the sheet so the
    # preview breakdown is the visible foreground.
    primary_in_sheet = "#db-allocate-sheet button.btn-primary"
    await click_el(page, st, primary_in_sheet, ms=600)
    await page.evaluate("closeAllocateSheet()")
    ts.mark("preview_open")
    # Hold on the preview so the viewer can read the breakdown
    # (tax set-aside, bills, debt, buffer, owner pay, free).
    await beat(page, 2200)

    # Tap "Confirm & log it"
    confirm_btn = '#modal-alloc-preview button.btn-primary'
    await click_el(page, st, confirm_btn, ms=600)
    ts.mark("allocation_confirmed")
    await beat(page, 1800)  # post-confirm settle + score update

    # Drift cursor up to look at the score, then idle.
    await ease_move(page, st, 195, 350, ms=800)
    ts.mark("score_visible")
    await beat(page, 2200)

    return {"markers": ts.to_list()}


async def record_clip_2_bills(page: Page, ts: TimestampLogger) -> dict:
    """bills-view.mp4 — open Bills, scroll, expand one, return."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 700)

    # Tap "Plan" tab to reveal sub-tabs.
    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=600)
    await beat(page, 500)
    # Tap "Bills" sub-tab.
    await click_el(page, st, 'button.sub-tab[data-sub="bills"]', ms=600)
    ts.mark("bills_opened")
    await beat(page, 1000)

    # Slow scroll through the bill list.
    await page.evaluate("""
        async () => {
          const container = document.querySelector('#main-scroll') || document.scrollingElement;
          const target = container.scrollHeight - container.clientHeight;
          const start = container.scrollTop;
          const distance = Math.max(0, Math.min(target - start, 380));
          const duration = 2200;
          const t0 = performance.now();
          await new Promise(resolve => {
            function step(t) {
              const p = Math.min(1, (t - t0) / duration);
              const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
              container.scrollTop = start + distance * e;
              if (p < 1) requestAnimationFrame(step);
              else resolve();
            }
            requestAnimationFrame(step);
          });
        }
    """)
    ts.mark("scroll_complete")
    await beat(page, 1800)

    # Click on the first non-debt bill row to expand its detail (rent).
    # The `bills-row` rows toggle inline detail when clicked.
    rent_row = "div.bills-row >> nth=0"
    try:
        await click_el(page, st, rent_row, ms=600)
        ts.mark("bill_expanded")
        await beat(page, 1500)
    except Exception:
        ts.mark("bill_expand_skipped")

    # Return to home.
    await click_el(page, st, 'button.nav-tab[data-group="home"]', ms=600)
    ts.mark("home_returned")
    await beat(page, 1200)
    return {"markers": ts.to_list()}


async def record_clip_3_window(page: Page, ts: TimestampLogger) -> dict:
    """rolling-window-settings.mp4 — toggle planning window 7→21→14."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)

    # More tab → Settings.
    await click_el(page, st, 'button.nav-tab[data-group="more"]', ms=550)
    await beat(page, 400)
    await click_el(page, st, 'button.sub-tab[data-sub="settings"]', ms=550)
    ts.mark("settings_opened")
    await beat(page, 700)

    # Scroll the Planning Window section into view.
    await page.evaluate("""() => {
      const tabs = document.getElementById('window-tabs');
      if (tabs) tabs.scrollIntoView({behavior:'smooth', block:'center'});
    }""")
    await beat(page, 900)
    ts.mark("window_section_visible")

    # Tap 7 days, hold.
    await click_el(page, st, 'button.window-tab[data-win="7"]', ms=600)
    ts.mark("window_set_7")
    await beat(page, 1200)

    # Tap 21 days, hold.
    await click_el(page, st, 'button.window-tab[data-win="21"]', ms=600)
    ts.mark("window_set_21")
    await beat(page, 1200)

    # Tap 14 days, hold.
    await click_el(page, st, 'button.window-tab[data-win="14"]', ms=600)
    ts.mark("window_set_14")
    await beat(page, 1400)

    # Close back to home.
    await click_el(page, st, 'button.nav-tab[data-group="home"]', ms=550)
    ts.mark("home_returned")
    await beat(page, 700)
    return {"markers": ts.to_list()}


async def record_clip_4_coach(page: Page, ts: TimestampLogger) -> dict:
    """ai-coach.mp4 — open coach panel, ask the $400 question, watch reply."""
    st = CursorState(x=320, y=780)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)

    # Tap the Coach FAB (bottom-right circular button).
    await click_el(page, st, ".coach-fab", ms=700)
    ts.mark("coach_opened")
    await beat(page, 900)

    # Focus the coach textarea, then slow-type the question.
    await page.locator("#coach-input").click()
    await beat(page, 350)
    await slow_type(
        page,
        "Can I take an extra $400 and pay down my credit card?",
        per_char_ms=55,
    )
    ts.mark("question_typed")
    await beat(page, 600)

    # Send.
    await click_el(page, st, "#coach-send", ms=600)
    ts.mark("question_sent")
    # Wait for the loading bubble to be replaced by the assistant reply
    # (our stub delays ~1.4s).
    await page.wait_for_function(
        "() => !document.querySelector('.coach-bubble.loading')",
        timeout=8000,
    )
    ts.mark("response_streamed")
    await beat(page, 1500)

    # Scroll the coach messages container so the full reply is visible.
    await page.evaluate("""() => {
      const m = document.getElementById('coach-messages');
      if (!m) return;
      const target = m.scrollHeight;
      const start = m.scrollTop;
      const t0 = performance.now();
      const dur = 1800;
      function step(t) {
        const p = Math.min(1, (t - t0) / dur);
        const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
        m.scrollTop = start + (target - start) * e;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }""")
    await beat(page, 2400)
    ts.mark("scroll_complete")

    # Hold on the final state long enough for the viewer to read the reply.
    await beat(page, 4500)
    ts.mark("hold_complete")
    return {"markers": ts.to_list()}


async def record_clip_5_walkthrough(page: Page, ts: TimestampLogger) -> dict:
    """full-walkthrough.mp4 — brisk end-to-end tour."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 700)

    # Log income $2,500.
    await click_el(page, st, ".db-hero-cta", ms=550)
    await beat(page, 500)
    await page.locator("#inc-amount").click()
    await beat(page, 200)
    await slow_type(page, "2500", per_char_ms=140)
    await beat(page, 300)
    await page.locator("#inc-source").select_option("Freelance design")
    await beat(page, 350)
    await click_el(page, st, "#db-allocate-sheet button.btn-primary", ms=500)
    await page.evaluate("closeAllocateSheet()")
    ts.mark("preview_open")
    await beat(page, 1300)
    await click_el(page, st, '#modal-alloc-preview button.btn-primary', ms=500)
    ts.mark("allocation_confirmed")
    await beat(page, 1500)

    # Bills view.
    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=500)
    await beat(page, 350)
    await click_el(page, st, 'button.sub-tab[data-sub="bills"]', ms=500)
    ts.mark("bills_opened")
    await beat(page, 1500)
    await page.evaluate("""() => {
      const c = document.querySelector('#main-scroll') || document.scrollingElement;
      const t = Math.min(c.scrollHeight - c.clientHeight, 280);
      const t0 = performance.now(); const s = c.scrollTop;
      function step(now){
        const p = Math.min(1, (now - t0) / 1500);
        const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
        c.scrollTop = s + t * e;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }""")
    await beat(page, 1700)

    # Coach question.
    await click_el(page, st, ".coach-fab", ms=550)
    ts.mark("coach_opened")
    await beat(page, 600)
    await page.locator("#coach-input").click()
    await beat(page, 250)
    await slow_type(page, "How's my buffer pacing?", per_char_ms=50)
    await beat(page, 400)
    await click_el(page, st, "#coach-send", ms=500)
    ts.mark("coach_sent")
    await page.wait_for_function(
        "() => !document.querySelector('.coach-bubble.loading')",
        timeout=8000,
    )
    ts.mark("coach_response")
    # Hold long enough for the viewer to read at least the first paragraph
    # of the response before moving on.
    await beat(page, 5500)

    # Close coach, return to home.
    await click_el(page, st, ".coach-close", ms=500)
    await beat(page, 500)
    await click_el(page, st, 'button.nav-tab[data-group="home"]', ms=550)
    ts.mark("home_returned")
    await ease_move(page, st, 195, 320, ms=900)
    await beat(page, 3500)
    ts.mark("hold_complete")
    return {"markers": ts.to_list()}


# ──────────────────────────────────────────────────────────────────────────
# Cinematic Reels — second batch (2026-04-25 evening)
# ──────────────────────────────────────────────────────────────────────────
# These clips ship with caption *suggestions* in manifest.json (start/end/text)
# but NO baked-in text overlay — final captions are layered in CapCut so they
# stay editable. C1 is intended as the bottom half of a split-screen; the top
# half "Without Able" panel is composited in CapCut using the captions array.

async def record_clip_n1_day1to31(page: Page, ts: TimestampLogger) -> dict:
    """narrative-day1-to-31.mp4 — 5 emotional beats over an end-to-end walkthrough."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 700)

    # Day 1 — the deposit lands.
    ts.cap_open("Day 1. A check comes in.")
    await click_el(page, st, ".db-hero-cta", ms=600)
    await beat(page, 350)
    await page.locator("#inc-amount").click()
    await beat(page, 200)
    await slow_type(page, "3000", per_char_ms=170)
    await beat(page, 1900)
    ts.mark("day1_amount_held")

    # Day 7 — bills view, scrolled, conveys "everything's accounted for".
    ts.cap_open("Day 7. Every bill paid. Nothing missed.")
    await page.evaluate("closeAllocateSheet()")
    await beat(page, 350)
    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=500)
    await beat(page, 250)
    await click_el(page, st, 'button.sub-tab[data-sub="bills"]', ms=500)
    await beat(page, 800)
    await page.evaluate("""() => {
      const c = document.querySelector('#main-scroll') || document.scrollingElement;
      const t = Math.min(c.scrollHeight - c.clientHeight, 320);
      const s = c.scrollTop; const t0 = performance.now(); const dur = 2000;
      function step(now){
        const p = Math.min(1, (now - t0) / dur);
        const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
        c.scrollTop = s + t * e;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }""")
    await beat(page, 2200)
    ts.mark("day7_bills_held")

    # Day 14 — buffer holds (home, score visible).
    ts.cap_open("Day 14. Buffer holds.")
    await click_el(page, st, 'button.nav-tab[data-group="home"]', ms=500)
    await beat(page, 600)
    await ease_move(page, st, 195, 320, ms=900)
    await beat(page, 2400)
    ts.mark("day14_score_held")

    # Day 30 — coach checks in.
    ts.cap_open("Day 30. Coach checks in.")
    await click_el(page, st, ".coach-fab", ms=600)
    await beat(page, 500)
    await page.locator("#coach-input").click()
    await beat(page, 250)
    await slow_type(page, "How's my buffer pacing?", per_char_ms=45)
    await beat(page, 350)
    await click_el(page, st, "#coach-send", ms=400)
    await page.wait_for_function(
        "() => !document.querySelector('.coach-bubble.loading')",
        timeout=8000,
    )
    await beat(page, 2400)
    ts.mark("day30_reply_held")

    # Day 31 — back to a calm home.
    ts.cap_open("Day 31. Where did your money go? You know.")
    await click_el(page, st, ".coach-close", ms=400)
    await beat(page, 400)
    await click_el(page, st, 'button.nav-tab[data-group="home"]', ms=500)
    await beat(page, 600)
    await ease_move(page, st, 195, 380, ms=900)
    await beat(page, 3200)
    ts.cap_close()
    ts.mark("day31_held")
    return {"markers": ts.to_list()}


async def record_clip_b1_allocation_snap(page: Page, ts: TimestampLogger) -> dict:
    """broll-allocation-snap.mp4 — silent micro-loop: deposit → preview opens."""
    st = CursorState(x=195, y=820)
    ts.reset()
    await beat(page, 250)

    await click_el(page, st, ".db-hero-cta", ms=400)
    await beat(page, 250)
    await page.locator("#inc-amount").click()
    await beat(page, 150)
    await slow_type(page, "3000", per_char_ms=70)
    await page.locator("#inc-source").select_option("Freelance design")
    await beat(page, 200)
    await click_el(page, st, "#db-allocate-sheet button.btn-primary", ms=350)
    await page.evaluate("closeAllocateSheet()")
    ts.mark("preview_open")
    await beat(page, 2200)  # hold on the staggered breakdown
    return {"markers": ts.to_list()}


async def record_clip_b2_bill_paid(page: Page, ts: TimestampLogger) -> dict:
    """broll-bill-paid.mp4 — silent micro-loop: tap a bill's checkbox, watch it tick."""
    st = CursorState(x=195, y=820)
    ts.reset()
    await beat(page, 200)

    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=350)
    await beat(page, 200)
    await click_el(page, st, 'button.sub-tab[data-sub="bills"]', ms=350)
    await beat(page, 700)

    # Find the first un-checked bill and tap its checkbtn. Some demo-seed bills
    # are pre-paid (rendered with .checked); we want to capture the *transition*
    # to checked, so prefer an unchecked row.
    target = "div.bills-row .checkbtn:not(.checked) >> nth=0"
    try:
        await click_el(page, st, target, ms=400)
        ts.mark("bill_paid")
    except Exception:
        # Fallback: first checkbtn regardless of state.
        await click_el(page, st, "div.bills-row .checkbtn >> nth=0", ms=400)
        ts.mark("bill_paid_fallback")
    await beat(page, 1500)
    return {"markers": ts.to_list()}


async def record_clip_b3_coach_typing(page: Page, ts: TimestampLogger) -> dict:
    """broll-coach-typing.mp4 — silent micro-loop: question → typing dots → reply."""
    st = CursorState(x=320, y=780)
    ts.reset()
    await beat(page, 200)

    await click_el(page, st, ".coach-fab", ms=450)
    await beat(page, 400)
    await page.locator("#coach-input").click()
    await beat(page, 200)
    await slow_type(page, "How's my buffer pacing?", per_char_ms=42)
    await beat(page, 250)
    await click_el(page, st, "#coach-send", ms=350)
    ts.mark("typing")
    await page.wait_for_function(
        "() => !document.querySelector('.coach-bubble.loading')",
        timeout=8000,
    )
    ts.mark("response_visible")
    await beat(page, 1300)
    return {"markers": ts.to_list()}


async def record_clip_c1_compare(page: Page, ts: TimestampLogger) -> dict:
    """compare-without-with.mp4 — full-frame 'with Able' arc; manifest captions
    drive the 'Without Able' top-half panel composited in CapCut.
    """
    st = CursorState(x=195, y=820)
    ts.reset()

    # 0–5s: deposit lands, allocation preview opens.
    ts.cap_open("Without Able\n$3,000 in. No plan.")
    await beat(page, 500)
    await click_el(page, st, ".db-hero-cta", ms=500)
    await beat(page, 350)
    await page.locator("#inc-amount").click()
    await beat(page, 150)
    await slow_type(page, "3000", per_char_ms=130)
    await page.locator("#inc-source").select_option("Freelance design")
    await beat(page, 250)
    await click_el(page, st, "#db-allocate-sheet button.btn-primary", ms=400)
    await page.evaluate("closeAllocateSheet()")
    ts.mark("preview_open")
    await beat(page, 1500)

    # 5–9s: confirm; score updates; sense of order.
    ts.cap_open("Without Able\nWeek 2: half of it gone?")
    await click_el(page, st, "#modal-alloc-preview button.btn-primary", ms=400)
    ts.mark("allocation_confirmed")
    await beat(page, 1700)
    await ease_move(page, st, 195, 320, ms=700)
    await beat(page, 1100)

    # 9–13s: bills view — every dollar already has a job.
    ts.cap_open("Without Able\nMonth end: $0. Maybe overdraft.")
    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=400)
    await beat(page, 200)
    await click_el(page, st, 'button.sub-tab[data-sub="bills"]', ms=400)
    await beat(page, 1100)
    await page.evaluate("""() => {
      const c = document.querySelector('#main-scroll') || document.scrollingElement;
      const t = Math.min(c.scrollHeight - c.clientHeight, 220);
      const s = c.scrollTop; const t0 = performance.now(); const dur = 1300;
      function step(now){
        const p = Math.min(1, (now - t0) / dur);
        const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2;
        c.scrollTop = s + t * e;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }""")
    await beat(page, 1100)

    # 13–16s: hold while the contrast lands.
    ts.cap_open("Without Able\nWhere did it go?")
    await beat(page, 2400)
    ts.cap_close()
    ts.mark("hold_complete")
    return {"markers": ts.to_list()}


CLIPS: list[Clip] = [
    Clip("deposit-allocation",       18.0, record_clip_1_deposit),
    Clip("bills-view",               14.0, record_clip_2_bills),
    Clip("rolling-window-settings",  15.0, record_clip_3_window),
    Clip("ai-coach",                 23.0, record_clip_4_coach),
    Clip("full-walkthrough",         40.0, record_clip_5_walkthrough),
    Clip("narrative-day1-to-31",     32.0, record_clip_n1_day1to31),
    Clip("broll-allocation-snap",     6.0, record_clip_b1_allocation_snap),
    Clip("broll-bill-paid",           4.5, record_clip_b2_bill_paid),
    Clip("broll-coach-typing",        7.5, record_clip_b3_coach_typing),
    Clip("compare-without-with",     17.0, record_clip_c1_compare),
]


# ──────────────────────────────────────────────────────────────────────────
# Server, transcoding, orchestration
# ──────────────────────────────────────────────────────────────────────────
def _port_open(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", port))
        s.close()
        return True
    except OSError:
        return False


def start_static_server() -> subprocess.Popen | None:
    """Start `python3 -m http.server` from repo root, unless one's already running."""
    if _port_open(PORT):
        print(f"[record] reusing existing server on :{PORT}")
        return None
    print(f"[record] starting static server on :{PORT}")
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 5
    while time.time() < deadline:
        if _port_open(PORT):
            return proc
        time.sleep(0.1)
    proc.kill()
    raise RuntimeError("static server failed to start")


def transcode_to_mp4(webm: Path, mp4: Path, target_seconds: float) -> float:
    """WebM → MP4 H.264 1080x1920 30fps + silent AAC, trimmed to target_seconds."""
    if mp4.exists():
        mp4.unlink()
    cmd = [
        "ffmpeg", "-y",
        "-i", str(webm),
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-vf", f"scale={TARGET_W}:{TARGET_H}:flags=lanczos,fps={RECORD_FPS}",
        "-t", f"{target_seconds:.3f}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        str(mp4),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    # Probe actual duration
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nokey=1:noprint_wrappers=1", str(mp4)],
        check=True, capture_output=True, text=True,
    )
    return float(probe.stdout.strip())


async def run_one(playwright: Playwright, clip: Clip) -> ClipResult:
    """Record a single clip in a fresh browser context (clean storage)."""
    print(f"\n[record] {clip.slug}  (target {clip.target_seconds}s)")
    raw_subdir = RAW_DIR / clip.slug
    if raw_subdir.exists():
        shutil.rmtree(raw_subdir)
    raw_subdir.mkdir(parents=True, exist_ok=True)

    browser = await playwright.chromium.launch(
        headless=True,
        args=["--disable-dev-shm-usage", "--no-sandbox"],
    )
    context = await browser.new_context(
        viewport=VIEWPORT,
        device_scale_factor=2,  # retina-ish for sharper text
        record_video_dir=str(raw_subdir),
        record_video_size=VIEWPORT,
        # No stored session — every clip is a fresh demo seed.
        bypass_csp=True,
    )
    page = await context.new_page()
    page.on("console", lambda m: print(f"  [console.{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: print(f"  [pageerror] {e}"))
    # Move cursor off-screen until first ease_move plants it.
    await page.mouse.move(-50, -50)

    await page.goto(APP_URL)
    # Wait for the demo seed to finish (app becomes visible).
    await page.wait_for_function(
        "() => document.getElementById('app') && document.getElementById('app').style.display === 'block'",
        timeout=10000,
    )
    # Inject the visible cursor now that the app DOM is fully attached.
    status = await page.evaluate(CURSOR_SETUP)
    if status != "attached":
        print(f"  [warn] cursor setup returned {status!r}")
    # Plant cursor at a starting pose (lower-right of viewport).
    await page.mouse.move(195, 820)
    await page.wait_for_timeout(800)

    ts = TimestampLogger()
    try:
        await clip.record(page, ts)
    finally:
        ts.cap_close()                    # close any hanging caption
        await page.wait_for_timeout(400)  # cushion final frame
        await context.close()             # flushes the WebM
        await browser.close()

    # Locate the produced WebM (single file inside raw_subdir).
    webms = list(raw_subdir.glob("*.webm"))
    if not webms:
        raise RuntimeError(f"no WebM produced for {clip.slug}")
    webm = webms[0]
    mp4 = OUT_DIR / f"{clip.slug}.mp4"
    duration = transcode_to_mp4(webm, mp4, clip.target_seconds)
    print(f"[record] {clip.slug}: {webm.stat().st_size//1024}KB webm → {mp4.name} ({duration:.2f}s)")
    return ClipResult(
        slug=clip.slug,
        mp4=mp4,
        duration=duration,
        markers=ts.markers,
        captions=ts.to_caption_list(),
    )


def write_manifest(results: list[ClipResult]) -> Path:
    """Write manifest.json, preserving entries for clips not in this run.

    Running a subset of clips (e.g. `python3 record-clips.py broll-bill-paid`)
    should refresh that one entry without wiping the others.
    """
    out = OUT_DIR / "manifest.json"
    new_filenames = {r.mp4.name for r in results}
    new_clips = [
        {
            "filename":     r.mp4.name,
            "duration_sec": round(r.duration, 3),
            "markers":      [{"name": m.name, "seconds": m.seconds} for m in r.markers],
            "captions":     r.captions,
        }
        for r in results
    ]
    preserved: list[dict] = []
    if out.exists():
        try:
            existing = json.loads(out.read_text())
            for c in existing.get("clips", []):
                if c.get("filename") and c["filename"] not in new_filenames:
                    preserved.append(c)
        except json.JSONDecodeError:
            pass
    payload = {
        "generator": "scripts/record-clips.py",
        "viewport":  VIEWPORT,
        "framerate": RECORD_FPS,
        "video_size": {"width": TARGET_W, "height": TARGET_H},
        "codec":     {"video": "h264", "audio": "aac (silent)"},
        "clips":     preserved + new_clips,
    }
    out.write_text(json.dumps(payload, indent=2))
    return out


async def main(only_slugs: set[str] | None = None) -> None:
    OUT_DIR.mkdir(exist_ok=True)
    RAW_DIR.mkdir(exist_ok=True)
    server = start_static_server()
    try:
        async with async_playwright() as pw:
            results: list[ClipResult] = []
            for clip in CLIPS:
                if only_slugs and clip.slug not in only_slugs:
                    continue
                results.append(await run_one(pw, clip))
        manifest = write_manifest(results)
        print(f"\n[record] manifest written → {manifest.relative_to(ROOT)}")
        print(f"[record] {len(results)} clip(s) ready in {OUT_DIR.relative_to(ROOT)}/")
    finally:
        if server:
            server.terminate()
            try:
                server.wait(timeout=2)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    only = set(sys.argv[1:]) or None
    asyncio.run(main(only))
