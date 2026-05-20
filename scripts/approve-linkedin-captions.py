#!/usr/bin/env python3
"""Flip linkedin_status='approved' on the row list passed in via the APPROVE
constant. Run iteratively as we work through batches."""
import os
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path('/Users/pauljohnson/Desktop/Able')
TOKEN = ROOT / 'secrets' / 'google-oauth-token.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# Edit this list per run. Format: (row_1based, slug_short_label)
APPROVE = [
    (122, "estimated-tax-penalties"),
    (123, "sales-tax-basics"),
    (124, "setting-financial-goals-variable"),
    (125, "true-cost-of-debt"),
    (126, "emergency-fund-vs-business-reserve"),
    (127, "cost-of-financial-decision"),
    (128, "avalanche-vs-snowball-variable"),
    (129, "negotiating-with-creditors-self-emp"),
    (130, "inconsistent-income-data-hub"),
    (131, "why-87-percent-struggle"),
    (132, "inside-77-million-variable-income"),
]

creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
if not creds.valid and creds.expired and creds.refresh_token:
    creds.refresh(Request())
sheets = build('sheets', 'v4', credentials=creds, cache_discovery=False)
sheet_id = os.environ['SHEET_ID']

# linkedin_status = column AC (index 28)
data = [{'range': f'yt-longform!AC{r}', 'values': [['approved']]} for r, _ in APPROVE]
res = sheets.spreadsheets().values().batchUpdate(
    spreadsheetId=sheet_id,
    body={'valueInputOption': 'RAW', 'data': data},
).execute()
print(f"[approve] updated cells: {res.get('totalUpdatedCells')}")
for r, label in APPROVE:
    print(f"  row {r}: linkedin_status → approved  ({label})")
