#!/usr/bin/env python3
"""
Export Able social content as static assets.

Reads social/posts/data.js (POSTS, CAROUSELS, BRANDSCRIPT) and
social/reels/data.js (REELS) via headless Chromium, then writes:

  marketing-footage/social-export/
    singles/      {ID}_{slug}.png            (1080x1080, PNG)
    carousels/    {ID}_{slug}/01.png ...     (one per slide, 1080x1080 each)
    reels/        {ID}_{slug}.mp4            (1080x1920, H.264, 30fps, silent)

Brand-script entries (B01-B41) are exported into singles/ alongside
the numbered singles, since both render via posts/template.html.

Usage:
  python3 scripts/export-social.py                  # everything
  python3 scripts/export-social.py --singles
  python3 scripts/export-social.py --carousels
  python3 scripts/export-social.py --reels
  python3 scripts/export-social.py --only 55,B07,C45,R21
  python3 scripts/export-social.py --force          # re-export existing files

Requires:
  pip install playwright
  playwright install chromium
  ffmpeg + ffprobe in PATH (already used by record-clips.py)
"""
from __future__ import annotations

import argparse
import asyncio
import http.server
import shutil
import socketserver
import subprocess
import sys
import threading
from contextlib import closing
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "marketing-footage" / "social-export"
SINGLES_DIR   = OUT_DIR / "singles"
CAROUSELS_DIR = OUT_DIR / "carousels"
REELS_DIR     = OUT_DIR / "reels"
RAW_DIR       = OUT_DIR / "_raw"

PORT = 8766  # +1 from record-clips.py's 8765 to avoid clash if both run
SERVER_URL = f"http://localhost:{PORT}"

POST_W, POST_H = 1080, 1080   # singles + carousel slides
REEL_W, REEL_H = 1080, 1920   # reels
REEL_FPS = 30


# ─────────────────────────────────────────────────────────────────────
# Local static server (root = repo root, so /social/posts/... resolves)
# ─────────────────────────────────────────────────────────────────────
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args: Any) -> None: pass


def free_port(p: int) -> int:
    """If port is busy, pick the next free one."""
    for i in range(20):
        with closing(socket := __import__("socket").socket()) as s:
            try:
                s.bind(("127.0.0.1", p + i))
                return p + i
            except OSError:
                continue
    raise RuntimeError("no free port found")


def start_server() -> tuple[socketserver.ThreadingTCPServer, str]:
    global PORT, SERVER_URL
    PORT = free_port(PORT)
    SERVER_URL = f"http://localhost:{PORT}"
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), QuietHandler)
    httpd.RequestHandlerClass.directory = str(ROOT)  # type: ignore[attr-defined]
    # SimpleHTTPRequestHandler uses cwd by default; chdir to repo root
    import os; os.chdir(ROOT)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, SERVER_URL


# ─────────────────────────────────────────────────────────────────────
# Data extraction — eval data.js inside a real Chromium page so we
# don't have to parse JS object literals from Python.
# ─────────────────────────────────────────────────────────────────────
async def load_inventory(page) -> dict[str, list[dict]]:
    await page.goto(f"{SERVER_URL}/social/posts/template.html?id=01", wait_until="domcontentloaded")
    posts        = await page.evaluate("window.POSTS       || []")
    carousels    = await page.evaluate("window.CAROUSELS   || []")
    brandscript  = await page.evaluate("window.BRANDSCRIPT || []")
    # REELS lives in reels/data.js — load that page to read it
    await page.goto(f"{SERVER_URL}/social/reels/template.html?id=R1", wait_until="domcontentloaded")
    reels        = await page.evaluate("window.REELS || []")
    return {
        "posts": posts,
        "carousels": carousels,
        "brandscript": brandscript,
        "reels": reels,
    }


def filename_for(item: dict, format_kind: str) -> str:
    """ID_slug. e.g. 55_income-in-waves, B07_audience-built-for-ents."""
    return f"{item['id']}_{item['slug']}"


def already_exported(path: Path, force: bool) -> bool:
    return path.exists() and not force


# ─────────────────────────────────────────────────────────────────────
# Singles + brand-script (template.html?id=X)
# ─────────────────────────────────────────────────────────────────────
async def export_singles(page, items: list[dict], force: bool, label: str) -> int:
    SINGLES_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for it in items:
        out = SINGLES_DIR / f"{filename_for(it, 'single')}.png"
        if already_exported(out, force):
            print(f"  [skip] {out.name}")
            continue
        url = f"{SERVER_URL}/social/posts/template.html?id={it['id']}"
        await page.goto(url, wait_until="networkidle")
        await page.evaluate("document.fonts.ready")
        await page.wait_for_timeout(150)  # tiny settle
        post_el = page.locator(".post").first
        await post_el.screenshot(path=str(out), omit_background=False)
        count += 1
        print(f"  [{label}] {out.name}")
    return count


# ─────────────────────────────────────────────────────────────────────
# Carousels (carousel.html?id=X — all slides on one page)
# ─────────────────────────────────────────────────────────────────────
async def export_carousels(page, items: list[dict], force: bool) -> int:
    CAROUSELS_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for c in items:
        folder_name = filename_for(c, "carousel")
        folder = CAROUSELS_DIR / folder_name
        n_slides = len(c.get("slides", []))
        # Skip if all slides exist
        if not force and folder.exists() and len(list(folder.glob("*.png"))) == n_slides:
            print(f"  [skip] {folder_name}/ ({n_slides} slides)")
            continue
        folder.mkdir(parents=True, exist_ok=True)
        url = f"{SERVER_URL}/social/posts/carousel.html?id={c['id']}"
        await page.goto(url, wait_until="networkidle")
        await page.evaluate("document.fonts.ready")
        await page.wait_for_timeout(200)
        slide_els = page.locator(".slides .post")
        actual = await slide_els.count()
        if actual != n_slides:
            print(f"  [warn] {c['id']}: expected {n_slides} slides, found {actual}")
        for i in range(actual):
            out = folder / f"{(i+1):02d}.png"
            if already_exported(out, force):
                continue
            await slide_els.nth(i).screenshot(path=str(out))
        count += 1
        print(f"  [carousel] {folder_name}/ ({actual} slides)")
    return count


