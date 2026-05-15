#!/usr/bin/env python3
"""
Read the YouTube tracker sheet and inject `youtube_id` (+ `youtube_uploaded`
date) into the corresponding article frontmatter under `able-content/`.
Matches sheet rows to article files by `slug`. Idempotent — re-running with no
new uploads is a no-op.

Run:
  python3 scripts/inject-youtube-ids.py             # patch all matching files
  python3 scripts/inject-youtube-ids.py --dry-run   # show what would change
  python3 scripts/inject-youtube-ids.py --build     # also run build-resources.py after

Requires the same auth as scripts/youtube-upload.py:
  - secrets/google-oauth-token.json (created by youtube-upload.py first run)
  - SHEET_ID env var

Sheet columns consumed: page_url, youtube_video_id, yt_published_date.
Articles are matched by their frontmatter `url:` field against the sheet's
`page_url` column (sheet's `slug` is a cluster-composite, frontmatter slug is bare).
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "able-content"
TOKEN_FILE = ROOT / "secrets" / "google-oauth-token.json"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/spreadsheets",
]


def load_creds():
    if not TOKEN_FILE.exists():
        sys.exit(
            f"Missing {TOKEN_FILE.relative_to(ROOT)}. "
            f"Run scripts/youtube-upload.py --dry-run first to complete the OAuth flow."
        )
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def read_sheet(sheet_id: str, tab: str) -> dict:
    """Return {page_url: {video_id, published_date}} for rows where video_id is populated."""
    creds = load_creds()
    sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
    res = sheets.spreadsheets().values().get(
        spreadsheetId=sheet_id, range=f"{tab}!A1:ZZ"
    ).execute()
    values = res.get("values", [])
    if not values:
        sys.exit("error: sheet is empty")

    header = values[0]
    rows = values[1:]
    cols = {h.strip(): i for i, h in enumerate(header)}
    for required in ("page_url", "youtube_video_id"):
        if required not in cols:
            sys.exit(f"error: sheet is missing column: {required}")

    out = {}
    for row in rows:
        row = row + [""] * (len(header) - len(row))
        url = row[cols["page_url"]].strip()
        vid = row[cols["youtube_video_id"]].strip()
        if not url or not vid:
            continue
        out[url] = {
            "video_id": vid,
            "published_date": (
                row[cols["yt_published_date"]].strip()
                if "yt_published_date" in cols else ""
            ),
        }
    return out


SLUG_RE = re.compile(r"^slug:\s*(.+?)\s*$", re.MULTILINE)
URL_RE = re.compile(r"^url:\s*(.+?)\s*$", re.MULTILINE)
YID_RE = re.compile(r"^youtube_id:\s*\"?([^\"\n]+)\"?\s*$", re.MULTILINE)
YUP_RE = re.compile(r"^youtube_uploaded:\s*\"?([^\"\n]+)\"?\s*$", re.MULTILINE)
CLUSTER_RE = re.compile(r"^cluster:\s*.+$", re.MULTILINE)


def split_frontmatter(text: str):
    """Return (frontmatter_str, body_str) or (None, text) if no frontmatter."""
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return None, text
    return text[4:end], text[end + 5:]


def patch_frontmatter(fm: str, video_id: str, uploaded_date: str) -> str:
    """Idempotently set youtube_id and youtube_uploaded in the frontmatter block."""
    new_yid = f'youtube_id: "{video_id}"'
    new_yup = f'youtube_uploaded: "{uploaded_date}"' if uploaded_date else ""

    if YID_RE.search(fm):
        fm = YID_RE.sub(new_yid, fm)
    else:
        # Insert after `cluster:` line if present, otherwise after `slug:`
        anchor = CLUSTER_RE.search(fm) or SLUG_RE.search(fm)
        if anchor:
            insert_at = anchor.end()
            fm = fm[:insert_at] + "\n" + new_yid + fm[insert_at:]
        else:
            fm = fm + "\n" + new_yid

    if uploaded_date:
        if YUP_RE.search(fm):
            fm = YUP_RE.sub(new_yup, fm)
        else:
            # Insert right after the youtube_id line
            yid_match = YID_RE.search(fm)
            if yid_match:
                insert_at = yid_match.end()
                fm = fm[:insert_at] + "\n" + new_yup + fm[insert_at:]

    return fm


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--sheet-id", help="Google Sheet ID (or SHEET_ID env var)")
    p.add_argument("--tab", help="Sheet tab name (or YT_LONGFORM_TAB env var, default 'yt-longform')")
    p.add_argument("--dry-run", action="store_true", help="Show changes without writing")
    p.add_argument("--build", action="store_true", help="Run build-resources.py after patching")
    args = p.parse_args()

    sheet_id = args.sheet_id or os.environ.get("SHEET_ID")
    if not sheet_id:
        sys.exit("error: pass --sheet-id or set SHEET_ID env var")
    tab = args.tab or os.environ.get("YT_LONGFORM_TAB") or "yt-longform"

    sheet_data = read_sheet(sheet_id, tab)
    print(f"[inject] {len(sheet_data)} sheet row(s) have a youtube_video_id")

    # Index articles by url (frontmatter `url:` field — unambiguous across clusters)
    md_files = list(CONTENT_DIR.rglob("*.md"))
    by_url = {}
    for md in md_files:
        text = md.read_text()
        fm, _ = split_frontmatter(text)
        if not fm:
            continue
        m = URL_RE.search(fm)
        if m:
            by_url[m.group(1).strip().strip('"')] = md

    updated, unchanged, missing = 0, 0, []
    for url, data in sheet_data.items():
        md = by_url.get(url)
        if not md:
            missing.append(url)
            continue
        text = md.read_text()
        fm, body = split_frontmatter(text)
        if not fm:
            print(f"  [skip] {md.relative_to(ROOT)} — no frontmatter")
            continue

        existing_yid = YID_RE.search(fm)
        if existing_yid and existing_yid.group(1).strip() == data["video_id"]:
            unchanged += 1
            continue

        new_fm = patch_frontmatter(fm, data["video_id"], data["published_date"])
        new_text = "---\n" + new_fm + "\n---\n" + body

        rel = md.relative_to(ROOT)
        if args.dry_run:
            print(f"  [dry] {rel} ← youtube_id: {data['video_id']}")
        else:
            md.write_text(new_text)
            print(f"  [write] {rel} ← youtube_id: {data['video_id']}")
        updated += 1

    print(f"\n[inject] updated:{updated} unchanged:{unchanged} missing:{len(missing)}")
    if missing:
        print(f"  page_urls in sheet with no matching article file:")
        for u in missing:
            print(f"    {u}")

    if args.build and not args.dry_run and updated > 0:
        print(f"\n[build] running build-resources.py")
        subprocess.run(
            ["python3", "scripts/build-resources.py", "able-content"],
            cwd=ROOT, check=True,
        )


if __name__ == "__main__":
    main()
