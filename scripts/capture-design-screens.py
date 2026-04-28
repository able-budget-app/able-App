#!/usr/bin/env python3
"""
Capture still PNGs of every Able screen for DESIGN.md / design.html.

Reuses the demo seed (`?demo=1`) and the same iPhone-14-Pro viewport as
scripts/record-clips.py so visuals match the marketing footage exactly.

Output: docs/design-screens/*.png
Run:    python3 scripts/capture-design-screens.py
"""
from __future__ import annotations

import asyncio
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.async_api import Page, async_playwright  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs" / "design-screens"
PORT = 8766
APP_URL = f"http://localhost:{PORT}/app.html"
VIEWPORT = {"width": 390, "height": 844}


def _port_open(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", port)); s.close(); return True
    except OSError:
        return False


def start_static_server() -> subprocess.Popen | None:
    if _port_open(PORT):
        print(f"[capture] reusing existing server on :{PORT}")
        return None
    print(f"[capture] starting static server on :{PORT}")
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


async def wait_for_app(page: Page) -> None:
    """Wait until the demo seed has rendered the main app."""
    await page.wait_for_function(
        "() => document.getElementById('app') && document.getElementById('app').style.display === 'block'",
        timeout=10000,
    )
    await page.wait_for_timeout(500)  # settle reveals


async def shoot(page: Page, name: str, full_page: bool = False) -> None:
    path = OUT_DIR / f"{name}.png"
    await page.screenshot(path=str(path), full_page=full_page, scale="device")
    print(f"  → {path.relative_to(ROOT)} ({path.stat().st_size // 1024}KB)")


async def capture_in_app(page: Page, name: str, *, navigate: str | None = None) -> None:
    """Run a JS navigation snippet (optional), then screenshot the visible viewport."""
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    if navigate:
        await page.evaluate(navigate)
        await page.wait_for_timeout(800)
    await shoot(page, name)


async def capture_overlay(page: Page, name: str, screen_id: str, prep_js: str = "") -> None:
    """Force a pre-app overlay (auth/paywall/onboard) visible and screenshot it.

    These screens are normally hidden by the demo seed CSS. We load the demo so
    we have a working DOM, then override visibility for the target screen.
    """
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    await page.evaluate(f"""() => {{
        // Demo seed installs `display:none !important` on these via a stylesheet,
        // so plain inline styles lose. setProperty(..., 'important') wins.
        // Also strip the data attribute so the rule stops applying entirely.
        document.documentElement.removeAttribute('data-able-demo');
        document.querySelectorAll('#auth-screen, #paywall-screen, #onboard-screen')
            .forEach(el => el.style.setProperty('display', 'none', 'important'));
        const target = document.getElementById('{screen_id}');
        if (target) {{
            target.style.setProperty('display', 'flex', 'important');
            target.style.setProperty('z-index', '9999', 'important');
        }}
        document.getElementById('app').style.setProperty('display', 'none', 'important');
    }}""")
    if prep_js:
        await page.evaluate(prep_js)
    await page.wait_for_timeout(600)
    await shoot(page, name)


# ──────────────────────────────────────────────────────────────────────────
# Per-screen captures
# ──────────────────────────────────────────────────────────────────────────
async def cap_auth(page: Page) -> None:
    """The sign-in screen, no demo, no overrides — fresh load."""
    await page.goto(APP_URL)
    await page.wait_for_selector("#auth-screen", state="visible", timeout=8000)
    await page.wait_for_timeout(900)  # let any reveals settle
    await shoot(page, "01-auth")


async def cap_paywall(page: Page) -> None:
    await capture_overlay(page, "02-paywall", "paywall-screen")


async def cap_onboard(page: Page) -> None:
    """Onboarding step 1 (welcome). startOnboarding() resets state + renders."""
    await capture_overlay(
        page,
        "03-onboarding",
        "onboard-screen",
        prep_js="""() => {
            try {
                if (typeof startOnboarding === 'function') startOnboarding();
            } catch (e) { console.error(e); }
        }""",
    )


async def cap_home(page: Page) -> None:
    await capture_in_app(page, "04-home")


async def cap_home_full(page: Page) -> None:
    """Full-page home for design.html long-form display."""
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    await shoot(page, "04b-home-full", full_page=True)


async def cap_bills(page: Page) -> None:
    """Plan group → Bills sub-tab."""
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    await page.locator('button.nav-tab[data-group="plan"]').first.click()
    await page.wait_for_timeout(400)
    await page.locator('button.sub-tab[data-sub="bills"]').first.click()
    await page.wait_for_timeout(800)
    await shoot(page, "05-bills")


async def cap_settings(page: Page) -> None:
    """More group → Settings sub-tab. Scroll to surplus-split for visual richness."""
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    await page.locator('button.nav-tab[data-group="more"]').first.click()
    await page.wait_for_timeout(400)
    await page.locator('button.sub-tab[data-sub="settings"]').first.click()
    await page.wait_for_timeout(800)
    await page.evaluate("""() => {
        const el = document.querySelector('#window-tabs') || document.querySelector('.settings-section');
        if (el) el.scrollIntoView({behavior:'instant', block:'start'});
    }""")
    await page.wait_for_timeout(400)
    await shoot(page, "06-settings")


async def cap_score(page: Page) -> None:
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    await page.locator('button.nav-tab[data-group="score"]').first.click()
    await page.wait_for_timeout(800)
    await shoot(page, "07-score")


async def cap_coach(page: Page) -> None:
    """Open the Coach FAB so the seeded conversation is visible."""
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    # Click the FAB to open the panel.
    fab = page.locator(".coach-fab").first
    await fab.click()
    await page.wait_for_timeout(1200)
    # Scroll messages container so the most recent reply is visible.
    await page.evaluate("""() => {
        const m = document.getElementById('coach-messages');
        if (m) m.scrollTop = m.scrollHeight;
    }""")
    await page.wait_for_timeout(400)
    await shoot(page, "08-coach")


async def cap_more_menu(page: Page) -> None:
    await page.goto(f"{APP_URL}?demo=1")
    await wait_for_app(page)
    await page.locator('button.nav-tab[data-group="more"]').first.click()
    await page.wait_for_timeout(800)
    await shoot(page, "09-more")


CAPTURES = [
    cap_auth,
    cap_paywall,
    cap_onboard,
    cap_home,
    cap_home_full,
    cap_bills,
    cap_settings,
    cap_score,
    cap_coach,
    cap_more_menu,
]


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    server = start_static_server()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--disable-dev-shm-usage", "--no-sandbox"],
            )
            for fn in CAPTURES:
                context = await browser.new_context(
                    viewport=VIEWPORT,
                    device_scale_factor=2,
                    bypass_csp=True,
                )
                page = await context.new_page()
                page.on("pageerror", lambda e: print(f"  [pageerror] {e}"))
                print(f"[capture] {fn.__name__}")
                try:
                    await fn(page)
                except Exception as e:
                    print(f"  [error] {fn.__name__}: {e}")
                await context.close()
            await browser.close()
        print(f"\n[capture] done → {OUT_DIR.relative_to(ROOT)}/")
    finally:
        if server:
            server.terminate()
            try:
                server.wait(timeout=2)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    asyncio.run(main())
