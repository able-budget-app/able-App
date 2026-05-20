#!/usr/bin/env python3
"""Sweep patch: 3 remaining issues found across all 131 captions."""
import os
import sys
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path('/Users/pauljohnson/Desktop/Able')
TOKEN = ROOT / 'secrets' / 'google-oauth-token.json'
SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/spreadsheets']

PATCHES = [
    # Row 62 owner-pay-ladder — "smoothing reserve" + auto-routing
    (62, "owner-pay-ladder", [
        (
            "your smoothing reserve has not had to release in six months",
            "your reserve has not had to release in six months",
        ),
        (
            "transferred on the same day each month, paid by a reserve that absorbs the business's variability so your personal life does not feel it.",
            "transferred on the same day each month, with the reserve as the cushion you pull from when business deposits run thin so your personal life does not feel it.",
        ),
    ]),

    # Row 114 the-good-month-rules — em dash → comma
    (114, "the-good-month-rules", [(
        "Your brain reads \"surplus\" and starts spending against it — a nicer dinner, a trip, an upgrade that felt earned.",
        "Your brain reads \"surplus\" and starts spending against it: a nicer dinner, a trip, an upgrade that felt earned.",
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

    updates, failures = [], []
    for sheet_row, label, replacements in PATCHES:
        row_idx = sheet_row - 2
        row = values[1:][row_idx] if row_idx < len(values) - 1 else []
        row = row + [''] * (len(hdr) - len(row))
        cur = row[text_col]
        new = cur
        for old, repl in replacements:
            if old not in new:
                failures.append((sheet_row, label, old[:90]))
                continue
            new = new.replace(old, repl)
        if new == cur:
            continue
        updates.append({'range': f'yt-longform!AB{sheet_row}', 'values': [[new]]})
        print(f"  row {sheet_row} ({label}): queued — {len(replacements)} replacement(s)")

    if failures:
        for sheet_row, label, snip in failures:
            print(f"  FAIL row {sheet_row} ({label}): {snip!r}")
        sys.exit("aborting")

    if updates:
        res = sheets.spreadsheets().values().batchUpdate(
            spreadsheetId=sheet_id,
            body={'valueInputOption': 'RAW', 'data': updates},
        ).execute()
        print(f"\n[patch] updated cells: {res.get('totalUpdatedCells')}")


if __name__ == '__main__':
    main()
