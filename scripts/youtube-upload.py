#!/usr/bin/env python3
"""
Auto-upload Able videos to YouTube as Unlisted, write video IDs back to
the Google Sheet tracker. Picks the next N rows where status='ready-to-upload'
and youtube_video_id is empty. After a successful upload, status flips to
'uploaded' (still Unlisted). When you've reviewed them, flip Visibility to
Public manually in YouTube Studio.

Run:
  python3 scripts/youtube-upload.py                  # default --batch=5
  python3 scripts/youtube-upload.py --batch=3
  python3 scripts/youtube-upload.py --slug=taxes     # one specific video

Requires (one-time setup, see docs/youtube-api-setup.md):
  - secrets/google-oauth-credentials.json    (Desktop OAuth credentials)
  - SHEET_ID env var                          (Google Sheet ID)

First run kicks off the OAuth browser flow; saves token at
secrets/google-oauth-token.json for subsequent headless runs.

Per-upload cost: 1700 quota units (1600 upload + 50 thumbnail + 50 metadata).
Default daily quota: 10,000 → 5 uploads/day. Apply for an increase at
https://support.google.com/youtube/contact/yt_api_form to lift the cap.
"""
import argparse
import os
import random
import sys
import time
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

ROOT = Path(__file__).resolve().parent.parent
SECRETS = ROOT / "secrets"
SECRETS.mkdir(exist_ok=True)
CREDS_FILE = SECRETS / "google-oauth-credentials.json"
TOKEN_FILE = SECRETS / "google-oauth-token.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/spreadsheets",
]

CATEGORY_ID = "27"   # Education
PRIVACY = "unlisted" # Default — review in Studio before flipping to public
SLEEP_BETWEEN = 90   # seconds, throttles uploads to look human


def _execute_with_retry(req, attempts=4, base_delay=2.0):
    """Run a googleapiclient request with exponential backoff on transient errors.
    Retries on 429/500/502/503/504; re-raises on auth, quota, or other 4xx."""
    for n in range(attempts):
        try:
            return req.execute()
        except HttpError as e:
            status = getattr(e.resp, "status", 0)
            if status not in (429, 500, 502, 503, 504) or n == attempts - 1:
                raise
            delay = base_delay * (2 ** n) + random.uniform(0, 1)
            print(f"  [retry] Google API {status}, sleeping {delay:.1f}s ({n + 1}/{attempts - 1})", file=sys.stderr)
            time.sleep(delay)


def get_credentials():
    if not CREDS_FILE.exists():
        sys.exit(
            f"\nMissing {CREDS_FILE.relative_to(ROOT)}.\n"
            f"Follow docs/youtube-api-setup.md to create the OAuth credentials,\n"
            f"download as JSON, and save as the path above.\n"
        )
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


def get_sheet_rows(sheets_svc, sheet_id):
    """Return the header row + data rows of the first tab of the sheet."""
    req = sheets_svc.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range="A1:ZZ",
    )
    res = _execute_with_retry(req)
    values = res.get("values", [])
    if not values:
        return [], []
    return values[0], values[1:]


def col_letter(idx: int) -> str:
    """0 → A, 25 → Z, 26 → AA."""
    out = ""
    while True:
        out = chr(ord("A") + idx % 26) + out
        idx = idx // 26 - 1
        if idx < 0:
            return out


def update_cell(sheets_svc, sheet_id, row_idx_1based, col_idx, value):
    cell = f"{col_letter(col_idx)}{row_idx_1based}"
    req = sheets_svc.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range=cell,
        valueInputOption="RAW",
        body={"values": [[value]]},
    )
    _execute_with_retry(req)


