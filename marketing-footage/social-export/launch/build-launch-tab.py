#!/usr/bin/env python3
"""
Build the Launch tab CSV for Able Content Engine sheet.

Reads launch-order.csv (this folder) and emits launch-tab-import.csv
formatted for the 28-column Content Engine schema. Drop the result into
a new tab named "Launch" in spreadsheet 1FcBz6Fqk1QHHj0-r-lly6DXUKHtLX5d83vcQHbi9pFY.
"""
from __future__ import annotations
import csv
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "launch-order.csv"
DST = HERE / "launch-tab-import.csv"

DAY_1_DATE = date(2026, 5, 20)

HEADERS = [
    "week", "day", "post_date", "format", "id", "slug", "theme", "week_theme",
    "notes", "punch", "filename", "drive_folder", "relevant_links",
    "caption_ig", "caption_tt", "caption_li", "caption_fb",
    "blog_url", "yt_short_url", "yt_long_url", "notebooklm_url", "repurpose_status",
    "status", "ig_url", "fb_url", "tt_url", "li_url", "posted_at",
]

SLUG_BY_ID = {
    "L01": "launch-now-live",
    "L02": "launch-five-jobs",
    "L03": "launch-wrong-tool",
    "L04": "launch-not-your-fault",
    "L05": "launch-the-fear",
    "C259": "designer-day-1-31",
    "LC1": "launch-how-it-works",
    "C111": "identity-sunday-calm",
    "C52": "floor-first-five-rules",
    "C56": "three-steps",
    "LC2": "launch-day-1-with-able",
    "C242": "brandscript-nothing-leaked",
    "C250": "brandscript-end-the-cycle",
    "C112": "identity-nothing-broke",
}

def build_filename(fmt: str, post_id: str, slug: str) -> str:
    if fmt.lower() == "carousel":
        return f"{post_id}_{slug}"
    return f"{post_id}_{slug}.png"

def build_drive_folder(fmt: str, post_id: str, slug: str) -> str:
    if fmt.lower() == "carousel":
        return f"social-export/carousels/{post_id}_{slug}"
    return "social-export/singles"

def main() -> None:
    rows_out: list[list[str]] = [HEADERS]
    with SRC.open() as f:
        for src in csv.DictReader(f):
            day = int(src["Day"])
            post_date = DAY_1_DATE + timedelta(days=day - 1)
            post_id = src["ID"]
            slug = SLUG_BY_ID[post_id]
            fmt = src["Format"].lower()
            filename = build_filename(fmt, post_id, slug)
            drive_folder = build_drive_folder(fmt, post_id, slug)
            cta = src["CTA_Link"]

            caption_ig = src["IG_FB_Caption"].rstrip()
            if src["Hashtags_IG_FB"]:
                caption_ig = f"{caption_ig}\n\n{src['Hashtags_IG_FB']}"

            caption_tt = src["TikTok_Caption"].rstrip()
            if src["Hashtags_TikTok"]:
                caption_tt = f"{caption_tt}\n\n{src['Hashtags_TikTok']}"

            li_body = src["LinkedIn_Caption"].rstrip()
            caption_li = f"{li_body}\n\n{cta}" if li_body else ""

            caption_fb = caption_ig.replace("Link in bio.", cta).replace("Link in bio", cta)

            is_posted_day_1 = (day == 1)
            status = "Posted" if is_posted_day_1 else "Pending"
            posted_at = post_date.isoformat() if is_posted_day_1 else ""

            rows_out.append([
                "Launch",
                str(day),
                post_date.isoformat(),
                fmt,
                post_id,
                slug,
                src["Theme"],
                "Launch",
                "",
                src["Hook"],
                filename,
                drive_folder,
                cta,
                caption_ig,
                caption_tt,
                caption_li,
                caption_fb,
                "", "", "", "", "",
                status,
                "", "", "", "",
                posted_at,
            ])

    with DST.open("w", newline="") as f:
        csv.writer(f).writerows(rows_out)

    print(f"Wrote {len(rows_out) - 1} rows to {DST}")

if __name__ == "__main__":
    main()
