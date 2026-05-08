#!/usr/bin/env python3
"""
Render the Plaid digital-handshake illustration at 4 aspect ratios.

Output: marketing-footage/illustrations/plaid-handshake/{aspect}.png

Run: python3 scripts/render-plaid-handshake.py
"""
from __future__ import annotations

import asyncio
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "marketing-footage" / "illustrations" / "_plaid-handshake.html"
OUT_DIR = ROOT / "marketing-footage" / "illustrations" / "plaid-handshake"
PORT = 8768

ASPECTS = [
    ("9x16", 1080, 1920),
    ("1x1",  1080, 1080),
    ("4x5",  1080, 1350),
    ("16x9", 1920, 1080),
]


def _port_open(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", port)); s.close(); return True
    except OSError:
        return False


def start_server() -> subprocess.Popen | None:
    if _port_open(PORT):
        print(f"[handshake] reusing existing server on :{PORT}")
        return None
    print(f"[handshake] starting static server on :{PORT}")
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        if _port_open(PORT): return proc
        time.sleep(0.1)
    raise RuntimeError("static server failed to start")


async def capture_aspect(page, aspect: str, w: int, h: int) -> None:
    out = OUT_DIR / f"{aspect}.png"
    await page.set_viewport_size({"width": w, "height": h})
    url = f"http://localhost:{PORT}/marketing-footage/illustrations/_plaid-handshake.html?aspect={aspect}&w={w}&h={h}"
    await page.goto(url)
    await page.wait_for_function("() => window.__shotReady === true", timeout=10000)
    await page.wait_for_timeout(250)
    await page.screenshot(
        path=str(out),
        clip={"x": 0, "y": 0, "width": w, "height": h},
        scale="device",
    )
    print(f"   → {out.relative_to(ROOT)} ({out.stat().st_size // 1024}KB)")


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    server = start_server()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, args=["--no-sandbox"])
            print("\n[handshake] === rendering 4 aspects ===")
            for aspect, w, h in ASPECTS:
                ctx = await browser.new_context(
                    viewport={"width": w, "height": h},
                    device_scale_factor=2,
                )
                page = await ctx.new_page()
                page.on("pageerror", lambda e: print(f"  [pageerror] {e}"))
                try:
                    await capture_aspect(page, aspect, w, h)
                except Exception as e:
                    print(f"  [error] {aspect}: {e}")
                await ctx.close()
            await browser.close()
        print(f"\n[handshake] done → {OUT_DIR.relative_to(ROOT)}/")
        print(f"           {len(ASPECTS)} PNGs")
    finally:
        if server: server.terminate()


if __name__ == "__main__":
    asyncio.run(main())
