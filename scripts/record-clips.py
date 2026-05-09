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
# ──────────────────────────────────────────────────────────────────────────
# Helpers shared across clips
# ──────────────────────────────────────────────────────────────────────────
async def smooth_scroll(page: Page, distance: int, duration_ms: int = 1500) -> None:
    """Smoothly scroll the in-app scroll container by `distance` px."""
    await page.evaluate(f"""
      async () => {{
        const c = document.querySelector('#main-scroll') || document.scrollingElement;
        const start = c.scrollTop;
        const target = Math.max(0, Math.min(c.scrollHeight - c.clientHeight, start + {distance}));
        const dur = {duration_ms};
        const t0 = performance.now();
        await new Promise(r => {{
          function step(t) {{
            const p = Math.min(1, (t - t0) / dur);
            const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2;
            c.scrollTop = start + (target - start) * e;
            if (p < 1) requestAnimationFrame(step);
            else r();
          }}
          requestAnimationFrame(step);
        }});
      }}
    """)


# ──────────────────────────────────────────────────────────────────────────
# Per-clip recordings
# Each clip is feature-focused, 8-15s, no captions baked in (composited later
# in CapCut). Order in the CLIPS list at the bottom matches the brief.
# ──────────────────────────────────────────────────────────────────────────

async def record_home_overview(page: Page, ts: TimestampLogger) -> dict:
    """1) Home — main card, then scroll to score card, then to chips/history."""
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 1000)
    await smooth_scroll(page, 380, duration_ms=1700)
    ts.mark("score_visible")
    await beat(page, 1300)
    await smooth_scroll(page, 360, duration_ms=1600)
    ts.mark("chips_visible")
    await beat(page, 1500)
    return {"markers": ts.to_list()}


async def record_plan_bills(page: Page, ts: TimestampLogger) -> dict:
    """2) Plan tab → Bills sub-tab, scroll the bill list."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 700)
    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=550)
    await beat(page, 350)
    await click_el(page, st, 'button.sub-tab[data-sub="bills"]', ms=500)
    ts.mark("bills_opened")
    await beat(page, 1000)
    await smooth_scroll(page, 320, duration_ms=1700)
    ts.mark("scroll_complete")
    await beat(page, 1300)
    return {"markers": ts.to_list()}


async def record_plan_whatif(page: Page, ts: TimestampLogger) -> dict:
    """3) Plan → What-if. Type a hypothetical amount, watch the split render."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)
    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=500)
    await beat(page, 300)
    await click_el(page, st, 'button.sub-tab[data-sub="whatif"]', ms=500)
    ts.mark("whatif_opened")
    await beat(page, 800)
    await page.locator("#wi-amount").click()
    await beat(page, 250)
    await slow_type(page, "5000", per_char_ms=170)
    ts.mark("amount_entered")
    await beat(page, 2000)
    return {"markers": ts.to_list()}


async def record_plan_forecast(page: Page, ts: TimestampLogger) -> dict:
    """4) Plan → Forecast. Lands on the page, scrolls to show the form."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)
    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=500)
    await beat(page, 300)
    await click_el(page, st, 'button.sub-tab[data-sub="forecast"]', ms=500)
    ts.mark("forecast_opened")
    await beat(page, 1000)
    await smooth_scroll(page, 220, duration_ms=1300)
    ts.mark("form_visible")
    await beat(page, 1600)
    return {"markers": ts.to_list()}


async def record_plan_debt(page: Page, ts: TimestampLogger) -> dict:
    """5) Plan → Debt. Scroll the debt list to show balances/APRs."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)
    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=500)
    await beat(page, 300)
    await click_el(page, st, 'button.sub-tab[data-sub="debt"]', ms=500)
    ts.mark("debt_opened")
    await beat(page, 900)
    await smooth_scroll(page, 280, duration_ms=1600)
    ts.mark("scroll_complete")
    await beat(page, 1300)
    return {"markers": ts.to_list()}


