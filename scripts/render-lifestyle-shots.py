#!/usr/bin/env python3
"""
Render the lifestyle product-shot variants — phone mockup hovering over a
real-world stock photo (desk flat-lay, workspace, notebook scene).

Each spec produces 4 aspects × 1 PNG = 4 PNGs, output to
marketing-footage/product-shots/lifestyle/{slug}/{aspect}.png.

Run:    python3 scripts/render-lifestyle-shots.py
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
OUT_DIR = ROOT / "marketing-footage" / "product-shots" / "lifestyle"
PORT = 8767
FRAME_URL = f"http://localhost:{PORT}/marketing-footage/product-shots/_lifestyle.html"

ASPECTS = [
    ("9x16", 1080, 1920),
    ("1x1",  1080, 1080),
    ("4x5",  1080, 1350),
    ("16x9", 1920, 1080),
]


@dataclass
class LifestyleSpec:
    slug: str
    scene: str               # desk-coffee | workspace | notebook
    shot: str = "01-dashboard.png"
    theme: str = ""          # dark | light (auto from scene if empty)
    params: dict = field(default_factory=dict)
    wordmark_pos: str = "bottom-left"


# Scene defaults: desk-coffee is moody → dark theme (white copy on photo wash).
# workspace + notebook are bright → light theme (dark copy).
SCENE_THEME = {
    "desk-coffee": "dark",
    "workspace": "light",
    "notebook": "light",
}


# ──────────────────────────────────────────────────────────────────────────
# Lifestyle templates. Copy is pulled from:
#   1. The brand copy dump in product_shots_pivot_2026_04_27.md (verbatim)
#   2. The strongest punch lines mined from social-export/_master-sheet.csv
#
# Each scene gets ≥ 1 BARE variant (no copy, just phone + wordmark) plus
# multiple WITH-COPY variants. Bare shots are the highest-utility — drop
# into any blog header, ad, or social slot without being topic-locked.
# ──────────────────────────────────────────────────────────────────────────
LIFESTYLE: list[LifestyleSpec] = [
    # ── BARE (no copy) — one per scene, both wordmark positions ───────────
    LifestyleSpec(
        slug="bare-desk-coffee",
        scene="desk-coffee",
        params={"copy": "hide"},
    ),
    LifestyleSpec(
        slug="bare-workspace",
        scene="workspace",
        params={"copy": "hide"},
        wordmark_pos="bottom-right",
    ),
    LifestyleSpec(
        slug="bare-notebook",
        scene="notebook",
        params={"copy": "hide"},
        wordmark_pos="bottom-right",
    ),

    # ── desk-coffee scene (moody) → heavier copy ──────────────────────────
    # Permission line — Able's load-bearing reframe. Two-beat structure.
    LifestyleSpec(
        slug="desk-coffee-permission",
        scene="desk-coffee",
        params={
            "tag": "the reframe",
            "line1": "The problem\nwas never you.",
            "sub": "It was the advice you were handed.",
        },
    ),
    # Cost of waiting — short urgency punch.
    LifestyleSpec(
        slug="desk-coffee-cost-of-waiting",
        scene="desk-coffee",
        params={
            "tag": "the math",
            "line1": "Every month you wait\nis another\n$500–$1,000 gone.",
            "sub": "The leak doesn't pause while you figure it out.",
        },
    ),
    # Wrong-tool hook (verbatim from social punch lines).
    LifestyleSpec(
        slug="desk-coffee-wrong-tool",
        scene="desk-coffee",
        shot="02-allocation-flow.png",
        params={
            "tag": "the diagnosis",
            "line1": "You're not bad\nwith money.",
            "sub": "You've been handed the wrong tool.",
        },
    ),
    # Freezer pain — quote-pattern from able-customer-research.
    LifestyleSpec(
        slug="desk-coffee-freezer",
        scene="desk-coffee",
        params={
            "tag": "the freeze",
            "line1": "If money makes\nyou freeze,\nyou're not lazy.",
            "sub": "You're under-equipped.",
        },
    ),

    # ── workspace scene (bright) → success / breath copy ──────────────────
    # Hero bookend — Able's signature transformation line.
    LifestyleSpec(
        slug="workspace-breathe",
        scene="workspace",
        shot="02-allocation-flow.png",
        params={
            "tag": "what changes",
            "line1": "From holding\nyour breath\n[arrow] To finally\nable to breathe.",
            "sub": "Money in. Planned in 60 seconds. Calm for the rest of the month.",
        },
    ),
    # Calm-as-feature.
    LifestyleSpec(
        slug="workspace-calm-feature",
        scene="workspace",
        params={
            "tag": "by design",
            "line1": "Calm is a feature.\nNot a side effect.",
            "sub": "Built for income that doesn't follow a paycheck schedule.",
        },
    ),
    # Same income, different feeling.
    LifestyleSpec(
        slug="workspace-same-income",
        scene="workspace",
        shot="04-score.png",
        params={
            "tag": "after Able",
            "line1": "Same income.\nDifferent feeling.",
            "sub": "Same bills. Different system. Different month.",
        },
    ),
    # Tagline — positioning line.
    LifestyleSpec(
        slug="workspace-tagline",
        scene="workspace",
        params={
            "line1": "An app built\nfor entrepreneurs\nwith inconsistent\nincome.",
            "sub": "becomeable.app",
        },
    ),

    # ── notebook scene (bright horizontal-friendly) ───────────────────────
    # Wordmark goes bottom-right because spiral-notebook lives bottom-left.
    # Outcome bullets — pulled from "Become able" identity transformation.
    LifestyleSpec(
        slug="notebook-become-able",
        scene="notebook",
        params={
            "tag": "this is what changes",
            "line1": "Become able.",
            "sub": "Able to pay debt. To save without second-guessing. To predict what's coming.",
        },
        wordmark_pos="bottom-right",
    ),
    # Bills paid, taxes covered, nothing leaked.
    LifestyleSpec(
        slug="notebook-no-leaks",
        scene="notebook",
        params={
            "tag": "the shift",
            "line1": "Bills paid.\nTaxes covered.\nNothing leaked.",
            "sub": "Every deposit, already sorted.",
        },
        wordmark_pos="bottom-right",
    ),
    # One pile, five jobs.
    LifestyleSpec(
        slug="notebook-one-pile",
        scene="notebook",
        shot="02-allocation-flow.png",
        params={
            "tag": "the system",
            "line1": "One pile.\nFive jobs.",
            "sub": "Split first. Spend last.",
        },
        wordmark_pos="bottom-right",
    ),
    # Calm beats panic.
    LifestyleSpec(
        slug="notebook-boring-goal",
        scene="notebook",
        params={
            "tag": "the goal",
            "line1": "Boring is the goal.",
            "sub": "Specific is how you get there.",
        },
        wordmark_pos="bottom-right",
    ),
]


def _port_open(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", port)); s.close(); return True
    except OSError:
        return False


def start_static_server() -> subprocess.Popen | None:
    if _port_open(PORT):
        print(f"[lifestyle] reusing existing server on :{PORT}")
        return None
    print(f"[lifestyle] starting static server on :{PORT}")
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


def build_url(spec: LifestyleSpec, w: int, h: int) -> str:
    theme = spec.theme or SCENE_THEME.get(spec.scene, "light")
    params = {
        "scene": spec.scene,
        "shot": spec.shot,
        "w": w, "h": h,
        "theme": theme,
        "wordmarkPos": spec.wordmark_pos,
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
            for spec in LIFESTYLE:
                out_dir = OUT_DIR / spec.slug
                out_dir.mkdir(parents=True, exist_ok=True)
                print(f"[lifestyle] {spec.slug} ({spec.scene}, shot={spec.shot})")
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
                            "() => window.__shotReady === true && window.__bgReady === true",
                            timeout=15000,
                        )
                        try:
                            await page.evaluate("() => document.fonts.ready")
                        except Exception:
                            pass
                        await page.wait_for_timeout(600)
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
        print(f"\n[lifestyle] done → {OUT_DIR.relative_to(ROOT)}/")
        print(f"           {len(LIFESTYLE) * len(ASPECTS)} lifestyle PNGs ({len(LIFESTYLE)} templates × 4 aspects)")
    finally:
        if server:
            server.terminate()
            try:
                server.wait(timeout=2)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    asyncio.run(main())
