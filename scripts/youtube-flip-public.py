#!/usr/bin/env python3
"""Flip YouTube videos from Unlisted to Public.

Two modes:
  --pillars   flip the 28 strategic-picks list from youtube_public_flip_plan.md
  --slug X    flip one specific slug by sheet match (page_url contains X)
  --rows R    flip specific sheet row numbers, comma-separated

Reads youtube_video_id from the yt-longform sheet (matched by page_url).
Uses YouTube Data API videos.update — 50 quota units per flip.

Default daily quota is 10,000 units → 200 flips/day. The full 28 is well under.
"""
import argparse
import os
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

ROOT = Path('/Users/pauljohnson/Desktop/Able')
CREDS_FILE = ROOT / 'secrets' / 'google-oauth-credentials.json'
TOKEN_FILE = ROOT / 'secrets' / 'google-oauth-token.json'
SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',  # videos.update needs this
    'https://www.googleapis.com/auth/spreadsheets',
]

# 28 strategic picks — page_url substring matching against the yt-longform sheet
PILLAR_PICKS = [
    # Foundation / method (5)
    "/budgeting/per-deposit-method-explained/",
    "/budgeting/why-monthly-budgets-fail-variable-income/",
    "/budgeting/feast-or-famine/",
    "/learn/pay-yourself-first/what-pay-yourself-first-means/",
    "/learn/pay-yourself-first/profit-first-vs-pay-yourself-first/",
    # Taxes (6)
    "/taxes/how-much-to-set-aside/",
    "/taxes/1099-nec-explained/",
    "/taxes/1099-k-explained/",
    "/taxes/home-office-deduction/",
    "/taxes/self-employment-tax-deductions/",
    "/taxes/schedule-c-walkthrough/",
    # Business (9)
    "/business/llc-vs-sole-prop/",
    "/business/business-banking-101/",
    "/business/setting-prices-variable-income/",
    "/business/health-insurance-for-self-employed/",
    "/business/when-to-raise-your-rates/",
    "/business/invoicing-101-for-freelancers/",
    "/business/transitioning-from-w2-to-self-employed/",
    "/business/building-a-business-reserve/",
    "/business/first-90-days-self-employment/",
    # Persona budgets (3)
    "/budgeting/freelancer-budget/",
    "/budgeting/creator-budget/",
    "/budgeting/rideshare-driver-budget/",
    # Debt + credit (3)
    "/learn/get-out-of-debt/debt-snowball-vs-debt-avalanche/",
    "/learn/improve-your-credit-score/how-your-credit-score-actually-works/",
    "/learn/improve-your-credit-score/mastering-credit-utilization/",
    # Inconsistent-income-data (2, added after upload 2026-05-20)
    "/learn/inconsistent-income-data/inside-77-million-variable-income-workers/",
    "/learn/inconsistent-income-data/why-87-percent-struggle-to-budget/",
]


def get_credentials():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                creds = None
        if not creds:
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def fetch_video_metadata(youtube, video_id):
    """Fetch existing video snippet so we can preserve category + title on update."""
    req = youtube.videos().list(part="snippet,status", id=video_id)
    res = req.execute()
    items = res.get("items", [])
    return items[0] if items else None


def flip_to_public(youtube, video_id):
    """Set privacyStatus to 'public'. Returns True on success."""
    # Need to preserve categoryId; update payload requires snippet if including snippet part
    meta = fetch_video_metadata(youtube, video_id)
    if not meta:
        return False, "video not found"
    body = {
        "id": video_id,
        "status": {
            "privacyStatus": "public",
            "madeForKids": meta["status"].get("madeForKids", False),
            "selfDeclaredMadeForKids": meta["status"].get("selfDeclaredMadeForKids", False),
        },
    }
    try:
        youtube.videos().update(part="status", body=body).execute()
        return True, "ok"
    except HttpError as e:
        return False, str(e)


