#!/usr/bin/env python3
"""
Patch linkedin_post_text on specific rows to fix the audit findings.
Each patch is a (row, old_substring, new_substring) tuple — does precise
string replacement on the existing caption text. Fails loudly if old_substring
isn't found (so we don't silently no-op when wording drifts).
"""
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

# (sheet_row, label, [(old, new), ...])
PATCHES = [
    # #1 — row 2, budgeting/  — surplus-order drift
    (2, "budgeting/", [(
        "Tax allocation comes off the top first. Then your bills get reserved. Then the surplus splits across pay-yourself, debt, reserve, and free spending. In that order, every time, before the money has a chance to drift.",
        "The Floor fills first: tax off the top, then bills. Your reserve fills next. Free spending is what's left. In that order, every time, before the money has a chance to drift.",
    )]),

    # #2 — row 3, business/ — "smoothing reserve" ban
    (3, "business/", [(
        "or flows to a smoothing reserve when the month is good.",
        "or flows to the reserve when the month is good.",
    )]),

    # #6 — row 7, learn-how-money-works/ — surplus-order drift
    (7, "learn-how-money-works/", [(
        "What remains moves to your reserve, your debt payoff, your growth. In that order, every time, regardless of whether the deposit was $400 or $4,000.",
        "Your reserve fills next. Debt payoff and growth choices move from what remains, regardless of whether the deposit was $400 or $4,000.",
    )]),

    # #7 — row 8, learn-pay-yourself-first/ — pay-yourself put inside Floor
    (8, "learn-pay-yourself-first/", [(
        "Floor-First Budgeting treats your pay as part of the floor, not the leftover. Every deposit fills the floor first: bills, tax off the top, and a pay-yourself percentage that runs on every single deposit, not just the good months.",
        "Floor-First Budgeting treats your pay as the first move after the Floor, not the leftover. The Floor fills first: bills and tax off the top. Then a pay-yourself percentage runs on every single deposit, not just the good months.",
    )]),

    # #10 — row 11, commission-income-budget — Floor split from Tax + math
    (11, "commission-income-budget", [
        (
            "Taxes off the top first. Then your Floor, the bills that don't care what you closed last week. Then your reserve, which is what covers rent in the dead months. Then debt or savings. What's left is genuinely yours.",
            "The Floor fills first: tax off the top, then the bills that don't care what you closed last week. Then your reserve, which is what covers rent in the dead months. What's left is genuinely yours to put toward debt, savings, or the rest of your life.",
        ),
        (
            "A $9,000 commission at a 30% tax rate sends $2,700 to taxes immediately. If your Floor is $4,000 and $1,500 is already set aside, another $2,500 fills the gap. The remaining $3,800 builds the reserve.",
            "A $9,000 commission. The Floor fills first: $2,700 routes to tax and another $2,500 covers what's left of your $4,000 bills (after the $1,500 already set aside). The remaining $3,800 builds the reserve.",
        ),
    ]),

    # #13 — row 14, etsy-seller-budget — "COGS first" + Floor split
    (14, "etsy-seller-budget", [(
        "Once you know your real margin, the deposit routing makes sense. Cost of goods replaced first. Tax off the top on what remains. Then your floor fills, bills covered, reserve building toward the slow months that come every January and February after a strong Q4.",
        "Once you know your real margin, the deposit routing makes sense. The Floor fills first, and for an Etsy seller the Floor is wider than most: cost of goods to replenish, tax off the top, then bills. After that, your reserve builds toward the slow months that come every January and February after a strong Q4.",
    )]),

    # #14 — row 15, feast-or-famine — Floor split from Tax + drop goals bucket
    (15, "feast-or-famine", [(
        "Every deposit, the moment it arrives, splits before your brain has a chance to treat any of it as a windfall. Taxes come off the top first. Then your Floor gets covered: rent, utilities, groceries, insurance, the minimum payments you cannot miss. What is left splits into a reserve and a goals bucket. Whatever remains after that is genuinely yours to spend.",
        "Every deposit, the moment it arrives, splits before your brain has a chance to treat any of it as a windfall. The Floor fills first: taxes off the top, then rent, utilities, groceries, insurance, the minimum payments you cannot miss. What is left builds your reserve. Whatever remains after that is genuinely yours to spend.",
    )]),

    # #15 — row 16, freelancer-budget — "money has a job" + Floor split + "Tax first"
    (16, "freelancer-budget", [
        (
            "When an invoice clears, that money has a job before you touch it. Taxes come off the top first, every time, no exceptions. Then your Floor gets funded. The Floor is the number you cannot miss this month: rent, utilities, groceries, insurance, minimum payments. Every deposit fills the Floor first.",
            "When an invoice clears, that money is already accounted for before you touch it. The Floor fills first, every time, no exceptions. The Floor is the number you cannot miss this month: taxes off the top, then rent, utilities, groceries, insurance, minimum payments. Every deposit fills the Floor first.",
        ),
        (
            "Tax first. Floor second. Reserve third. Everything else after.",
            "Floor first. Reserve second. Everything else after.",
        ),
    ]),

    # #16 — row 17, pay-yourself-steady-paycheck — Floor defined as bills only
    (17, "pay-yourself-steady-paycheck", [(
        "It has to cover your Floor, every essential bill added up.",
        "It has to cover your Floor: every essential bill plus your tax set-aside.",
    )]),
]


def main():
    creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not creds.valid and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    sheets = build('sheets', 'v4', credentials=creds, cache_discovery=False)
    sheet_id = os.environ['SHEET_ID']

    # Read current state
    res = sheets.spreadsheets().values().get(
        spreadsheetId=sheet_id, range='yt-longform!A1:ZZ',
    ).execute()
    values = res.get('values', [])
    hdr = values[0]
    cols = {h.strip(): i for i, h in enumerate(hdr)}
    text_col = cols['linkedin_post_text']
    text_col_letter = 'AB'  # column 27
    assert text_col == 27, f"linkedin_post_text not at col 27, got {text_col}"

    updates = []
    failures = []
    for sheet_row, label, replacements in PATCHES:
        row_idx = sheet_row - 2  # 0-based row index in values[1:]
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
            print(f"  row {sheet_row} ({label}): NO CHANGE — substring not found")
            continue
        rng = f"yt-longform!{text_col_letter}{sheet_row}"
        updates.append({'range': rng, 'values': [[new]]})
        print(f"  row {sheet_row} ({label}): queued — {len(replacements)} replacement(s)")

    if failures:
        print("\n[fail] substrings not found:")
        for sheet_row, label, snip in failures:
            print(f"  row {sheet_row} ({label}): {snip!r}")
        sys.exit("aborting — fix the substring matches above and retry")

    if not updates:
        print("[patch] no updates queued")
        return

    print(f"\n[patch] applying {len(updates)} row update(s)...")
    res = sheets.spreadsheets().values().batchUpdate(
        spreadsheetId=sheet_id,
        body={'valueInputOption': 'RAW', 'data': updates},
    ).execute()
    print(f"[patch] updated cells: {res.get('totalUpdatedCells')}")


if __name__ == '__main__':
    main()
