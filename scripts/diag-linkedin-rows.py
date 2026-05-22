#!/usr/bin/env python3
"""Diagnose which rows match the LinkedIn poster filter."""
import os
import sys
from datetime import date
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parent.parent

env = Path.home() / ".config" / "able" / ".env"
if env.exists():
    for ln in env.read_text().splitlines():
        if "=" in ln and not ln.startswith("#"):
            k, _, v = ln.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

sheet_id = os.environ.get("SHEET_ID")
if not sheet_id:
    sys.exit("SHEET_ID not set")

tab = os.environ.get("YT_LONGFORM_TAB") or "yt-longform"
rng = f"{tab}!A1:ZZ"

creds = Credentials.from_authorized_user_file(
    str(Path.home() / ".config" / "able" / "secrets" / "google-oauth-token.json"),
    ["https://www.googleapis.com/auth/spreadsheets"],
)
sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
res = sheets.spreadsheets().values().get(spreadsheetId=sheet_id, range=rng).execute()
vals = res["values"]
hdr = [h.strip() for h in vals[0]]
ci = {h: i for i, h in enumerate(hdr)}

today = date.today().isoformat()
print(f"today's date: {today}\n")
print(f"{'row':<5} {'slug':<35} {'AC linkedin_status':<25} {'AD linkedin_scheduled_date':<28} {'AE linkedin_url':<30} {'AB has draft':<15}")
print("-" * 140)

for i, row in enumerate(vals[1:], start=2):
    row = row + [""] * (len(hdr) - len(row))
    slug = row[ci["slug"]][:33]
    status_raw = row[ci["linkedin_status"]]
    sched_raw = row[ci["linkedin_scheduled_date"]]
    url_raw = row[ci["linkedin_url"]]
    has_draft = "yes" if row[ci["linkedin_post_text"]].strip() else "no"

    # Show exact value with quotes to expose whitespace
    status = f'"{status_raw}"'
    sched = f'"{sched_raw}"'
    url = f'"{url_raw}"'

    # Check each filter condition independently
    cond1 = status_raw == "approved"
    cond2 = url_raw == ""
    cond3 = sched_raw != "" and sched_raw <= today

    flags = []
    if cond1: flags.append("AC✓")
    if cond2: flags.append("AE✓")
    if cond3: flags.append("AD✓")
    flag_str = " ".join(flags) if flags else "—"

    print(f"{i:<5} {slug:<35} {status:<25} {sched:<28} {url:<30} {has_draft:<15} {flag_str}")

print("\n--- Filter would match if all three are ✓ (AC=approved, AE empty, AD<=today) ---")
