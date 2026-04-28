#!/usr/bin/env python3
"""
Capture phone-frame product shots of every key Able screen.

Two-phase pipeline:
  1. Drive ?demo=1 in Playwright at iPhone 14 Pro vertical (390×844 @ 2x),
     navigate to each of the 9 target screens, screenshot the inner viewport
     into marketing-footage/product-shots/_raw/.
  2. Load marketing-footage/product-shots/_frame.html with the raw shot URL +
     canvas dims as query params, screenshot the composed result at 4 aspect
     ratios into marketing-footage/product-shots/{slug}/{aspect}.png.

Output: 9 screens × 4 aspects = 36 master assets.
Run:    python3 scripts/capture-product-shots.py
"""
from __future__ import annotations

import asyncio
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, Callable

from playwright.async_api import Page, async_playwright  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "marketing-footage" / "product-shots"
RAW_DIR = OUT_DIR / "_raw"
PORT = 8767
APP_URL = f"http://localhost:{PORT}/app.html"
FRAME_URL = f"http://localhost:{PORT}/marketing-footage/product-shots/_frame.html"
# Capture viewport. We add 56px to the height so the screenshot includes a
# top "status bar" zone that the phone-frame composer overlays with iOS chrome
# (time, signal, dynamic island) — keeps app content from getting covered.
STATUS_PAD = 56
VIEWPORT = {"width": 390, "height": 844 + STATUS_PAD}

# CSS injected into every captured page: pads the body 56px from the top with
# a sage color matching the page bg, hides scrollbars, and dismisses the
# past-due bills banner so the dashboard reads as healthy. Also forces a
# white-ish status-bar area when the page bg behind is transparent.
MARKETING_CSS = f"""
html, body {{ background: #EBF1E5 !important; }}
body {{ padding-top: {STATUS_PAD}px !important; }}
.past-due-banner {{ display: none !important; }}
::-webkit-scrollbar {{ display: none !important; }}
* {{ scrollbar-width: none !important; }}
"""

# 4 export aspects. Names are filename-safe.
ASPECTS = [
    ("9x16", 1080, 1920),   # IG/TikTok story, Reels cover
    ("1x1",  1080, 1080),   # IG feed, Twitter
    ("4x5",  1080, 1350),   # IG portrait (highest engagement)
    ("16x9", 1920, 1080),   # LinkedIn, blog hero, YouTube thumbnail
]

