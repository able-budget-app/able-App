#!/usr/bin/env python3
"""Render every HTML in this directory to PNG at the size declared in its
   <meta name="canvas-size" content="WxH"> tag.

   Each brand asset is an HTML page that links to _brand.css. The HTML is
   the source of truth — change the file, re-run this script, get a new PNG.
   The shared CSS is deliberately copied from social/posts/_styles.css so
   the swoosh is byte-identical to the canonical B41 reference.

   Run from anywhere:

       python3 brand/_render.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent  # repo root — favicon variants land here

# Favicon variants the browsers / iOS / Android expect at site root.
FAVICON_SIZES = [
    ("favicon-16.png",       16),
    ("favicon-32.png",       32),
    ("apple-touch-icon.png", 180),
    ("icon-192.png",         192),
    ("icon-512.png",         512),
]

SIZE_RE = re.compile(
    r'<meta\s+name="canvas-size"\s+content="(\d+)x(\d+)"',
    re.IGNORECASE,
)


def extract_size(html_text: str) -> tuple[int, int]:
    m = SIZE_RE.search(html_text)
    if not m:
        raise ValueError(
            'HTML missing <meta name="canvas-size" content="WxH"> tag'
        )
    return int(m.group(1)), int(m.group(2))


def render_html(html_path: Path, out_path: Path, page) -> None:
    text = html_path.read_text()
    w, h = extract_size(text)
    page.set_viewport_size({"width": w, "height": h})
    page.goto(html_path.as_uri(), wait_until="networkidle")
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(250)
    page.screenshot(
        path=str(out_path),
        omit_background=False,
        clip={"x": 0, "y": 0, "width": w, "height": h},
    )
    print(f"  {out_path.name}  {w}x{h}")


SVG_SIZE_RE = re.compile(
    r'<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"',
    re.IGNORECASE,
)


def render_svg(svg_path: Path, out_path: Path, page, override_size: int | None = None) -> None:
    """Render an SVG to PNG. Size is taken from the SVG's width/height attributes
    unless override_size is given (used for favicon variants)."""
    svg = svg_path.read_text()
    if override_size is not None:
        w = h = override_size
    else:
        m = SVG_SIZE_RE.search(svg)
        if not m:
            raise ValueError(f"{svg_path.name}: missing width/height")
        w, h = int(m.group(1)), int(m.group(2))
    html = f"""<!doctype html>
<html><head><meta charset='utf-8'>
<style>
  html, body {{ margin: 0; padding: 0; background: transparent; }}
  body {{ width: {w}px; height: {h}px; }}
  svg {{ display: block; width: {w}px; height: {h}px; }}
</style></head>
<body>{svg}</body></html>"""
    page.set_viewport_size({"width": w, "height": h})
    page.set_content(html, wait_until="networkidle")
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(150)
    page.screenshot(
        path=str(out_path),
        omit_background=False,
        clip={"x": 0, "y": 0, "width": w, "height": h},
    )
    print(f"  {out_path.name}  {w}x{h}")


def main() -> int:
    htmls = sorted(p for p in HERE.glob("*.html"))
    svgs  = sorted(p for p in HERE.glob("*.svg"))
    if not htmls and not svgs:
        print("No HTML/SVG files found.")
        return 1

    favicon_svg = HERE / "favicon.svg"

    print(f"Rendering {len(htmls)} HTML + {len(svgs)} SVG from {HERE}:")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(device_scale_factor=1)
        page = context.new_page()
        for html in htmls:
            png = html.with_suffix(".png")
            render_html(html, png, page)
        for svg in svgs:
            png = svg.with_suffix(".png")
            render_svg(svg, png, page)

        # Favicon variants — drop into repo root for direct serving.
        if favicon_svg.exists():
            print(f"\nFavicon variants → {ROOT}:")
            # Copy the SVG itself (modern browsers prefer SVG).
            (ROOT / "favicon.svg").write_text(favicon_svg.read_text())
            print(f"  favicon.svg  (copied)")
            for name, size in FAVICON_SIZES:
                render_svg(favicon_svg, ROOT / name, page, override_size=size)

        browser.close()
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
