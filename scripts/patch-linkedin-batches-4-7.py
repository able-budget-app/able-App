#!/usr/bin/env python3
"""Batch 4-7 audit fixes: surplus-order drift, product overclaims, auto-routing
phrases, vocab inconsistencies."""
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
    # #64 row 65 — "percentage floats" inaccurate (dollar amount floats, percentage is fixed)
    (65, "pay-yourself-first-percentage — accuracy", [(
        "The percentage floats with your income automatically. You set it once, then change it only when the conditions that set it have actually changed.",
        "The dollar amount floats with your income automatically. You set the percentage once, then change it only when the conditions that set it have actually changed.",
    )]),

    # #78 row 79 — "pay-self bucket" vocab drift
    (79, "owner-draws-vs-salary — vocab", [(
        "then a percentage routes to a pay-self bucket",
        "then a percentage routes to a pay-yourself bucket",
    )]),

    # #85 row 86 — auto-routing "covers the floor"
    (86, "cash-flow-basics — manual reserve pull", [(
        "The reserve grows quietly in good months and covers the floor when slow ones hit.",
        "The reserve grows quietly in good months and gives you the cushion to pull from when slow ones hit.",
    )]),

    # #103 row 104 — "sabbatical bucket" — Able doesn't have one
    (104, "sabbatical — separate account, not Able bucket", [(
        "Floor-First Budgeting handles this with a dedicated sabbatical bucket alongside the standard per-deposit structure. Every deposit fills the floor first, and a percentage flows to the sabbatical fund.",
        "Floor-First Budgeting handles this with a separate sabbatical fund alongside the standard per-deposit structure. Every deposit fills the Floor first, and a portion of the surplus flows into the sabbatical fund.",
    )]),

    # #105 row 106 — reserve-before-debt drift (handling-a-windfall)
    (106, "handling-a-windfall — five-jobs order", [(
        "From there, reserve gaps. Then high-interest debt.",
        "From there, high-interest debt. Then reserve gaps.",
    )]),

    # #109 row 110 — surplus order (per-deposit-method-explained)
    (110, "per-deposit-method-explained — five-jobs order", [(
        "percentages route automatically: tax off the top, then the Floor (your bills), then the reserve, then debt, then what is yours to spend.",
        "percentages route automatically: tax off the top, bills next, then debt, reserve, and what is yours to spend.",
    )]),

    # #110 row 111 — reserve-before-debt drift (why-monthly-budgets-fail)
    (111, "why-monthly-budgets-fail — five-jobs order", [(
        "What remains splits into fixed percentages across a reserve, debt payoff, and free spending.",
        "What remains splits into fixed percentages across debt payoff, reserve, and free spending.",
    )]),

    # #114 row 115 — "holiday bucket" — Able doesn't have one
    (115, "holiday-season-budgeting — separate account, not Able bucket", [(
        "Every deposit fills the Floor first, then the holiday bucket gets its percentage. By December 1, the money is there.",
        "Every deposit fills the Floor first, then a slice flows into a separate holiday account. By December 1, the money is there.",
    )]),

    # #131 row 132 — auto-routing "paid by the reserve"
    (132, "inside-77-million — manual reserve pull", [(
        "When a slow month arrives, it gets paid by the reserve, not by panic.",
        "When a slow month arrives, you pull from the reserve, not from panic.",
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
        print(f"  row {sheet_row} ({label}): queued")

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