def upload_video(youtube, mp4_path: Path, title: str, description: str, tags_str: str):
    tags = [t.strip() for t in tags_str.split(",") if t.strip()]
    body = {
        "snippet": {
            "title": title[:100],          # YouTube hard cap
            "description": description[:5000],
            "tags": tags[:30],
            "categoryId": CATEGORY_ID,
            "defaultLanguage": "en",
        },
        "status": {
            "privacyStatus": PRIVACY,
            "madeForKids": False,
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(str(mp4_path), mimetype="video/mp4", resumable=True, chunksize=8 * 1024 * 1024)
    req = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    last_pct = -1
    while response is None:
        status, response = req.next_chunk(num_retries=3)
        if status:
            pct = int(status.progress() * 100)
            if pct != last_pct:
                sys.stdout.write(f"\r    upload {pct}%")
                sys.stdout.flush()
                last_pct = pct
    sys.stdout.write("\n")
    return response["id"]


def set_thumbnail(youtube, video_id: str, thumb_path: Path):
    req = youtube.thumbnails().set(
        videoId=video_id,
        media_body=MediaFileUpload(str(thumb_path), mimetype="image/png"),
    )
    _execute_with_retry(req)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--batch", type=int, default=5, help="Max uploads this run (default 5; YouTube quota allows ~5/day)")
    p.add_argument("--slug", help="Upload only this slug (overrides --batch)")
    p.add_argument("--sheet-id", help="Google Sheet ID (or set SHEET_ID env)")
    p.add_argument("--dry-run", action="store_true", help="Show what would be uploaded; don't actually upload")
    args = p.parse_args()

    sheet_id = args.sheet_id or os.environ.get("SHEET_ID")
    if not sheet_id:
        sys.exit("error: pass --sheet-id or set SHEET_ID env var (the long string from the sheet's URL)")

    creds = get_credentials()
    sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
    youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)

    header, rows = get_sheet_rows(sheets, sheet_id)
    if not header:
        sys.exit("error: sheet is empty")

    cols = {h.strip(): i for i, h in enumerate(header)}
    required = ["slug", "status", "yt_title", "yt_description", "yt_tags", "youtube_video_id"]
    missing = [c for c in required if c not in cols]
    if missing:
        sys.exit(f"error: sheet is missing columns: {missing}")

    # Find queue
    queue = []
    for i, row in enumerate(rows):
        # Pad row so cols.get works
        row = row + [""] * (len(header) - len(row))
        slug = row[cols["slug"]].strip()
        status = row[cols["status"]].strip().lower()
        existing_id = row[cols["youtube_video_id"]].strip()
        if not slug or existing_id:
            continue
        if args.slug:
            if slug == args.slug:
                queue.append((i, row))
                break
        else:
            if status == "ready-to-upload":
                queue.append((i, row))

    if not queue:
        print("[upload] no rows to process")
        print(f"  rows where status='ready-to-upload' AND youtube_video_id is empty: 0")
        print(f"  → flip status to 'ready-to-upload' on a row to queue it")
        return

    if not args.slug:
        queue = queue[: args.batch]

    print(f"[upload] {len(queue)} video(s) queued")

    ok, fail = 0, 0
    for n, (i, row) in enumerate(queue, start=1):
        slug = row[cols["slug"]].strip()
        title = row[cols["yt_title"]].strip()
        description = row[cols["yt_description"]]
        tags = row[cols["yt_tags"]].strip()
        sheet_row_1based = i + 2  # 1-based, plus header

        mp4 = ROOT / f"article-video/videos/{slug}/out.mp4"
        thumb = ROOT / f"article-video/videos/{slug}/thumbnail.png"

        print(f"\n[{n}/{len(queue)}] {slug}")
        if not mp4.exists():
            print(f"  [skip] no mp4 at {mp4.relative_to(ROOT)}")
            fail += 1
            continue
        if not thumb.exists():
            print(f"  [skip] no thumbnail at {thumb.relative_to(ROOT)}")
            fail += 1
            continue
        if args.dry_run:
            print(f"  [dry] would upload {mp4.relative_to(ROOT)} → \"{title}\"")
            continue

        # Mark uploading so a re-run doesn't double-process
        update_cell(sheets, sheet_id, sheet_row_1based, cols["status"], "uploading")
        try:
            video_id = upload_video(youtube, mp4, title, description, tags)
            print(f"  [video] {video_id}")
            set_thumbnail(youtube, video_id, thumb)
            print(f"  [thumb] set")
            update_cell(sheets, sheet_id, sheet_row_1based, cols["youtube_video_id"], video_id)
            url = f"https://youtu.be/{video_id}"
            if "youtube_url" in cols:
                update_cell(sheets, sheet_id, sheet_row_1based, cols["youtube_url"], url)
            if "yt_published_date" in cols:
                update_cell(sheets, sheet_id, sheet_row_1based, cols["yt_published_date"], time.strftime("%Y-%m-%d"))
            update_cell(sheets, sheet_id, sheet_row_1based, cols["status"], "uploaded")
            ok += 1
        except HttpError as e:
            print(f"  [error] {e}")
            update_cell(sheets, sheet_id, sheet_row_1based, cols["status"], "failed")
            fail += 1
            if "quotaExceeded" in str(e):
                print(f"  [stop] quota exceeded — try again tomorrow or apply for increase")
                break

        if n < len(queue):
            print(f"  [pace] sleeping {SLEEP_BETWEEN}s before next upload")
            time.sleep(SLEEP_BETWEEN)

    print(f"\n[upload] done — ok:{ok} fail:{fail}")
    print(f"  next: review the {ok} uploaded video(s) in YouTube Studio,")
    print(f"  then flip Visibility from Unlisted → Public via Studio's bulk action.")


if __name__ == "__main__":
    main()
