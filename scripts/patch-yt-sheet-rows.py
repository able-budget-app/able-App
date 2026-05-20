#!/usr/bin/env python3
"""One-shot: patch slug + page_url for rows 130/131/132 in yt-longform."""
import os
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path('/Users/pauljohnson/Desktop/Able')
TOKEN = ROOT / 'secrets' / 'google-oauth-token.json'
SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/spreadsheets',
]
creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
if not creds.valid and creds.expired and creds.refresh_token:
    creds.refresh(Request())
sheets = build('sheets', 'v4', credentials=creds, cache_discovery=False)
sheet_id = os.environ['SHEET_ID']

# slug = column A (0), page_url = column B (1) per header dump
PATCH = [
    (130, 'learn-inconsistent-income-data',
          '/learn/inconsistent-income-data/'),
    (131, 'learn-inconsistent-income-data-why-87-percent-struggle-to-budget',
          '/learn/inconsistent-income-data/why-87-percent-struggle-to-budget/'),
    (132, 'learn-inconsistent-income-data-inside-77-million-variable-income-workers',
          '/learn/inconsistent-income-data/inside-77-million-variable-income-workers/'),
]

data = []
for row, slug, url in PATCH:
    data.append({'range': f'yt-longform!A{row}:B{row}', 'values': [[slug, url]]})

body = {'valueInputOption': 'RAW', 'data': data}
res = sheets.spreadsheets().values().batchUpdate(
    spreadsheetId=sheet_id, body=body,
).execute()
print(f"[patch] updated cells: {res.get('totalUpdatedCells')}")
for row, slug, url in PATCH:
    print(f"  row {row}: slug={slug}")
    print(f"            url={url}")
