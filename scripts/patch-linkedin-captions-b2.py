#!/usr/bin/env python3
"""Batch 2 fixes: rows 36 + 40 surplus-order drift."""
import os
import sys
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

PATCHES = [
    # #35 — row 36, how-to-handle-debt-with-variable-income — surplus drift
    (36, "how-to-handle-debt-with-variable-income", [(
        "Floor-First Budgeting is built around this. Every deposit fills the floor first: bills and tax set aside before anything else moves. What remains gets split across pay yourself, debt, and reserve. The reserve is what makes floor mode survivable when things slow down.",
        "Floor-First Budgeting is built around this. Every deposit fills the Floor first: bills and tax set aside before anything else moves. What remains builds your reserve, and debt payoff moves from what is left after that. The reserve is what makes floor mode survivable when things slow down.",
    )]),

    # #39 — row 40, why-getting-out-of-debt-feels-impossible — reserve must come before debt payoff
    (40, "why-getting-out-of-debt-feels-impossible", [(
        "Floor-First Budgeting gives every deposit an order of operations. The floor fills first: your bills and your tax set-aside. What remains gets split across debt payoff, reserve, and free spending. The extra debt payment is not optional, not left to willpower at the end of the month. It is built into every deposit before the money has a chance to leak.",
        "Floor-First Budgeting gives every deposit an order of operations. The Floor fills first: your bills and your tax set-aside. Your reserve fills next. What remains routes to debt payoff and free spending. The extra debt payment is not optional, not left to willpower at the end of the month. It is built into every deposit before the money has a chance to leak.",
    )]),
]


def main():
    creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not creds.valid and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    sheets = build('sheets', 'v4', credentials=creds, cache_discovery=False)
    sheet_id = os.environ['SHEET_ID']

    res = sheets.spreadsheets().values().get(
        spreadsheetId=sheet_id, range='yt-longform!A1:ZZ',
    ).execute()
    values = res.get('values', [])
    hdr = values[0]
    cols = {h.strip(): i for i, h in enumerate(hdr)}
    text_col = cols['linkedin_post_text']
    assert text_col == 27

    updates = []
    failures = []
    for sheet_row, label, replacements in PATCHES:
        row_idx = sheet_row - 2
        row = values[1:][row_idx] if row_idx < len(values) - 1 else []
        row = row + [''] * (len(hdr) - len(row))
        cur = row[text_col]
        new = cur
        for old, repl in replacements:
            if old not in new:
                failures.append((sheet_row, label, old[:80]))
                continue
            new = new.replace(old, repl)
        if new == cur:
            continue
        updates.append({'range': f'yt-longform!AB{sheet_row}', 'values': [[new]]})
        print(f"  row {sheet_row} ({label}): queued")

    if failures:
        for sheet_row, label, snip in failures:
            print(f"  row {sheet_row} ({label}): NOT FOUND — {snip!r}")
        sys.exit("aborting")

    if updates:
        res = sheets.spreadsheets().values().batchUpdate(
            spreadsheetId=sheet_id,
            body={'valueInputOption': 'RAW', 'data': updates},
        ).execute()
        print(f"\n[patch] updated cells: {res.get('totalUpdatedCells')}")


if __name__ == '__main__':
    main()
