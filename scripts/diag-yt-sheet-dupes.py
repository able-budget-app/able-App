#!/usr/bin/env python3
"""
Read-only diagnostic: find duplicate slug/file_slug rows in the YouTube
upload tracker sheet. Run before youtube-upload.py to avoid the same slug
burning 1700 quota units twice and posting junk videos.

  python3 scripts/diag-yt-sheet-dupes.py            # long-form (yt-longform tab)
  python3 scripts/diag-yt-sheet-dupes.py --shorts   # shorts (yt-shorts tab)

Prints any slug that appears on more than one row, grouped by slug, with
sheet row number (1-based incl header), status, and youtube_video_id.
Does NOT modify the sheet.
"""
import argparse
import os
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parent.parent
SECRETS = ROOT / "secrets"
CREDS_FILE = SECRETS / "google-oauth-credentials.json"
TOKEN_FILE = SECRETS / "google-oauth-token.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/spreadsheets",
]


def get_credentials():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--shorts", action="store_true", help="Scan the shorts sheet/tab instead of long-form")
    p.add_argument("--sheet-id", help="Override SHEET_ID / SHORTS_SHEET_ID env var")
    p.add_argument("--tab", help="Override default tab name")
    args = p.parse_args()

    if args.shorts:
        sheet_id = args.sheet_id or os.environ.get("SHORTS_SHEET_ID") or os.environ.get("SHEET_ID")
        slug_col = "file_slug"
        tab = args.tab or os.environ.get("SHORTS_TAB") or "yt-shorts"
    else:
        sheet_id = args.sheet_id or os.environ.get("SHEET_ID")
        slug_col = "slug"
        tab = args.tab or os.environ.get("YT_LONGFORM_TAB") or "yt-longform"

    if not sheet_id:
        env_var = "SHORTS_SHEET_ID" if args.shorts else "SHEET_ID"
        sys.exit(f"error: pass --sheet-id or set {env_var}")

    creds = get_credentials()
    sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)

    res = sheets.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range=f"{tab}!A1:ZZ",
    ).execute()
    values = res.get("values", [])
    if not values:
        sys.exit(f"error: tab '{tab}' is empty")

    header, rows = values[0], values[1:]
    cols = {h.strip(): i for i, h in enumerate(header)}
    for c in (slug_col, "status", "youtube_video_id"):
        if c not in cols:
            sys.exit(f"error: missing column '{c}' in tab '{tab}'")

    by_slug = {}
    for i, row in enumerate(rows):
        row = row + [""] * (len(header) - len(row))
        slug = row[cols[slug_col]].strip()
        if not slug:
            continue
        sheet_row = i + 2  # 1-based + header
        status = row[cols["status"]].strip()
        vid = row[cols["youtube_video_id"]].strip()
        by_slug.setdefault(slug, []).append((sheet_row, status, vid))

    dupes = {s: hits for s, hits in by_slug.items() if len(hits) > 1}
    total_rows = sum(len(v) for v in by_slug.values())
    print(f"[diag] tab='{tab}'  unique slugs={len(by_slug)}  total non-empty rows={total_rows}")

    if not dupes:
        print("[diag] no duplicate slugs found ✓")
        return

    print(f"[diag] {len(dupes)} slug(s) appear more than once:\n")
    for slug, hits in sorted(dupes.items()):
        print(f"  {slug}  ({len(hits)}×)")
        for sheet_row, status, vid in hits:
            vid_disp = vid if vid else "(empty)"
            print(f"    row {sheet_row:>4}  status={status:<20}  video_id={vid_disp}")
        print()


if __name__ == "__main__":
    main()
