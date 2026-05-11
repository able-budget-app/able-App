#!/usr/bin/env python3
"""Print the live sheet's column headers so we can see what's there exactly."""
import os
import sys
from pathlib import Path

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = Path(__file__).resolve().parent.parent

env_path = ROOT / ".env.local"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

sheet_id = os.environ.get("SHEET_ID")
if not sheet_id:
    sys.exit("SHEET_ID not set")

creds = Credentials.from_authorized_user_file(
    str(ROOT / "secrets/google-oauth-token.json"),
    [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/spreadsheets",
    ],
)
sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
res = sheets.spreadsheets().values().get(spreadsheetId=sheet_id, range="1:1").execute()
headers = res.get("values", [[]])[0]

print(f"Total columns: {len(headers)}\n")
for i, h in enumerate(headers):
    marker = " ← LINKEDIN" if "linkedin" in h.lower() else ""
    if i < 26:
        letter = chr(65 + i)
    else:
        letter = "A" + chr(65 + (i - 26) % 26)
    print(f"  {i+1:3d} ({letter}) [{h}]{marker}")
