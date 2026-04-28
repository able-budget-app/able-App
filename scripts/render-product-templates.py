#!/usr/bin/env python3
"""
Render the use-template variants of the product-shot library.

Templates are defined in marketing-footage/product-shots/_frame.html and
parameterized via URL query string. This script enumerates the templates we
ship and renders each at all 4 aspect ratios.

Output: marketing-footage/product-shots/templates/{template}/{aspect}.png

Run:    python3 scripts/render-product-templates.py
"""
from __future__ import annotations

import asyncio
import socket
import subprocess
import sys
import time
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path

from playwright.async_api import async_playwright  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "marketing-footage" / "product-shots" / "templates"
PORT = 8767
FRAME_URL = f"http://localhost:{PORT}/marketing-footage/product-shots/_frame.html"

ASPECTS = [
    ("9x16", 1080, 1920),
    ("1x1",  1080, 1080),
    ("4x5",  1080, 1350),
    ("16x9", 1920, 1080),
]


@dataclass
class TemplateSpec:
    slug: str
    template: str          # one of: feature-bullets | hero-line | callout | comparison | carousel-slide
    shot: str              # raw screenshot filename, e.g. "01-dashboard.png"
    params: dict           # additional URL params (hook, line1, sub, bullets, tag, mode)
    folder: str = "templates"  # output subfolder under marketing-footage/product-shots/


# Templates use Able brand voice: customer-as-hero, no tool-as-hero phrasing,
# no em dashes, no "every dollar gets a job" (too YNAB/EveryDollar). Signature
# bookend pattern is "From X → To Y" — encoded as "[arrow]" in copy strings,
# rendered as a styled green arrow by the frame's fmt() helper.
#
# Line breaks are EXPLICIT via "\n" — no auto-wrap, no mid-thought breaks.
TEMPLATES: list[TemplateSpec] = [
    # 1. Feature-bullets — what you SEE inside Able. Customer-as-hero ("you see"
    #    not "Able shows you"). Eyebrow primes the editorial feel.
    TemplateSpec(
        slug="feature-bullets-allocate",
        template="feature-bullets",
        shot="01-dashboard.png",
        params={
            "eyebrow": "inside Able",
            "hook": "Open the app.\nSee what's safe\nto spend.",
            "bullets": "|".join([
                "What's reserved for upcoming bills",
                "What's left, free and clear",
                "How every new deposit gets planned",
                "Five habits, scored monthly",
                "A calm coach when you need one",
            ]),
        },
    ),
    # 2. Hero-line — signature bookend "From X → To Y". The breath metaphor
    #    is Able's load-bearing hero copy (see able-brand SKILL.md). The break
    #    sits BEFORE the arrow so each "From..." / "To..." reads as one beat.
    TemplateSpec(
        slug="hero-line-breathe",
        template="hero-line",
        shot="02-allocation-flow.png",
        params={
            "line1": "From holding your breath\n[arrow] To finally able to breathe.",
            "sub": "Money in. Planned in 60 seconds. Calm for the rest of the month.",
        },
    ),
    # 3. Callout — score view. Customer-as-hero ("you're building" not
    #    "Able scores you"). No "elite" hype — Able voice is calm, specific.
    TemplateSpec(
        slug="callout-score",
        template="callout",
        shot="04-score.png",
        params={
            "tag": "every month",
            "line1": "Five habits.\nScored 0 to 100.\nYou see how you're\nbuilding.",
        },
    ),
    # 4. Comparison — pain inventory drawn from Able's actual landing copy.
    #    No em dashes per brand. "Before Able" is more honest than "without".
    TemplateSpec(
        slug="comparison-before",
        template="comparison",
        shot="01-dashboard.png",
        params={
            "hook": "Before Able",
            "bullets": "|".join([
                "Money disappears by mid-month.",
                "Tax bill sneaks up every quarter.",
                "Good months feel rich. Slow months feel scary.",
                "Nobody to ask before a big purchase.",
            ]),
        },
    ),
    # 5. Carousel-slide — coach feature. Forced line break between sentences
    #    so it never wraps mid-thought.
    TemplateSpec(
        slug="carousel-slide-coach",
        template="carousel-slide",
        shot="05-coach.png",
        params={
            "tag": "the coach",
            "line1": "Ask anything.\nGet a real answer.",
        },
    ),
    # 6. Refer / earn-free callout. Customer-as-hero ("you get") preserved.
    #    Each beat is one self-contained sentence — no mid-thought breaks.
    TemplateSpec(
        slug="callout-refer",
        template="callout",
        shot="09-refer.png",
        params={
            "tag": "earn free Able",
            "line1": "Three friends try Able.\nYou get a free month.",
        },
    ),
    # 7. After Able — paired with comparison-before. Green checks + success
    #    state language pulled from able-brand SKILL.md transformation copy.
    TemplateSpec(
        slug="comparison-after",
        template="comparison",
        shot="01-dashboard.png",
        params={
            "hook": "After Able",
            "mode": "after",
            "bullets": "|".join([
                "Nothing leaks. You see every dollar.",
                "Taxes set aside the moment money lands.",
                "Slow months stop feeling scary.",
                "A coach who knows your numbers.",
            ]),
        },
    ),
]


