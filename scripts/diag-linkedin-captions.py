#!/usr/bin/env python3
"""Read-only: dump the first N linkedin_post_text entries with metadata."""
import argparse
import os
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path('/Users/pauljohnson/Desktop/Able')
TOKEN = ROOT / 'secrets' / 'google-oauth-token.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

p = argparse.ArgumentParser()
p.add_argument("--count", type=int, default=20)
p.add_argument("--skip", type=int, default=0, help="skip the first N eligible rows")
args = p.parse_args()

creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
if not creds.valid and creds.expired and creds.refresh_token:
    creds.refresh(Request())
sheets = build('sheets','v4',credentials=creds,cache_discovery=False)
res = sheets.spreadsheets().values().get(
    spreadsheetId=os.environ['SHEET_ID'],
    range='yt-longform!A1:ZZ',
).execute()
v = res.get('values', [])
hdr = v[0]; cols = {h.strip():i for i,h in enumerate(hdr)}

hits = []
for i, row in enumerate(v[1:]):
    row = row + ['']*(len(hdr)-len(row))
    text = row[cols['linkedin_post_text']].strip()
    if not text:
        continue
    hits.append({
        'sheet_row': i + 2,
        'slug': row[cols['slug']],
        'page_url': row[cols['page_url']],
        'video_id': row[cols['youtube_video_id']],
        'linkedin_status': row[cols['linkedin_status']],
        'linkedin_scheduled_date': row[cols['linkedin_scheduled_date']],
        'text': text,
    })

print(f"[diag] total rows with linkedin_post_text: {len(hits)}")
print(f"[diag] showing rows {args.skip+1}..{args.skip+args.count}\n")

for n, h in enumerate(hits[args.skip:args.skip+args.count], start=args.skip+1):
    print(f"{'='*72}")
    print(f"#{n}  row {h['sheet_row']}  status={h['linkedin_status']}  date={h['linkedin_scheduled_date']}")
    print(f"  slug: {h['slug']}")
    print(f"  url:  {h['page_url']}")
    print(f"  vid:  {h['video_id']}")
    print(f"{'-'*72}")
    print(h['text'])
    print()
