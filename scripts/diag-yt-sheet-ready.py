#!/usr/bin/env python3
"""Read-only: dump every row where status='ready-to-upload' with its slug,
status, and youtube_video_id exactly as the uploader sees them."""
import os
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = ROOT / "secrets" / "google-oauth-token.json"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/spreadsheets",
]

creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
if not creds.valid and creds.expired and creds.refresh_token:
    creds.refresh(Request())

sheet_id = os.environ.get("SHEET_ID")
tab = os.environ.get("YT_LONGFORM_TAB", "yt-longform")
sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
res = sheets.spreadsheets().values().get(
    spreadsheetId=sheet_id, range=f"{tab}!A1:ZZ",
).execute()
values = res.get("values", [])
header, rows = values[0], values[1:]
cols = {h.strip(): i for i, h in enumerate(header)}
print(f"[diag] header columns: {list(cols.keys())}\n")

for i, row in enumerate(rows):
    row = row + [""] * (len(header) - len(row))
    status = row[cols["status"]].strip().lower()
    if status != "ready-to-upload":
        continue
    slug = row[cols["slug"]]
    vid = row[cols["youtube_video_id"]]
    sheet_row = i + 2
    print(f"row {sheet_row:>4}  slug=[{slug!r}]  vid=[{vid!r}]")