# ──────────────────────────────────────────────────────────────────────────
# BrandScript-language templates → marketing-footage/product-shots/templates-brandscript/
#
# Pulled verbatim from able-customer-research and able-brand SKILL.md. These
# use the load-bearing brand language (Freezer/Leaker quote patterns, the
# "wrong tool" hook, the "problem was never you" permission line, the Day 1-31
# narrative, the "From Unable → Able" transformation). Every line earned
# its place — none are paraphrases of brand language.
# ──────────────────────────────────────────────────────────────────────────
BRANDSCRIPT_TEMPLATES: list[TemplateSpec] = [
    # 1. The Freezer pain — verbatim quote pattern from able-customer-research.
    TemplateSpec(
        slug="bs-freezer",
        template="callout",
        shot="01-dashboard.png",
        folder="templates-brandscript",
        params={
            "tag": "the freezer",
            "line1": "When a deposit hits,\nyou don't know\nwhen the next one\nis coming.\nSo you don't touch it.",
        },
    ),
    # 2. The Leaker math — specific-number leak hook.
    TemplateSpec(
        slug="bs-leaker",
        template="callout",
        shot="03-plan-bills.png",
        folder="templates-brandscript",
        params={
            "tag": "the leaker",
            "line1": "By the 30th,\n$500 is gone.\nYou don't know where.",
        },
    ),
    # 3. Permission line — Able's load-bearing reframe. Two-beat structure:
    #    headline is the reframe, sub is the redirect. Tighter than 4-line
    #    headline (which overlapped the phone on 1x1 and 4x5).
    TemplateSpec(
        slug="bs-permission",
        template="hero-line",
        shot="01-dashboard.png",
        folder="templates-brandscript",
        params={
            "line1": "The problem\nwas never you.",
            "sub": "It was the advice you were handed.",
        },
    ),
    # 4. Wrong-tool hook — the differentiator vs YNAB / Mint / generic budgeting.
    TemplateSpec(
        slug="bs-wrong-tool",
        template="hero-line",
        shot="02-allocation-flow.png",
        folder="templates-brandscript",
        params={
            "line1": "Every budgeting app\nassumes a paycheck.\nYours isn't a paycheck.",
            "sub": "Able is built around variable income. Money in. Planned in 60 seconds.",
        },
    ),
    # 5. From Unable → Able — signature transformation. Phone shows 78/A score
    #    so the "After" state is visible in the asset itself. Arrow leads
    #    line 2 ("→ To Able") so each beat reads as one self-contained idea.
    TemplateSpec(
        slug="bs-transformation",
        template="hero-line",
        shot="04-score.png",
        folder="templates-brandscript",
        params={
            "line1": "From Unable.\n[arrow] To Able.",
            "sub": "Same income. Same bills. Different system. Different month.",
        },
    ),
    # 6. Success state — the "after" feature bullets. Pulled verbatim from
    #    able-social-media SKILL.md transformation hook.
    TemplateSpec(
        slug="bs-success",
        template="feature-bullets",
        shot="01-dashboard.png",
        folder="templates-brandscript",
        params={
            "eyebrow": "the shift",
            "hook": "Nothing leaked.\nBills paid.\nDebt killed.\nSavings grew.",
            "bullets": "|".join([
                "Every deposit allocated the moment it lands",
                "Taxes off the top, untouched",
                "Bills reserved before you spend",
                "Slow-month buffer building monthly",
                "Free spending, guilt-free",
            ]),
        },
    ),
    # 7. Day 1 ↔ Day 31 — the signature problem-frame. Carousel format so it
    #    can be slide 1 of an IG carousel that walks through Day 7 / 14 / 30.
    TemplateSpec(
        slug="bs-day-1-31",
        template="carousel-slide",
        shot="03-plan-bills.png",
        folder="templates-brandscript",
        params={
            "tag": "day 1 → day 31",
            "line1": 'Day 1: Money in.\nDay 31: "Where did $1,000 go?"',
        },
    ),
    # 8. JTBD — the core "tell me what's safe to spend" job. Customer-as-hero.
    TemplateSpec(
        slug="bs-jtbd-safe-to-spend",
        template="callout",
        shot="01-dashboard.png",
        folder="templates-brandscript",
        params={
            "tag": "what you see",
            "line1": "What's safe to spend\nright now.\nWithout guilt.",
        },
    ),
]


