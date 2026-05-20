#!/usr/bin/env python3
"""Compute public_flip_date for each YouTube video: 14 weeks (98 days) before
the corresponding LinkedIn scheduled_date. Writes two new sheet columns:

  youtube_public_flip_date  — when the trickle should flip it Public
  youtube_privacy           — current state: 'public' (pillars) or 'unlisted'

Make scenario will read these to decide what to flip each day.

Usage:
  python3 scripts/build-youtube-flip-schedule.py --dry-run
  python3 scripts/build-youtube-flip-schedule.py
"""
import argparse
import os
import sys
from datetime import date, timedelta, datetime
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path('/Users/pauljohnson/Desktop/Able')
TOKEN = ROOT / 'secrets' / 'google-oauth-token.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

LEAD_DAYS = 98  # 14 weeks = 28 LinkedIn posts at 2/week cadence
TODAY = date(2026, 5, 20)

# 28 pillar slugs already flipped Public 2026-05-20
PILLAR_URLS = {
    "/budgeting/per-deposit-method-explained/",
    "/budgeting/why-monthly-budgets-fail-variable-income/",
    "/budgeting/feast-or-famine/",
    "/learn/pay-yourself-first/what-pay-yourself-first-means/",
    "/learn/pay-yourself-first/profit-first-vs-pay-yourself-first/",
    "/taxes/how-much-to-set-aside/",
    "/taxes/1099-nec-explained/",
    "/taxes/1099-k-explained/",
    "/taxes/home-office-deduction/",
    "/taxes/self-employment-tax-deductions/",
    "/taxes/schedule-c-walkthrough/",
    "/business/llc-vs-sole-prop/",
    "/business/business-banking-101/",
    "/business/setting-prices-variable-income/",
    "/business/health-insurance-for-self-employed/",
    "/business/when-to-raise-your-rates/",
    "/business/invoicing-101-for-freelancers/",
    "/business/transitioning-from-w2-to-self-employed/",
    "/business/building-a-business-reserve/",
    "/business/first-90-days-self-employment/",
    "/budgeting/freelancer-budget/",
    "/budgeting/creator-budget/",
    "/budgeting/rideshare-driver-budget/",
    "/learn/get-out-of-debt/debt-snowball-vs-debt-avalanche/",
    "/learn/improve-your-credit-score/how-your-credit-score-actually-works/",
    "/learn/improve-your-credit-score/mastering-credit-utilization/",
    "/learn/inconsistent-income-data/inside-77-million-variable-income-workers/",
    "/learn/inconsistent-income-data/why-87-percent-struggle-to-budget/",
}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

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

    # Check if our new columns already exist
    new_flip_col = 'youtube_public_flip_date'
    new_priv_col = 'youtube_privacy'
    need_headers = []
    if new_flip_col not in cols:
        need_headers.append(new_flip_col)
    if new_priv_col not in cols:
        need_headers.append(new_priv_col)

    # Compute where the new columns will land (append to the right of existing)
    next_col_idx = len(hdr)
    flip_col_idx = cols.get(new_flip_col, next_col_idx)
    priv_col_idx = cols.get(new_priv_col, next_col_idx + (1 if new_flip_col not in cols else 0))

    def col_letter(idx):
        """0→A, 25→Z, 26→AA, 27→AB..."""
        out = ""
        while True:
            out = chr(ord('A') + idx % 26) + out
            idx = idx // 26 - 1
            if idx < 0:
                return out

    flip_col_letter = col_letter(flip_col_idx)
    priv_col_letter = col_letter(priv_col_idx)
    print(f"[plan] flip-date column → {flip_col_letter} (idx {flip_col_idx})")
    print(f"[plan] privacy column   → {priv_col_letter} (idx {priv_col_idx})\n")

    # Build per-row plan
    summary = {'pillar_public': 0, 'flip_immediate': 0, 'flip_scheduled': 0, 'no_li_date': 0, 'no_video_id': 0}
    plan = []
    for i, row in enumerate(values[1:]):
        row = row + [''] * (len(hdr) - len(row))
        sheet_row = i + 2
        page_url = row[cols['page_url']].strip()
        video_id = row[cols['youtube_video_id']].strip()
        li_date_str = row[cols['linkedin_scheduled_date']].strip()
        slug = row[cols['slug']].strip()

        if not video_id:
            summary['no_video_id'] += 1
            continue

        # Pillar → already public, no flip needed
        if page_url in PILLAR_URLS:
            plan.append({
                'sheet_row': sheet_row, 'slug': slug, 'page_url': page_url,
                'flip_date': '', 'privacy': 'public', 'note': '(pillar — already public)',
            })
            summary['pillar_public'] += 1
            continue

        # No LinkedIn date → can't compute, skip
        if not li_date_str:
            plan.append({
                'sheet_row': sheet_row, 'slug': slug, 'page_url': page_url,
                'flip_date': '', 'privacy': 'unlisted', 'note': '(no LI date — skip)',
            })
            summary['no_li_date'] += 1
            continue

        # Compute flip date = LI date - 98 days
        try:
            li_date = datetime.strptime(li_date_str, '%Y-%m-%d').date()
        except ValueError:
            plan.append({'sheet_row': sheet_row, 'slug': slug, 'page_url': page_url,
                         'flip_date': '', 'privacy': 'unlisted', 'note': f'(bad LI date: {li_date_str})'})
            continue
        flip_date = li_date - timedelta(days=LEAD_DAYS)
        # Clamp to today if past
        if flip_date < TODAY:
            flip_date = TODAY
            summary['flip_immediate'] += 1
        else:
            summary['flip_scheduled'] += 1

        plan.append({
            'sheet_row': sheet_row, 'slug': slug, 'page_url': page_url,
            'flip_date': flip_date.isoformat(), 'privacy': 'unlisted',
            'note': f'(LI {li_date_str}, lead 14w)',
        })

    print(f"[plan] {sum(summary.values())} rows total")
    print(f"  pillar_public (skip):     {summary['pillar_public']}")
    print(f"  flip_immediate (today):   {summary['flip_immediate']}")
    print(f"  flip_scheduled (future):  {summary['flip_scheduled']}")
    print(f"  no_li_date (skip):        {summary['no_li_date']}")
    print(f"  no_video_id (skip):       {summary['no_video_id']}\n")

    # Sample first/last few
    scheduled = [p for p in plan if p['flip_date']]
    scheduled.sort(key=lambda x: x['flip_date'])
    print("[plan] first 5 scheduled flips:")
    for p in scheduled[:5]:
        print(f"  row {p['sheet_row']:>3}  {p['flip_date']}  {p['slug'][:55]}")
    print("\n[plan] last 5 scheduled flips:")
    for p in scheduled[-5:]:
        print(f"  row {p['sheet_row']:>3}  {p['flip_date']}  {p['slug'][:55]}")

    # Count flips per week for trickle smoothness
    from collections import Counter
    week_counts = Counter()
    for p in scheduled:
        d = datetime.strptime(p['flip_date'], '%Y-%m-%d').date()
        monday = d - timedelta(days=d.weekday())
        week_counts[monday.isoformat()] += 1
    busy_weeks = [(w, c) for w, c in week_counts.most_common(5)]
    print(f"\n[plan] busiest weeks (top 5):")
    for w, c in busy_weeks:
        print(f"  week of {w}: {c} flips")

    if args.dry_run:
        print(f"\n[dry-run] No sheet writes. Re-run without --dry-run to apply.")
        return

    # Build batch update
    updates = []

    # Header writes if needed
    if need_headers:
        header_data = []
        if new_flip_col not in cols:
            header_data.append({'range': f'yt-longform!{flip_col_letter}1', 'values': [[new_flip_col]]})
        if new_priv_col not in cols:
            header_data.append({'range': f'yt-longform!{priv_col_letter}1', 'values': [[new_priv_col]]})
        updates.extend(header_data)
        print(f"\n[plan] will add column headers: {need_headers}")

    # Per-row data writes
    for p in plan:
        # Write both flip_date and privacy
        updates.append({'range': f'yt-longform!{flip_col_letter}{p["sheet_row"]}', 'values': [[p['flip_date']]]})
        updates.append({'range': f'yt-longform!{priv_col_letter}{p["sheet_row"]}', 'values': [[p['privacy']]]})

    print(f"\n[plan] writing {len(updates)} cells...")
    res = sheets.spreadsheets().values().batchUpdate(
        spreadsheetId=sheet_id,
        body={'valueInputOption': 'RAW', 'data': updates},
    ).execute()
    print(f"[plan] updated cells: {res.get('totalUpdatedCells')}")


if __name__ == '__main__':
    main()
