#!/usr/bin/env python3
"""Render every HTML in ads/meta/ to PNG at the size declared in its
   <meta name="canvas-size" content="WxH"> tag.

   Mirrors brand/_render.py but scoped to this directory.

   Run from anywhere:

       python3 ads/meta/_render.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent

SIZE_RE = re.compile(
    r'<meta\s+name="canvas-size"\s+content="(\d+)x(\d+)"',
    re.IGNORECASE,
)


def main() -> int:
    htmls = sorted(p for p in HERE.glob("*.html"))
    if not htmls:
        print("No HTML files found.")
        return 1

    print(f"Rendering {len(htmls)} HTML from {HERE}:")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(device_scale_factor=1)
        page = context.new_page()
        for html in htmls:
            text = html.read_text()
            m = SIZE_RE.search(text)
            if not m:
                print(f"  SKIP {html.name} (no canvas-size meta)")
                continue
            w, h = int(m.group(1)), int(m.group(2))
            page.set_viewport_size({"width": w, "height": h})
            page.goto(html.as_uri(), wait_until="networkidle")
            page.evaluate("() => document.fonts.ready")
            page.wait_for_timeout(250)
            png = html.with_suffix(".png")
            page.screenshot(
                path=str(png),
                omit_background=False,
                clip={"x": 0, "y": 0, "width": w, "height": h},
            )
            print(f"  {png.name}  {w}x{h}")
        browser.close()
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
