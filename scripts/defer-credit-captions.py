#!/usr/bin/env python3
"""Set linkedin_status='deferred' on 8 credit-cluster rows.
Ship 3 (rows 27, 28, 30) stay at pending_review for normal approval."""
import os
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path('/Users/pauljohnson/Desktop/Able')
TOKEN = ROOT / 'secrets' / 'google-oauth-token.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

DEFER_ROWS = [
    (4,  "improve-your-credit-score/ (hub)"),
    (21, "automating-on-time-payments"),
    (22, "building-credit-from-scratch"),
    (23, "credit-mix-and-account-age"),
    (24, "disputing-errors-and-removing-collections"),
    (25, "fico-vs-vantagescore"),
    (26, "hard-vs-soft-inquiries"),
    (29, "pulling-and-reading-your-credit-report"),
]

creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
if not creds.valid and creds.expired and creds.refresh_token:
    creds.refresh(Request())
sheets = build('sheets', 'v4', credentials=creds, cache_discovery=False)
sheet_id = os.environ['SHEET_ID']

# linkedin_status = column AC (index 28)
data = [{'range': f'yt-longform!AC{r}', 'values': [['deferred']]} for r, _ in DEFER_ROWS]
res = sheets.spreadsheets().values().batchUpdate(
    spreadsheetId=sheet_id,
    body={'valueInputOption': 'RAW', 'data': data},
).execute()
print(f"[defer] updated cells: {res.get('totalUpdatedCells')}")
for r, label in DEFER_ROWS:
    print(f"  row {r}: linkedin_status → deferred  ({label})")