def main():
    p = argparse.ArgumentParser()
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--pillars", action="store_true", help="Flip the 28 strategic-pick pillars")
    g.add_argument("--slug", help="Flip one slug (page_url substring)")
    g.add_argument("--rows", help="Flip specific row numbers, comma-separated")
    g.add_argument("--scheduled", action="store_true",
                   help="Flip rows where youtube_public_flip_date <= today AND youtube_privacy = 'unlisted'")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    creds = get_credentials()
    sheets = build('sheets', 'v4', credentials=creds, cache_discovery=False)
    youtube = build('youtube', 'v3', credentials=creds, cache_discovery=False)

    res = sheets.spreadsheets().values().get(
        spreadsheetId=os.environ['SHEET_ID'], range='yt-longform!A1:ZZ',
    ).execute()
    values = res.get('values', [])
    hdr = values[0]
    cols = {h.strip(): i for i, h in enumerate(hdr)}

    # Build lookup: page_url → {row, slug, video_id}
    by_url = {}
    by_row = {}
    scheduled_due = []
    from datetime import date as _date
    today_str = _date.today().isoformat()
    flip_date_idx = cols.get('youtube_public_flip_date')
    privacy_idx = cols.get('youtube_privacy')
    li_status_idx = cols.get('linkedin_status')
    for i, row in enumerate(values[1:]):
        row = row + [''] * (len(hdr) - len(row))
        url = row[cols['page_url']].strip()
        vid = row[cols['youtube_video_id']].strip()
        slug = row[cols['slug']].strip()
        sheet_row = i + 2
        if url and vid:
            by_url[url] = {'sheet_row': sheet_row, 'slug': slug, 'video_id': vid}
        by_row[sheet_row] = {'slug': slug, 'video_id': vid, 'page_url': url}
        # Scheduled-mode check: due AND unlisted AND not LinkedIn-deferred
        if flip_date_idx is not None and privacy_idx is not None and vid:
            flip_date = row[flip_date_idx].strip()
            privacy = row[privacy_idx].strip()
            li_status = row[li_status_idx].strip() if li_status_idx is not None else ''
            if (flip_date and flip_date <= today_str
                    and privacy == 'unlisted'
                    and li_status != 'deferred'):
                scheduled_due.append({'sheet_row': sheet_row, 'slug': slug, 'video_id': vid, 'flip_date': flip_date})

    # Resolve targets
    targets = []
    if args.pillars:
        for pick in PILLAR_PICKS:
            hit = by_url.get(pick)
            if hit:
                targets.append(hit)
            else:
                print(f"  [miss] {pick} — not found in sheet or no video_id", file=sys.stderr)
    elif args.slug:
        matches = [v for k, v in by_url.items() if args.slug in k]
        if not matches:
            sys.exit(f"no match for slug substring '{args.slug}'")
        targets = matches
    elif args.rows:
        for r in args.rows.split(','):
            r = int(r.strip())
            hit = by_row.get(r)
            if hit and hit['video_id']:
                targets.append({'sheet_row': r, **hit})
    elif args.scheduled:
        if flip_date_idx is None or privacy_idx is None:
            sys.exit("error: sheet missing youtube_public_flip_date or youtube_privacy columns. Run build-youtube-flip-schedule.py first.")
        targets = scheduled_due
        print(f"[scheduled] {len(targets)} row(s) due today ({today_str}) or earlier")

    print(f"[flip] {len(targets)} video(s) to flip → public  (quota cost: {len(targets) * 50} units)")
    for t in targets:
        print(f"  row {t['sheet_row']:>3}  {t['video_id']}  {t['slug']}")

    if args.dry_run:
        print(f"\n[dry-run] re-run without --dry-run to flip.")
        return

    print()
    ok, fail = 0, 0
    sheet_updates = []

    # column letter for youtube_privacy
    def _col_letter(idx):
        out = ""
        while True:
            out = chr(ord('A') + idx % 26) + out
            idx = idx // 26 - 1
            if idx < 0:
                return out
    privacy_col_letter = _col_letter(privacy_idx) if privacy_idx is not None else None

    for t in targets:
        success, msg = flip_to_public(youtube, t['video_id'])
        if success:
            print(f"  ✓ {t['video_id']}  {t['slug']}")
            ok += 1
            # Mark sheet as flipped if we have the privacy column
            if privacy_col_letter and 'sheet_row' in t:
                sheet_updates.append({
                    'range': f'yt-longform!{privacy_col_letter}{t["sheet_row"]}',
                    'values': [['public']],
                })
        else:
            print(f"  ✗ {t['video_id']}  {t['slug']}  — {msg[:80]}")
            fail += 1

    # Batch-update privacy column for successful flips
    if sheet_updates:
        sheets.spreadsheets().values().batchUpdate(
            spreadsheetId=os.environ['SHEET_ID'],
            body={'valueInputOption': 'RAW', 'data': sheet_updates},
        ).execute()
        print(f"\n[sheet] marked {len(sheet_updates)} row(s) youtube_privacy=public")

    print(f"\n[flip] done. ok={ok}  fail={fail}")


if __name__ == '__main__':
    main()
