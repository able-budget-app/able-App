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
# Capture viewport. Matches the iPhone 15 Pro screen dimensions exactly
# (390x844) so the phone-frame composer can show the full image without
# clipping. Body padding-top: 56 is added by MARKETING_CSS to push app
# content below the iOS status bar overlay rendered by the frame template.
# Previous version used 844+56 height which left the bottom 56px of the
# capture (where bottom nav + sheet CTAs live) outside the visible frame.
STATUS_PAD = 56
VIEWPORT = {"width": 390, "height": 844}

# CSS injected into every captured page: pads the body 56px from the top with
# a sage color matching the page bg, hides scrollbars, and dismisses banners,
# tours, and onboarding prompts that would otherwise leak into marketing shots.
MARKETING_CSS = f"""
html, body {{ background: #EBF1E5 !important; }}
body {{ padding-top: {STATUS_PAD}px !important; }}
.past-due-banner {{ display: none !important; }}
::-webkit-scrollbar {{ display: none !important; }}
* {{ scrollbar-width: none !important; }}

/* Hide the new-user tour overlay/spotlight/bubble — TOUR_STEPS spawn on
   first-run home and would render on top of every captured screen. */
.tour-overlay, .tour-spotlight, .tour-bubble {{ display: none !important; }}

/* Hide the first-time "This is your Floor" popover. Triggered by
   maybeShowFloorIntro() on home; gated by localStorage. We pre-set
   the dismissal flag in goto_demo, but keep this rule as defense
   in case the script runs before the localStorage write lands. */
.db-floor-pop {{ display: none !important; }}

/* Hide the "Connect your bank to finish setup" modal — fires when no
   plaid_items row exists (always true in demo mode). Marketing shots
   should never show this prompt. */
#modal-bank-prompt {{ display: none !important; }}

/* Hide the plan-floor callout — appears in onboarding plan-review only.
   Steady-state plan view doesn't show it; capture should match. */
.plan-floor-callout {{ display: none !important; }}

/* Hide the deep-dive banner by default (it's specifically injected for
   shot_deep_dive; on every other shot it should be empty/invisible). */
#deep-dive-banner:empty {{ display: none !important; }}

/* Hide the plan-refresh banner (Plaid recurring update notification)
   from non-relevant shots. */
#plan-refresh-banner {{ display: none !important; }}

/* Mobile modal CSS sets padding-bottom: 0 so action buttons sit flush
   against viewport bottom — fine on a real phone with safe-area-inset
   handling, but in marketing captures the buttons get cropped. Add
   bottom breathing room so Cancel/Save are always fully visible. */
.modal {{ padding-bottom: 1.5rem !important; }}
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
    # Pre-set localStorage flags BEFORE navigation so first-time popovers
    # (currently just the Floor intro) never spawn. add_init_script runs
    # on every navigation in this context.
    await page.add_init_script("""
        try {
            localStorage.setItem('able_seen_floor_intro', '1');
        } catch (_) {}
    """)
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    # Inject marketing CSS (padding, hide tour/banners/popovers/etc.).
    await page.add_style_tag(content=MARKETING_CSS)
    await page.wait_for_timeout(150)


async def apply_marketing_state(page: Page) -> None:
    """Override the rendered DOM with a coherent marketing persona. Every
    number across hero, score, chips, pace, and the alloc preview must
    agree — viewers compare frames and any mismatch reads as broken.

    Persona: Alex, freelance designer. Mid-month, on track.
      Balance:        $1,200
      Reserved:       $  270  (bills partially funded)
      Available:      $  930
      Score:           100/100  "Floor secured"
      Chips:    Bills 30/30 · Pay self 20/20 · Debt 20/20 · Buffer 15/15 · Within 15/15
      Pace:           $240 above floor (last 7 days)

    The alloc preview ($930 split) is mocked separately in shot_allocation_
    preview so the 6-job breakdown sums to exactly $930.
    """
    await page.evaluate(r"""() => {
        // 1. Dashboard hero — balance, reserved, available, CTA.
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

        // 2. Dashboard mini score → 100/100 (matches the chip values below).
        const dbScoreNum = document.getElementById('db-score-big');
        if (dbScoreNum) dbScoreNum.textContent = '100';

        // 3. Score page big number → 100 / "Floor secured".
        const sBig = document.getElementById('score-big');
        const sGrade = document.getElementById('score-grade');
        if (sBig) { sBig.textContent = '100'; sBig.style.color = 'var(--sage)'; }
        if (sGrade) sGrade.textContent = 'Floor secured';

        // 4. Habit chips — all five at max. 30+20+20+15+15 = 100, matches
        //    the score number above. Renders the all-checkmark filled state.
        const habits = document.getElementById('db-habits-row');
        if (habits) {
            const check = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            const chips = [
                { name: 'Bills',    pts: 30, max: 30 },
                { name: 'Pay self', pts: 20, max: 20 },
                { name: 'Debt',     pts: 20, max: 20 },
                { name: 'Buffer',   pts: 15, max: 15 },
                { name: 'Within',   pts: 15, max: 15 },
            ];
            habits.innerHTML = chips.map(h => `
              <div class="db-habit done" data-habit="${h.name.toLowerCase()}">
                <div class="db-habit-ring">${check}</div>
                <div class="db-habit-name">${h.name}</div>
                <div class="db-habit-pts">${h.pts}/${h.max}</div>
              </div>`).join('');
        }

        // 5. Hide the "Next 14 days" coach-style nudge that crowds the
        //    bottom of the dashboard.
        const nudge = document.querySelector('.db-coach-nudge, .db-next-14');
        if (nudge) nudge.style.display = 'none';

        // 6. Inject the floor-pace sparkline into the score card. Real one
        //    is rendered by loadPaceLine() against Plaid spend data; in
        //    demo mode there's none, so without injection the card reads
        //    empty between score number and habit chips. Dark variant
        //    matches the score-card's forest-green background.
        const pace = document.getElementById('db-score-pace');
        if (pace) {
            pace.classList.add('db-score-pace--dark');
            pace.style.display = 'block';
            pace.innerHTML = `
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;margin-bottom:4px;">
                <div class="db-pace-label">Floor pace · last 7 days</div>
                <div class="db-pace-gap" style="color:#b8e0c8;">$240 above floor</div>
              </div>
              <svg width="100%" height="32" viewBox="0 0 200 32" preserveAspectRatio="none" style="display:block;">
                <path d="M 0 24 L 200 8" stroke="rgba(255,255,255,.35)" stroke-width="1.5" stroke-dasharray="3,3" fill="none"/>
                <path d="M 0 26 L 50 22 L 100 16 L 140 10 L 200 6" stroke="#b8e0c8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
              <div class="db-pace-foot"><span>7d ago</span><span>today</span></div>`;
        }
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
    """Alloc-preview modal split for the dashboard's $930 available — the
    marquee 'every dollar gets a job' moment. Calls openAllocPreview
    directly with mock jobs whose amounts sum to exactly $930. Bypasses
    the real allocateAvailable() because that uses _availableToSpend()
    against demo state ($5,000 balance - reserved = $3,150) which
    contradicts the dashboard hero ($930)."""
    await goto_demo(page)
    await page.evaluate(r"""() => {
        // 6 mock jobs, percentages mirror the curated coach-reply split:
        //   tax 28% · bills 25% · pay 14% · debt 12% · reserve 13% · free 8%
        //   on $930 available → 260 + 233 + 130 + 112 + 121 + 74 = 930
        const jobs = [
          { name: 'Set aside for taxes',
            why: '28% of every dollar to a separate tax account. Non-negotiable.',
            amount: 260, color: 'var(--ds-c2)', bg: '#d9ecde', type: 'fixed',
            destination: 'savings_bucket' },
          { name: 'Top off bills (next 14 days)',
            why: 'Phone, internet, health insurance, and the Chase minimum.',
            amount: 233, color: 'var(--ds-t1)', bg: 'var(--ds-card2)', type: 'bills' },
          { name: 'Pay yourself',
            why: '14% owner draw. Locked in regardless of season.',
            amount: 130, color: 'var(--ds-c2)', bg: '#d9ecde', type: 'ownerpay' },
          { name: 'Extra to Chase Sapphire CC',
            why: '22% APR is bleeding you. Highest interest first.',
            amount: 112, color: 'var(--coral)', bg: 'var(--coral-light)', type: 'debt' },
          { name: 'Move to reserve',
            why: 'Slow-month protection. 6-month goal: $14k.',
            amount: 121, color: 'var(--sky)', bg: 'var(--sky-light)', type: 'buffer' },
          { name: 'Yours to spend freely',
            why: '8% guilt-free. No tracking, no rules.',
            amount: 74, color: 'var(--text2)', bg: 'var(--bg2)', type: 'free' },
        ];
        if (typeof openAllocPreview === 'function') {
            openAllocPreview(930, 'Unallocated balance', jobs);
        }
    }""")
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


async def shot_debts(page: Page) -> None:
    """Plan → Debt sub-tab. Demo seed has one Chase CC; APR + minimum payment
    visible from Plaid liabilities. Captures the post-Plaid debt UI."""
    await goto_demo(page)
    await page.evaluate("""() => {
        if (typeof goTo === 'function') { goTo('plan'); setTimeout(() => goTo('debt'), 300); }
    }""")
    await page.wait_for_timeout(1100)
    await page.evaluate("() => window.scrollTo(0, 0)")
    await page.wait_for_timeout(250)


async def shot_tax_view(page: Page) -> None:
    """Home with the quarterly-tax-projection card visible. Demo seed may not
    trigger the card (needs taxPct + recent income); inject the rendered DOM
    directly so the marketing shot always shows it. scrollTo(0,0) keeps body
    padding-top intact so the card sits below the iOS status bar overlay."""
    await goto_demo(page)
    await page.evaluate("() => { if (typeof goTo === 'function') goTo('home'); }")
    await page.wait_for_timeout(700)
    await apply_marketing_state(page)
    await page.evaluate(r"""() => {
        const wrap = document.getElementById('home-quarterly-tax');
        if (!wrap) return;
        wrap.innerHTML = `
            <div class="qt-card">
              <div class="qt-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              </div>
              <div class="qt-card-body">
                <div class="qt-card-eyebrow">Next quarterly tax</div>
                <div class="qt-card-title">Due Jun 16 (~40 days). 28% on $7,400 income last 90 days.</div>
              </div>
              <div class="qt-card-amt">$2,072</div>
            </div>`;
        wrap.style.display = '';
        // Don't scrollIntoView — that hides body padding under the status
        // bar. scrollTo(0,0) keeps padding visible and the card sits in
        // its natural home-screen position.
        window.scrollTo(0, 0);
    }""")
    await page.wait_for_timeout(450)


async def shot_deep_dive(page: Page) -> None:
    """Home with the deep-dive banner active. Demo seed won't have pending_review
    items, so we inject the banner DOM directly. scrollTo(0,0) preserves body
    padding-top so the banner doesn't slide under the iOS status bar."""
    await goto_demo(page)
    await page.evaluate("() => { if (typeof goTo === 'function') goTo('home'); }")
    await page.wait_for_timeout(700)
    await apply_marketing_state(page)
    await page.evaluate(r"""() => {
        const el = document.getElementById('deep-dive-banner');
        if (!el) return;
        el.innerHTML = `
            <div class="deep-dive-banner">
              <div class="deep-dive-banner-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div class="deep-dive-banner-body">
                <div class="deep-dive-banner-title">3 new finds from your bank</div>
                <div class="deep-dive-banner-sub">Able spotted 2 recurring charges and 1 income source you haven't classified.</div>
              </div>
              <button class="deep-dive-banner-cta">Review</button>
            </div>`;
        // scrollTo(0,0) instead of scrollIntoView — preserves body padding
        // so the banner stays below the status-bar overlay.
        window.scrollTo(0, 0);
    }""")
    await page.wait_for_timeout(450)


async def shot_tax_classify(page: Page) -> None:
    """Reclassify modal opened over the Activity page. Real outflow chip set
    (Bill / Spending / Debt payment / Tax payment / Transfer) — same source
    of truth the live app uses. Spending is the current category (matching
    a freshly auto-classified Google Ads transaction); user is about to
    flip it to a business expense by checking tax-deductible + setting the
    business label. Renders the modal over a blurred Activity page so the
    shot reads as the in-context flow."""
    await goto_demo(page)
    # Navigate to Plan → Activity so the modal backdrop shows the activity
    # page (not home). The reclassify modal lives in this flow in real use.
    await page.evaluate("""() => {
        if (typeof goTo === 'function') { goTo('plan'); setTimeout(() => goTo('activity'), 300); }
    }""")
    await page.wait_for_timeout(900)
    # Inject a few activity rows so the page has real-feeling content behind
    # the modal (demo seed has no plaid_transactions, so the page reads empty).
    await page.evaluate(r"""() => {
        const list = document.getElementById('activity-list');
        if (list) {
            list.innerHTML = `
              <div class="act-row" style="padding:14px 16px;border-bottom:1px solid var(--ds-line);display:flex;justify-content:space-between;align-items:center;background:white;">
                <div><div style="font-size:14px;font-weight:800;color:var(--ds-t1);">Google Ads</div>
                <div style="font-size:11px;color:var(--ds-t3);font-weight:600;margin-top:2px;">Wed, May 6 · auto · spending</div></div>
                <div style="font-size:14px;font-weight:800;color:var(--ds-t1);">-$50.00</div>
              </div>
              <div class="act-row" style="padding:14px 16px;border-bottom:1px solid var(--ds-line);display:flex;justify-content:space-between;align-items:center;background:white;">
                <div><div style="font-size:14px;font-weight:800;color:var(--ds-t1);">Acme Design Co</div>
                <div style="font-size:11px;color:var(--ds-t3);font-weight:600;margin-top:2px;">Tue, May 5 · income</div></div>
                <div style="font-size:14px;font-weight:800;color:var(--ds-green);">+$2,400.00</div>
              </div>
              <div class="act-row" style="padding:14px 16px;border-bottom:1px solid var(--ds-line);display:flex;justify-content:space-between;align-items:center;background:white;">
                <div><div style="font-size:14px;font-weight:800;color:var(--ds-t1);">Adobe Creative Cloud</div>
                <div style="font-size:11px;color:var(--ds-t3);font-weight:600;margin-top:2px;">Mon, May 4 · auto · spending</div></div>
                <div style="font-size:14px;font-weight:800;color:var(--ds-t1);">-$54.99</div>
              </div>`;
        }
        const modal = document.getElementById('modal-reclassify');
        if (!modal) return;
        const summary = document.getElementById('reclassify-summary');
        if (summary) {
            summary.innerHTML = `
              <div style="font-size:18px;font-weight:900;color:var(--ds-t1);letter-spacing:-.01em;margin-bottom:4px;">−$50.00</div>
              <div style="font-size:13px;font-weight:800;color:var(--ds-t1);">Google Ads</div>
              <div style="font-size:11px;font-weight:600;color:var(--ds-t3);margin-top:3px;">Wed, May 6 · currently <span class="act-cat-badge discretionary">spending</span> <span class="act-pfc-badge">other general services</span> · 90% sure · "Google Ads"</div>`;
        }
        // Real chip set from ACTIVITY_OUTFLOW_CATS using .rc-chip styling.
        // Spending is the auto-classified pick; user is about to switch it.
        const chips = document.getElementById('reclassify-chips');
        if (chips) {
            chips.innerHTML = `
              <button class="rc-chip">Bill</button>
              <button class="rc-chip selected">Spending</button>
              <button class="rc-chip">Debt payment</button>
              <button class="rc-chip">Tax payment</button>
              <button class="rc-chip">Transfer</button>`;
        }
        const businessInput = document.getElementById('reclassify-business');
        if (businessInput) businessInput.value = 'Acme Design Co';
        const taxBox = document.getElementById('reclassify-tax-deductible');
        if (taxBox) taxBox.checked = true;
        modal.style.display = 'flex';
    }""")
    await page.wait_for_timeout(450)


async def shot_tax_export(page: Page) -> None:
    """Tax-export modal opened with a populated category summary and active
    Download CSV button. Renders over the Activity page (where the export
    surface lives in real use)."""
    await goto_demo(page)
    await page.evaluate("""() => {
        if (typeof goTo === 'function') { goTo('plan'); setTimeout(() => goTo('activity'), 300); }
    }""")
    await page.wait_for_timeout(900)
    await page.evaluate(r"""() => {
        const modal = document.getElementById('modal-tax-export');
        if (!modal) return;
        const sel = document.getElementById('tax-year');
        if (sel) {
            sel.innerHTML = '<option value="2026" selected>2026</option><option value="2025">2025</option>';
        }
        const dl = document.getElementById('tax-download-btn');
        if (dl) dl.disabled = false;
        const sum = document.getElementById('tax-summary');
        if (sum) {
            sum.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:baseline;background:var(--ds-green-l);border:1px solid var(--ds-green-m);border-radius:var(--ds-r2);padding:14px 16px;margin-bottom:1rem;">
                <div>
                  <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ds-green2);">Total tax-deductible</div>
                  <div style="font-size:1.6rem;font-weight:900;color:var(--ds-t1);letter-spacing:-.02em;margin-top:2px;">$8,742.30</div>
                </div>
                <div style="font-size:12px;color:var(--ds-t2);font-weight:700;">42 transactions</div>
              </div>
              <div style="border:1px solid var(--ds-line);border-radius:var(--ds-r2);overflow:hidden;background:white;">
                ${[
                  ['Software', '$2,450.00', 14],
                  ['Office supplies', '$1,820.55', 9],
                  ['Travel', '$1,640.00', 6],
                  ['Education', '$1,210.00', 4],
                  ['Phone & internet', '$960.75', 5],
                  ['Health insurance', '$661.00', 4],
                ].map((r,i,a) => `
                  <div style="display:flex;justify-content:space-between;padding:11px 14px;${i<a.length-1?'border-bottom:1px solid var(--ds-line);':''}">
                    <div>
                      <div style="font-size:13px;font-weight:800;color:var(--ds-t1);">${r[0]}</div>
                      <div style="font-size:11px;font-weight:600;color:var(--ds-t3);margin-top:1px;">${r[2]} transactions</div>
                    </div>
                    <div style="font-size:13px;font-weight:800;color:var(--ds-t1);letter-spacing:-.005em;">${r[1]}</div>
                  </div>`).join('')}
              </div>`;
        }
        modal.style.display = 'flex';
    }""")
    await page.wait_for_timeout(450)


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
    Shot("10-debts",            "Plan → Debt (post-Plaid)",   shot_debts),
    Shot("11-tax-view",         "Home → Quarterly tax",       shot_tax_view),
    Shot("12-deep-dive",        "Home → Deep-dive banner",    shot_deep_dive),
    Shot("13-tax-classify",     "Reclassify → tax-deductible",shot_tax_classify),
    Shot("14-tax-export",       "Tax export modal",           shot_tax_export),
    # 15-bank-connect dropped 2026-05-08 (Paul): the custom Able-branded
    # bank-connect screen doesn't exist in the real app (Plaid Link is hosted),
    # so it read as misleading marketing. Replaced by C4 task: a separate
    # 3-icon Plaid digital-handshake illustration (bank → plaid → able) as
    # a standalone marketing asset, not in the capture pipeline.
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
async def compose_bare(page: Page, slug: str, w: int, h: int) -> None:
    """Compose a transparent-bg variant — phone with shadow, no canvas color.
    Used by social posts that embed the phone over the post's own theme bg."""
    out_dir = OUT_DIR / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "9x16-bare.png"

    url = f"{FRAME_URL}?shot={slug}.png&w={w}&h={h}&bg=transparent"
    await page.goto(url)
    await page.wait_for_function("() => window.__shotReady === true", timeout=10000)
    await page.wait_for_timeout(200)
    await page.screenshot(
        path=str(out),
        clip={"x": 0, "y": 0, "width": w, "height": h},
        scale="css",
        omit_background=True,
    )
    print(f"   → {out.relative_to(ROOT)} ({out.stat().st_size // 1024}KB)")


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
                # Transparent-bg variant (9x16 only — used by social posts).
                ctx = await browser.new_context(
                    viewport={"width": 1080, "height": 1920},
                    device_scale_factor=2,
                    bypass_csp=True,
                )
                page = await ctx.new_page()
                page.on("pageerror", lambda e: print(f"  [pageerror] {e}"))
                try:
                    await compose_bare(page, shot.slug, 1080, 1920)
                except Exception as e:
                    print(f"  [error] {shot.slug}/9x16-bare: {e}")
                await ctx.close()

            await browser.close()
        print(f"\n[shots] done → {OUT_DIR.relative_to(ROOT)}/")
        print(f"        {len(SHOTS)} raw + {len(SHOTS) * len(ASPECTS)} composed PNGs")
    finally:
        if server:
            server.terminate()
            try:
                server.wait(timeout=2)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    asyncio.run(main())