# ─────────────────────────────────────────────────────────────────────
# Reels (reels/template.html?id=X — auto-plays, capture as MP4)
# ─────────────────────────────────────────────────────────────────────
async def export_reels(playwright, items: list[dict], force: bool) -> int:
    REELS_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    browser = await playwright.chromium.launch(
        headless=True,
        args=["--disable-dev-shm-usage", "--no-sandbox"],
    )
    try:
        for r in items:
            out_mp4 = REELS_DIR / f"{filename_for(r, 'reel')}.mp4"
            if already_exported(out_mp4, force):
                print(f"  [skip] {out_mp4.name}")
                continue
            duration = float(r.get("durationSec", 15))
            raw_subdir = RAW_DIR / r["id"]
            if raw_subdir.exists():
                shutil.rmtree(raw_subdir)
            raw_subdir.mkdir(parents=True, exist_ok=True)

            # Fresh context per reel — Playwright records the entire context lifetime
            context = await browser.new_context(
                viewport={"width": REEL_W, "height": REEL_H},
                device_scale_factor=1,
                record_video_dir=str(raw_subdir),
                record_video_size={"width": REEL_W, "height": REEL_H},
                bypass_csp=True,
            )
            page = await context.new_page()
            url = f"{SERVER_URL}/social/reels/template.html?id={r['id']}"
            await page.goto(url, wait_until="networkidle")
            # Strip body padding + hide controls so .reel fills the viewport cleanly
            await page.add_style_tag(content="""
                html, body { padding: 0 !important; margin: 0 !important; background: #000; }
                .controls { display: none !important; }
            """)
            await page.evaluate("document.fonts.ready")
            await page.wait_for_timeout(300)  # let autoFitAndPlay apply .play classes
            await page.wait_for_timeout(int(duration * 1000) + 400)  # play through + tail
            await context.close()  # writes WebM

            # Locate the WebM Playwright wrote
            webms = list(raw_subdir.glob("*.webm"))
            if not webms:
                print(f"  [error] {r['id']}: no WebM written")
                continue
            webm = webms[0]
            transcode_to_mp4(webm, out_mp4, duration)
            count += 1
            print(f"  [reel] {out_mp4.name} ({duration:.1f}s)")
    finally:
        await browser.close()
    return count


def transcode_to_mp4(webm: Path, mp4: Path, target_seconds: float) -> None:
    """WebM → MP4 H.264 1080×1920 30fps + silent AAC, trimmed to target_seconds."""
    if mp4.exists():
        mp4.unlink()
    # Trim from the END of the WebM (Playwright recording stops promptly after
    # context.close, and the animation is at the tail). Using -sseof seeks from
    # end — captures exactly the last `target_seconds` of footage.
    cmd = [
        "ffmpeg", "-y",
        "-sseof", f"-{target_seconds + 0.4:.3f}",
        "-i", str(webm),
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-vf", f"scale={REEL_W}:{REEL_H}:flags=lanczos,fps={REEL_FPS}",
        "-t", f"{target_seconds:.3f}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        str(mp4),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Export Able social content")
    p.add_argument("--singles",     action="store_true", help="export singles + brand-script only")
    p.add_argument("--carousels",   action="store_true", help="export carousels only")
    p.add_argument("--reels",       action="store_true", help="export reels only")
    p.add_argument("--only",        type=str, default="", help="comma-separated IDs (e.g. 55,B07,C45,R21)")
    p.add_argument("--force",       action="store_true", help="re-export files that already exist")
    return p.parse_args()


def filter_ids(items: list[dict], only: set[str]) -> list[dict]:
    if not only:
        return items
    return [it for it in items if it["id"] in only]


async def main() -> None:
    args = parse_args()
    only_ids = set(s.strip() for s in args.only.split(",") if s.strip())

    # If no --singles/--carousels/--reels, do all
    do_all = not (args.singles or args.carousels or args.reels)
    do_singles   = do_all or args.singles
    do_carousels = do_all or args.carousels
    do_reels     = do_all or args.reels

    httpd, _ = start_server()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--disable-dev-shm-usage", "--no-sandbox"],
            )
            try:
                ctx = await browser.new_context(
                    viewport={"width": 1200, "height": 1200},
                    device_scale_factor=1,
                )
                page = await ctx.new_page()
                inv = await load_inventory(page)

                if do_singles:
                    posts = filter_ids(inv["posts"], only_ids)
                    bs    = filter_ids(inv["brandscript"], only_ids)
                    print(f"\n=== Singles ({len(posts)}) ===")
                    if posts: await export_singles(page, posts, args.force, "single")
                    print(f"\n=== Brand-script ({len(bs)}) ===")
                    if bs: await export_singles(page, bs, args.force, "brand")

                if do_carousels:
                    cars = filter_ids(inv["carousels"], only_ids)
                    print(f"\n=== Carousels ({len(cars)}) ===")
                    if cars: await export_carousels(page, cars, args.force)

                await ctx.close()
            finally:
                await browser.close()

            if do_reels:
                reels = filter_ids(inv["reels"], only_ids)
                print(f"\n=== Reels ({len(reels)}) ===")
                if reels: await export_reels(pw, reels, args.force)

    finally:
        httpd.shutdown()
        print(f"\nOutput: {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
