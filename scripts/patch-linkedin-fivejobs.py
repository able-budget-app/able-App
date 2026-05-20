#!/usr/bin/env python3
"""Reconcile batch 1-3 LinkedIn captions to 'five jobs' canonical framing
(Taxes → Bills → Debt → Reserve → Free spending) + fix auto-routing overclaims
the capabilities skill flags as false."""
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
    # ── Restore five-jobs enumeration (over-corrected in batches 1+2) ──

    # #1, row 2 — restore "debt" to the surplus
    (2, "budgeting/ — five jobs", [(
        "The Floor fills first: tax off the top, then bills. Your reserve fills next. Free spending is what's left. In that order, every time, before the money has a chance to drift.",
        "The Floor fills first: tax off the top, then bills. Then debt, reserve, and free spending. In that order, every time, before the money has a chance to drift.",
    )]),

    # #6, row 7 — restore five-jobs, drop "growth" as canonical bucket
    (7, "how-money-works/ — five jobs", [(
        "Every deposit fills the floor first. Your reserve fills next. Debt payoff and growth choices move from what remains, regardless of whether the deposit was $400 or $4,000.",
        "Every deposit fills the floor first. What remains splits across debt, reserve, and free spending, in that order, regardless of whether the deposit was $400 or $4,000.",
    )]),

    # #35, row 36 — restore five-jobs (correct order: debt before reserve in surplus)
    (36, "how-to-handle-debt — five jobs", [(
        "What remains builds your reserve, and debt payoff moves from what is left after that. The reserve is what makes floor mode survivable when things slow down.",
        "What remains splits across debt, reserve, and free spending. The reserve is what makes floor mode survivable when things slow down.",
    )]),

    # #39, row 40 — restore five-jobs (debt before reserve in surplus)
    (40, "why-getting-out-of-debt — five jobs", [(
        "The Floor fills first: your bills and your tax set-aside. Your reserve fills next. What remains routes to debt payoff and free spending.",
        "The Floor fills first: your bills and your tax set-aside. What remains splits across debt, reserve, and free spending.",
    )]),

    # #56, row 57 — drop pay-yourself (article is wealth-building, not pay-yourself)
    (57, "milestone-6-build-wealth — five jobs", [(
        "What remains gets split across pay-yourself, debt, reserve, and free spending.",
        "What remains gets split across debt, reserve, and free spending.",
    )]),

    # ── Auto-routing overclaim fixes (capabilities skill: reserve is manual pull) ──

    # #2, row 3 — "reserve tops up your paycheck" implies auto-routing
    (3, "business/ — manual reserve pull", [(
        "When a slow month hits, the reserve tops up your paycheck.",
        "When a slow month hits, you pull from the reserve to top up your paycheck.",
    )]),

    # #11, row 12 — "reserve pays your bills" implies auto-routing
    (12, "creator-budget — manual reserve pull", [(
        "The reserve is the account that pays your bills when the algorithm goes quiet for six weeks.",
        "The reserve is what you pull from to cover bills when the algorithm goes quiet for six weeks.",
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
                failures.append((sheet_row, label, old[:90]))
                continue
            new = new.replace(old, repl)
        if new == cur:
            continue
        updates.append({'range': f'yt-longform!AB{sheet_row}', 'values': [[new]]})
        print(f"  row {sheet_row} ({label}): queued")

    if failures:
        print("\n[fail] substrings not found:")
        for sheet_row, label, snip in failures:
            print(f"  row {sheet_row} ({label}): {snip!r}")
        sys.exit("aborting")

    if updates:
        res = sheets.spreadsheets().values().batchUpdate(
            spreadsheetId=sheet_id,
            body={'valueInputOption': 'RAW', 'data': updates},
        ).execute()
        print(f"\n[patch] updated cells: {res.get('totalUpdatedCells')}")


if __name__ == '__main__':
    main()