async def record_plan_activity(page: Page, ts: TimestampLogger) -> dict:
    """6) Plan → Activity. Scroll the feed, then open the Tax export modal."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)
    await click_el(page, st, 'button.nav-tab[data-group="plan"]', ms=500)
    await beat(page, 300)
    await click_el(page, st, 'button.sub-tab[data-sub="activity"]', ms=500)
    ts.mark("activity_opened")
    await beat(page, 900)
    await smooth_scroll(page, 200, duration_ms=1100)
    await beat(page, 600)
    # Tap the Tax export pill (sits at the top of the activity page).
    await page.evaluate("""
      () => {
        const c = document.querySelector('#main-scroll') || document.scrollingElement;
        c.scrollTop = 0;
      }
    """)
    await beat(page, 500)
    try:
        await click_el(page, st, '.tax-export-pill', ms=500)
        ts.mark("tax_export_opened")
        await beat(page, 1700)
    except Exception:
        ts.mark("tax_export_skipped")
        await beat(page, 600)
    return {"markers": ts.to_list()}


async def record_score_detail(page: Page, ts: TimestampLogger) -> dict:
    """7) Score tab — scroll the detail."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)
    await click_el(page, st, 'button.nav-tab[data-group="score"]', ms=500)
    ts.mark("score_opened")
    await beat(page, 1000)
    await smooth_scroll(page, 360, duration_ms=1800)
    ts.mark("scroll_complete")
    await beat(page, 1500)
    return {"markers": ts.to_list()}


async def record_more_learn(page: Page, ts: TimestampLogger) -> dict:
    """8) More → Learn. Scroll the lesson list."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)
    await click_el(page, st, 'button.nav-tab[data-group="more"]', ms=500)
    await beat(page, 300)
    await click_el(page, st, 'button.sub-tab[data-sub="learn"]', ms=500)
    ts.mark("learn_opened")
    await beat(page, 900)
    await smooth_scroll(page, 320, duration_ms=1700)
    ts.mark("scroll_complete")
    await beat(page, 1300)
    return {"markers": ts.to_list()}


async def record_more_refer(page: Page, ts: TimestampLogger) -> dict:
    """9) More → Refer. Scroll the referral page."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)
    await click_el(page, st, 'button.nav-tab[data-group="more"]', ms=500)
    await beat(page, 300)
    await click_el(page, st, 'button.sub-tab[data-sub="refer"]', ms=500)
    ts.mark("refer_opened")
    await beat(page, 900)
    await smooth_scroll(page, 280, duration_ms=1600)
    ts.mark("scroll_complete")
    await beat(page, 1300)
    return {"markers": ts.to_list()}


async def record_more_settings(page: Page, ts: TimestampLogger) -> dict:
    """10) More → Settings. Scroll the settings categories."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)
    await click_el(page, st, 'button.nav-tab[data-group="more"]', ms=500)
    await beat(page, 300)
    await click_el(page, st, 'button.sub-tab[data-sub="settings"]', ms=500)
    ts.mark("settings_opened")
    await beat(page, 900)
    await smooth_scroll(page, 320, duration_ms=1800)
    ts.mark("scroll_complete")
    await beat(page, 1300)
    return {"markers": ts.to_list()}


async def record_log_income(page: Page, ts: TimestampLogger) -> dict:
    """11) Home → Log new income → preview the split → confirm. Watch hero update."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 700)
    await click_el(page, st, 'button.db-hero-cta-primary[onclick*="openAllocateSheet"]', ms=550)
    ts.mark("sheet_opened")
    await beat(page, 600)
    await page.locator("#inc-amount").click()
    await beat(page, 250)
    await slow_type(page, "3000", per_char_ms=170)
    await beat(page, 350)
    await page.locator("#inc-source").select_option("Freelance design")
    await beat(page, 400)
    await click_el(page, st, '#db-allocate-sheet button.btn-primary', ms=500)
    await page.evaluate("closeAllocateSheet()")
    ts.mark("preview_open")
    await beat(page, 1700)
    await click_el(page, st, '#modal-alloc-preview button.btn-primary', ms=500)
    ts.mark("confirmed")
    await beat(page, 1500)
    return {"markers": ts.to_list()}


async def record_coach_ask(page: Page, ts: TimestampLogger) -> dict:
    """12) Coach — ask a question, watch the reply stream in."""
    st = CursorState(x=320, y=780)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 600)
    await click_el(page, st, ".coach-fab", ms=550)
    ts.mark("coach_opened")
    await beat(page, 700)
    await page.locator("#coach-input").click()
    await beat(page, 250)
    await slow_type(page, "How's my reserve pacing?", per_char_ms=50)
    await beat(page, 400)
    await click_el(page, st, "#coach-send", ms=500)
    ts.mark("sent")
    await page.wait_for_function(
        "() => !document.querySelector('.coach-bubble.loading')",
        timeout=8000,
    )
    ts.mark("response_visible")
    await beat(page, 2500)
    return {"markers": ts.to_list()}


