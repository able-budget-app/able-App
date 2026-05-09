#!/usr/bin/env python3
"""
Re-run JUST the transparent-bg compose pass for every shot in
marketing-footage/product-shots/_raw/. Faster than the full
capture-product-shots.py when the underlying raw screenshots haven't
changed and we only want to refresh the bare phone variant.

Output: marketing-footage/product-shots/<slug>/9x16-bare.png × 14.
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
OUT_DIR = ROOT / "marketing-footage" / "product-shots"
RAW_DIR = OUT_DIR / "_raw"
PORT = 8767
FRAME_URL = f"http://localhost:{PORT}/marketing-footage/product-shots/_frame.html"


def _port_open(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", port))
        s.close()
        return True
    except OSError:
        return False


def start_static_server() -> subprocess.Popen | None:
    if _port_open(PORT):
        return None
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


async def main() -> None:
    server = start_static_server()
    raw_files = sorted(RAW_DIR.glob("*.png"))
    if not raw_files:
        print(f"[bare] no raw shots found in {RAW_DIR.relative_to(ROOT)}/")
        return
    print(f"[bare] {len(raw_files)} shots to recompose with transparent bg")
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--disable-dev-shm-usage", "--no-sandbox"],
            )
            for raw in raw_files:
                slug = raw.stem  # e.g. "01-dashboard"
                out_dir = OUT_DIR / slug
                out_dir.mkdir(parents=True, exist_ok=True)
                out = out_dir / "9x16-bare.png"
                w, h = 1080, 1920
                ctx = await browser.new_context(
                    viewport={"width": w, "height": h},
                    device_scale_factor=2,
                    bypass_csp=True,
                )
                page = await ctx.new_page()
                page.on("pageerror", lambda e: print(f"  [pageerror] {e}"))
                try:
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
                except Exception as e:
                    print(f"  [error] {slug}: {e}")
                await ctx.close()
            await browser.close()
        print(f"\n[bare] done → {len(raw_files)} bare shots")
    finally:
        if server:
            server.terminate()
            try: server.wait(timeout=2)
            except subprocess.TimeoutExpired: server.kill()


if __name__ == "__main__":
    asyncio.run(main())