# ──────────────────────────────────────────────────────────────────────────
# Server bootstrap (lifted from capture-design-screens.py)
# ──────────────────────────────────────────────────────────────────────────
def _port_open(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", port)); s.close(); return True
    except OSError:
        return False


def start_static_server() -> subprocess.Popen | None:
    if _port_open(PORT):
        print(f"[shots] reusing existing server on :{PORT}")
        return None
    print(f"[shots] starting static server on :{PORT}")
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 5
    while time.time() < deadline:
        if _port_open(PORT):
            return proc
        time.sleep(0.1)
    proc.kill()
    raise RuntimeError("static server failed to start")


# ──────────────────────────────────────────────────────────────────────────
# Phase 1: raw app screenshots
# ──────────────────────────────────────────────────────────────────────────
async def wait_for_app(page: Page) -> None:
    await page.wait_for_function(
        "() => document.getElementById('app') && document.getElementById('app').style.display === 'block'",
        timeout=10000,
    )
    await page.wait_for_timeout(600)


async def goto_demo(page: Page) -> None:
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    # Inject marketing CSS (padding for status bar zone, hide past-due banner).
    await page.add_style_tag(content=MARKETING_CSS)
    await page.wait_for_timeout(150)


async def apply_marketing_state(page: Page) -> None:
    """Override the rendered DOM so screenshots match the marketing reference.
    `S` is a module-scoped `let` (not on window), so we can't mutate state from
    Playwright. Instead we rewrite the dashboard hero HTML and the score card
    text directly. Safe to call on any page — selectors no-op when absent."""
    await page.evaluate(r"""() => {
        // 1. Replace the dashboard hero money card with marketing-correct numbers.
        //    Mirrors renderHeroMoney() output for the "available > 0" branch.
        const hero = document.getElementById('db-hero-money');
        if (hero) {
            hero.innerHTML = `
              <div class="db-hero-money-row">
                <span class="db-hero-money-label">In your accounts</span>
                <span class="db-hero-money-val">$1,200.00</span>
              </div>
              <div class="db-hero-money-edit-row">
                <button class="db-hero-edit" aria-label="Edit balance">Edit</button>
              </div>
              <div class="db-hero-money-row">
                <span class="db-hero-money-label">Reserved for bills</span>
                <span class="db-hero-money-val">$270.00</span>
              </div>
              <div class="db-hero-money-divider"></div>
              <div class="db-hero-available-row">
                <span class="db-hero-available-label">Available to spend</span>
                <span class="db-hero-available-val">$930.00</span>
              </div>
              <button class="db-hero-cta-primary">Tell me where it goes →</button>
            `;
        }

        // 2. Dashboard mini score → 54/100 BUILDING (matches reference mockup).
        const dbScoreNum = document.getElementById('db-score-big');
        const dbScoreLabel = document.getElementById('db-score-grade');
        const dbScoreBar = document.getElementById('db-score-fill');
        if (dbScoreNum) dbScoreNum.textContent = '54';
        if (dbScoreLabel) dbScoreLabel.textContent = 'Building';
        if (dbScoreBar) dbScoreBar.style.width = '54%';

        // 3. Score-page big number → 78 / "A, really solid".
        //    The Score page has its own DOM; aspirational but believable score.
        const sBig = document.getElementById('score-big');
        const sGrade = document.getElementById('score-grade');
        if (sBig) { sBig.textContent = '78'; sBig.style.color = 'var(--sage)'; }
        if (sGrade) sGrade.textContent = 'A, really solid';

        // 4. Hide the "Next 14 days" coach-style nudge that pops on the
        //    bottom of the dashboard — visually crowds the marketing shot.
        const nudge = document.querySelector('.db-coach-nudge, .db-next-14');
        if (nudge) nudge.style.display = 'none';
    }""")
    await page.wait_for_timeout(250)


@dataclass
class Shot:
    slug: str           # filename slug (no extension)
    label: str          # human label for logs
    capture: Callable[[Page], Awaitable[None]]


async def shot_dashboard(page: Page) -> None:
    """Default home view. Matches the user's reference mockup exactly."""
    await goto_demo(page)
    await page.evaluate("() => { if (typeof goTo === 'function') goTo('home'); }")
    await page.wait_for_timeout(700)
    await apply_marketing_state(page)


async def shot_allocation_preview(page: Page) -> None:
    """Click 'Tell me where it goes' so the alloc-preview modal renders the
    full 6-job breakdown for the available $930 — this is the marquee
    'every dollar gets a job' moment."""
    await goto_demo(page)
    await page.evaluate("() => { if (typeof allocateAvailable === 'function') allocateAvailable(); }")
    await page.wait_for_timeout(900)


async def shot_plan_bills(page: Page) -> None:
    """Plan group → Bills sub-tab. Reservation progress visible."""
    await goto_demo(page)
    await page.evaluate("""() => {
        if (typeof goTo === 'function') { goTo('plan'); setTimeout(() => goTo('bills'), 300); }
    }""")
    await page.wait_for_timeout(1100)


async def shot_score(page: Page) -> None:
    """Score group — 5 habits + 54/100 building badge."""
    await goto_demo(page)
    await page.evaluate("() => { if (typeof goTo === 'function') goTo('score'); }")
    await page.wait_for_timeout(900)


async def shot_coach(page: Page) -> None:
    """Open coach panel — seeded conversation visible."""
    await goto_demo(page)
    await page.evaluate("() => { if (typeof openCoachPanel === 'function') openCoachPanel(); }")
    await page.wait_for_timeout(1300)
    # Scroll messages so the most recent reply is visible.
    await page.evaluate("""() => {
        const m = document.getElementById('coach-messages');
        if (m) m.scrollTop = m.scrollHeight;
    }""")
    await page.wait_for_timeout(400)


async def shot_log_income(page: Page) -> None:
    """Open the 'Money just came in' allocate sheet, pre-fill amount + source
    so the form looks like a user mid-flow."""
    await goto_demo(page)
    await page.evaluate("""() => {
        if (typeof openAllocateSheet === 'function') openAllocateSheet();
        setTimeout(() => {
            const amt = document.getElementById('inc-amount');
            const src = document.getElementById('inc-source');
            if (amt) { amt.value = '2400'; amt.dispatchEvent(new Event('input', {bubbles:true})); }
            if (src) {
                // Pick "Freelance design" if it's an option.
                for (const opt of src.options) {
                    if (opt.text === 'Freelance design') { src.value = opt.value; break; }
                }
                src.dispatchEvent(new Event('change', {bubbles:true}));
            }
        }, 250);
    }""")
    await page.wait_for_timeout(900)


async def shot_settings(page: Page) -> None:
    """More → Settings sub-tab. Land at the top of the page so the rolling-
    window tabs sit just below the iOS status bar overlay (the body has
    padding-top: 56px → tabs render at y=56px, never under the dynamic
    island). scrollIntoView({block:'start'}) used to clip the tabs behind
    the overlay; reset scroll instead."""
    await goto_demo(page)
    await page.evaluate("""() => {
        if (typeof goTo === 'function') { goTo('more'); setTimeout(() => goTo('settings'), 300); }
    }""")
    await page.wait_for_timeout(1100)
    # Ensure top scroll so the body padding-top:56px keeps content out from
    # under the iOS overlay (vs. scrollIntoView which positions content at
    # viewport y=0 and gets clipped by the dynamic island).
    await page.evaluate("() => window.scrollTo(0, 0)")
    await page.wait_for_timeout(450)


async def shot_more_menu(page: Page) -> None:
    """More group default landing — Learn / Refer / Settings hub."""
    await goto_demo(page)
    await page.evaluate("() => { if (typeof goTo === 'function') goTo('more'); }")
    await page.wait_for_timeout(900)


async def shot_refer(page: Page) -> None:
    """Refer page with progress toward 'next free month' / 'next free year'.
    Demo seed leaves invites empty, so we inject DOM so the progress bars
    look lived-in for the shot."""
    await goto_demo(page)
    await page.evaluate("""() => {
        if (typeof goTo === 'function') { goTo('more'); setTimeout(() => goTo('refer'), 300); }
    }""")
    await page.wait_for_timeout(900)
    # Force the active state visible (subscription_status='active' from demo).
    # Then inject demo invites + progress.
    await page.evaluate(r"""() => {
        const locked = document.getElementById('refer-locked');
        const active = document.getElementById('refer-active');
        if (locked) locked.style.display = 'none';
        if (active) active.style.display = 'block';

        // Progress bars: 2 of 3 trial, 3 of 5 convert.
        const trialFill = document.getElementById('refer-trial-fill');
        const trialCnt  = document.getElementById('refer-trial-count');
        const convFill  = document.getElementById('refer-convert-fill');
        const convCnt   = document.getElementById('refer-convert-count');
        if (trialFill) trialFill.style.width = '66%';
        if (trialCnt)  trialCnt.textContent = '2 of 3';
        if (convFill)  convFill.style.width = '60%';
        if (convCnt)   convCnt.textContent  = '3 of 5';

        // Invite list — three sample rows.
        const list = document.getElementById('refer-list');
        const count = document.getElementById('refer-count');
        if (count) count.textContent = '· 3 sent';
        if (list) {
            list.innerHTML =
              '<div class="card" style="margin-bottom:.6rem;"><div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">' +
              '<div><div class="refer-row-name" style="font-weight:800;color:var(--ds-t1);font-size:15px;">Maya</div>' +
              '<div class="refer-row-meta" style="font-size:12px;color:var(--ds-t3);font-weight:600;margin-top:2px;">maya@studio.co · 2 days ago</div></div>' +
              '<div style="font-size:11px;font-weight:800;color:var(--ds-green);background:var(--ds-green-l);padding:5px 10px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase;">Trial started</div>' +
              '</div></div>' +
              '<div class="card" style="margin-bottom:.6rem;"><div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">' +
              '<div><div class="refer-row-name" style="font-weight:800;color:var(--ds-t1);font-size:15px;">Devon</div>' +
              '<div class="refer-row-meta" style="font-size:12px;color:var(--ds-t3);font-weight:600;margin-top:2px;">devon.r@gmail.com · 5 days ago</div></div>' +
              '<div style="font-size:11px;font-weight:800;color:var(--ds-green);background:var(--ds-green-l);padding:5px 10px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase;">Converted</div>' +
              '</div></div>' +
              '<div class="card" style="margin-bottom:.6rem;"><div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">' +
              '<div><div class="refer-row-name" style="font-weight:800;color:var(--ds-t1);font-size:15px;">Sasha</div>' +
              '<div class="refer-row-meta" style="font-size:12px;color:var(--ds-t3);font-weight:600;margin-top:2px;">sasha@hey.com · just now</div></div>' +
              '<div style="font-size:11px;font-weight:700;color:var(--ds-t3);background:var(--bg2);padding:5px 10px;border-radius:999px;letter-spacing:.04em;text-transform:uppercase;">Invite sent</div>' +
              '</div></div>';
        }

        // Rewards earned section.
        const rew = document.getElementById('refer-rewards-section');
        const rewList = document.getElementById('refer-rewards-list');
        if (rew && rewList) {
            rew.style.display = 'block';
            rewList.innerHTML =
              '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;">' +
              '<div style="width:36px;height:36px;border-radius:50%;background:var(--ds-green-l);display:flex;align-items:center;justify-content:center;color:var(--ds-green);font-weight:900;font-size:18px;">★</div>' +
              '<div><div style="font-weight:800;color:var(--ds-t1);font-size:14px;">1 free month earned</div>' +
              '<div style="font-size:12px;color:var(--ds-t3);font-weight:600;">Applied to your next billing cycle</div></div></div>';
        }
        window.scrollTo(0, 0);
    }""")
    await page.wait_for_timeout(500)


SHOTS: list[Shot] = [
    Shot("01-dashboard",        "Dashboard / Allocate hero",  shot_dashboard),
    Shot("02-allocation-flow",  "Allocation preview modal",   shot_allocation_preview),
    Shot("03-plan-bills",       "Plan → Bills",               shot_plan_bills),
    Shot("04-score",            "Score / 5 habits",           shot_score),
    Shot("05-coach",            "AI Coach panel",             shot_coach),
    Shot("06-log-income",       "Log income sheet",           shot_log_income),
    Shot("07-settings",         "Settings (rolling window)",  shot_settings),
    Shot("08-more-menu",        "More menu hub",              shot_more_menu),
    Shot("09-refer",            "Refer / earn free",          shot_refer),
]


async def capture_raw(page: Page, shot: Shot) -> Path:
    out = RAW_DIR / f"{shot.slug}.png"
    print(f"[shots] raw: {shot.label}")
    await shot.capture(page)
    # Re-run state overrides right before capture so any in-flight renders
    # (which the navigation might have triggered) are corrected.
    await apply_marketing_state(page)
    await page.screenshot(path=str(out), full_page=False, scale="device")
    print(f"   → {out.relative_to(ROOT)} ({out.stat().st_size // 1024}KB)")
    return out


# ──────────────────────────────────────────────────────────────────────────
# Phase 2: composed phone-frame shots
# ──────────────────────────────────────────────────────────────────────────
async def compose(page: Page, slug: str, aspect: str, w: int, h: int) -> None:
    out_dir = OUT_DIR / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{aspect}.png"

    url = f"{FRAME_URL}?shot={slug}.png&w={w}&h={h}"
    await page.goto(url)
    # Wait for the screenshot image to load.
    await page.wait_for_function(
        "() => window.__shotReady === true",
        timeout=10000,
    )
    await page.wait_for_timeout(200)
    # Clip the screenshot to the canvas dimensions exactly so we don't capture
    # any browser scrollbar artifacts.
    await page.screenshot(
        path=str(out),
        clip={"x": 0, "y": 0, "width": w, "height": h},
        scale="css",
    )
    print(f"   → {out.relative_to(ROOT)} ({out.stat().st_size // 1024}KB)")


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    server = start_static_server()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--disable-dev-shm-usage", "--no-sandbox"],
            )
            # ── Phase 1 ────────────────────────────────────────────────
            print("\n[shots] === PHASE 1: raw app captures ===")
            for shot in SHOTS:
                ctx = await browser.new_context(
                    viewport=VIEWPORT,
                    device_scale_factor=2,
                    bypass_csp=True,
                )
                page = await ctx.new_page()
                page.on("pageerror", lambda e: print(f"  [pageerror] {e}"))
                try:
                    await capture_raw(page, shot)
                except Exception as e:
                    print(f"  [error] {shot.slug}: {e}")
                await ctx.close()

            # ── Phase 2 ────────────────────────────────────────────────
            print("\n[shots] === PHASE 2: phone-frame composition ===")
            # Use the largest aspect's canvas as our context viewport so all
            # composed shots fit without scrolling. We override viewport per
            # shot anyway via context resize.
            for shot in SHOTS:
                print(f"[shots] compose: {shot.label}")
                for aspect, w, h in ASPECTS:
                    ctx = await browser.new_context(
                        viewport={"width": w, "height": h},
                        device_scale_factor=2,
                        bypass_csp=True,
                    )
                    page = await ctx.new_page()
                    page.on("pageerror", lambda e: print(f"  [pageerror] {e}"))
                    try:
                        await compose(page, shot.slug, aspect, w, h)
                    except Exception as e:
                        print(f"  [error] {shot.slug}/{aspect}: {e}")
                    await ctx.close()

            await browser.close()
        print(f"\n[shots] done → {OUT_DIR.relative_to(ROOT)}/")
        print(f"        9 raw + {len(SHOTS) * len(ASPECTS)} composed PNGs")
    finally:
        if server:
            server.terminate()
            try:
                server.wait(timeout=2)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    asyncio.run(main())