async def record_add_expected_income(page: Page, ts: TimestampLogger) -> dict:
    """13) Home → Add expected income chip → fill out → save."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 700)
    await click_el(page, st, '.db-chip-action[onclick*="openAddIncomeModal"]', ms=550)
    ts.mark("modal_opened")
    await beat(page, 700)
    await page.locator("#qfc-amt").click()
    await beat(page, 250)
    await slow_type(page, "2400", per_char_ms=160)
    await beat(page, 400)
    await click_el(page, st, "#qfc-save-btn", ms=500)
    ts.mark("saved")
    await beat(page, 1500)
    return {"markers": ts.to_list()}


async def record_add_bill(page: Page, ts: TimestampLogger) -> dict:
    """14) Home → Add bill chip → fill name + amount → save."""
    st = CursorState(x=195, y=820)
    ts.reset()
    ts.mark("home_visible")
    await beat(page, 700)
    await click_el(page, st, '.db-chip-action[onclick*="openAddBillModal"]', ms=550)
    ts.mark("modal_opened")
    await beat(page, 700)
    await page.locator("#nb-name").click()
    await beat(page, 250)
    await slow_type(page, "Internet", per_char_ms=110)
    await beat(page, 250)
    await page.locator("#nb-amt").click()
    await beat(page, 200)
    await slow_type(page, "85", per_char_ms=160)
    await beat(page, 400)
    await click_el(page, st, "#bill-save-btn", ms=500)
    ts.mark("saved")
    await beat(page, 1500)
    return {"markers": ts.to_list()}


CLIPS: list[Clip] = [
    Clip("home-overview",          12.0, record_home_overview),
    Clip("plan-bills",             10.0, record_plan_bills),
    Clip("plan-whatif",            11.0, record_plan_whatif),
    Clip("plan-forecast",          11.0, record_plan_forecast),
    Clip("plan-debt",              10.0, record_plan_debt),
    Clip("plan-activity",          13.0, record_plan_activity),
    Clip("score-detail",           11.0, record_score_detail),
    Clip("more-learn",             10.0, record_more_learn),
    Clip("more-refer",             10.0, record_more_refer),
    Clip("more-settings",          10.0, record_more_settings),
    Clip("log-income",             14.0, record_log_income),
    Clip("coach-ask",              14.0, record_coach_ask),
    Clip("add-expected-income",    11.0, record_add_expected_income),
    Clip("add-bill",               13.0, record_add_bill),
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


TRIM_START_SECONDS = 1.0  # strip the WebM intro: blank frame + font-fallback flash

def transcode_to_mp4(webm: Path, mp4: Path, target_seconds: float) -> float:
    """WebM → MP4 H.264 1080x1920 30fps + silent AAC, trimmed to target_seconds.

    Skips the first TRIM_START_SECONDS of the WebM. Playwright begins recording
    on context creation, so the first ~1s captures Chromium's blank-page state
    and Bricolage Grotesque's font-swap flash. Trimming there makes every clip
    open on a stable, brand-correct frame.
    """
    if mp4.exists():
        mp4.unlink()
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{TRIM_START_SECONDS:.3f}",
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
    # Pre-seed localStorage / sessionStorage flags so the first-run intro popups
    # (floor-intro tooltip + bank-connect prompt modal) don't intercept clicks.
    # Both are sticky-dismissible and live behind these flags in app.html.
    await page.add_init_script("""
      try { localStorage.setItem('able_seen_floor_intro', '1'); } catch(_) {}
      try { sessionStorage.setItem('able_bank_prompt_dismissed', '1'); } catch(_) {}
    """)
    # Move cursor off-screen until first ease_move plants it.
    await page.mouse.move(-50, -50)

    await page.goto(APP_URL)
    # Wait for the demo seed to finish (app becomes visible).
    await page.wait_for_function(
        "() => document.getElementById('app') && document.getElementById('app').style.display === 'block'",
        timeout=10000,
    )
    # Wait for Bricolage Grotesque to finish loading. Without this, the first
    # frames of the recording show the system-font fallback before the swap —
    # the visible "font glitch" at clip start. Pair this with TRIM_START_SECONDS
    # in transcode for a clean opening frame.
    await page.evaluate("document.fonts.ready")
    # Defense in depth: if either popup snuck through (init-script timing race),
    # dismiss them programmatically before any click in the clip body fires.
    await page.evaluate("""
      () => {
        const pop = document.querySelector('.db-floor-pop');
        if (pop) pop.remove();
        const m = document.getElementById('modal-bank-prompt');
        if (m) m.style.display = 'none';
      }
    """)
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