# Render both sets in one pass.
TEMPLATES = TEMPLATES + BRANDSCRIPT_TEMPLATES


def _port_open(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", port)); s.close(); return True
    except OSError:
        return False


def start_static_server() -> subprocess.Popen | None:
    if _port_open(PORT):
        print(f"[templates] reusing existing server on :{PORT}")
        return None
    print(f"[templates] starting static server on :{PORT}")
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


def build_url(spec: TemplateSpec, w: int, h: int) -> str:
    params = {
        "shot": spec.shot,
        "w": w, "h": h,
        "template": spec.template,
        **spec.params,
    }
    return FRAME_URL + "?" + urllib.parse.urlencode(params)


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    server = start_static_server()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--disable-dev-shm-usage", "--no-sandbox"],
            )
            for spec in TEMPLATES:
                folder_root = ROOT / "marketing-footage" / "product-shots" / spec.folder
                folder_root.mkdir(parents=True, exist_ok=True)
                out_dir = folder_root / spec.slug
                out_dir.mkdir(parents=True, exist_ok=True)
                print(f"[{spec.folder}] {spec.slug} ({spec.template}, shot={spec.shot})")
                for aspect, w, h in ASPECTS:
                    ctx = await browser.new_context(
                        viewport={"width": w, "height": h},
                        device_scale_factor=2,
                        bypass_csp=True,
                    )
                    page = await ctx.new_page()
                    page.on("pageerror", lambda e: print(f"  [pageerror] {e}"))
                    url = build_url(spec, w, h)
                    try:
                        await page.goto(url)
                        await page.wait_for_function(
                            "() => window.__shotReady === true",
                            timeout=10000,
                        )
                        # Let webfonts settle.
                        try:
                            await page.evaluate("() => document.fonts.ready")
                        except Exception:
                            pass
                        await page.wait_for_timeout(500)
                        out = out_dir / f"{aspect}.png"
                        await page.screenshot(
                            path=str(out),
                            clip={"x": 0, "y": 0, "width": w, "height": h},
                            scale="css",
                        )
                        print(f"   → {out.relative_to(ROOT)} ({out.stat().st_size // 1024}KB)")
                    except Exception as e:
                        print(f"  [error] {spec.slug}/{aspect}: {e}")
                    await ctx.close()
            await browser.close()
        print(f"\n[templates] done → {OUT_DIR.relative_to(ROOT)}/")
        print(f"           {len(TEMPLATES) * len(ASPECTS)} template PNGs")
    finally:
        if server:
            server.terminate()
            try:
                server.wait(timeout=2)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    asyncio.run(main())
