#!/usr/bin/env python3
"""Re-pace the scheduled_date column for all approved LinkedIn captions.

Pulls every row where linkedin_status='approved', orders them by sheet row,
and assigns clean Tue/Thu dates starting 2026-05-26 (Tue). Two posts per week.

Usage:
  python3 scripts/repace-linkedin-schedule.py --dry-run   # preview, no writes
  python3 scripts/repace-linkedin-schedule.py             # write
"""
import argparse
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path('/Users/pauljohnson/Desktop/Able')
TOKEN = ROOT / 'secrets' / 'google-oauth-token.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

START = date(2026, 5, 26)  # Tuesday


def tue_thu_dates(start: date, n: int):
    """Yield n dates from start, alternating Tue/Thu (2-day, 5-day, 2-day, 5-day...)."""
    assert start.weekday() == 1, "START must be a Tuesday"
    cur = start
    yield cur
    for i in range(1, n):
        # From Tue → Thu is +2; from Thu → next Tue is +5
        delta = 2 if cur.weekday() == 1 else 5
        cur = cur + timedelta(days=delta)
        yield cur


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
    date_col = cols['linkedin_scheduled_date']
    date_col_letter = chr(ord('A') + date_col % 26)
    # date_col index 29 → AD
    if date_col >= 26:
        date_col_letter = chr(ord('A') + (date_col // 26) - 1) + chr(ord('A') + date_col % 26)

    approved = []
    for i, row in enumerate(values[1:]):
        row = row + [''] * (len(hdr) - len(row))
        if row[cols['linkedin_status']].strip() == 'approved':
            approved.append({
                'sheet_row': i + 2,
                'slug': row[cols['slug']],
                'old_date': row[cols['linkedin_scheduled_date']],
            })

    print(f"[repace] {len(approved)} approved rows to reschedule")
    print(f"[repace] starting {START.isoformat()} (Tue), alternating Tue/Thu\n")

    dates = list(tue_thu_dates(START, len(approved)))
    end_date = dates[-1]
    print(f"[repace] last post: {end_date.isoformat()} ({end_date.strftime('%a')})")
    weeks = (end_date - START).days // 7
    print(f"[repace] span: ~{weeks} weeks ({weeks/4.33:.1f} months)\n")

    updates = []
    for hit, new_date in zip(approved, dates):
        new_str = new_date.isoformat()
        updates.append({
            'range': f'yt-longform!{date_col_letter}{hit["sheet_row"]}',
            'values': [[new_str]],
        })
        old = hit['old_date'] or '(empty)'
        print(f"  row {hit['sheet_row']:>3}  {old} → {new_str} {new_date.strftime('%a')}  {hit['slug'][:55]}")

    if args.dry_run:
        print(f"\n[dry-run] would write {len(updates)} cells. Re-run without --dry-run to commit.")
        return

    print(f"\n[repace] writing {len(updates)} cells...")
    res = sheets.spreadsheets().values().batchUpdate(
        spreadsheetId=sheet_id,
        body={'valueInputOption': 'RAW', 'data': updates},
    ).execute()
    print(f"[repace] updated cells: {res.get('totalUpdatedCells')}")


if __name__ == '__main__':
    main()
