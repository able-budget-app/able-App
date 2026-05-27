#!/usr/bin/env python3
"""
One-shot Google OAuth re-auth.

Run after rotating the OAuth client_secret in Google Cloud Console. Reads the
new credentials JSON, opens a browser for sign-in, and writes the resulting
refresh+access token to google-oauth-token.json.

  python3 scripts/reauth-google.py

Scopes are the union of every Google API Able uses (YouTube upload + mgmt +
Sheets). If you ever add a new Google API, append its scope here.
"""

from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

CREDS = Path.home() / ".config" / "able" / "secrets" / "google-oauth-credentials.json"
TOKEN = Path.home() / ".config" / "able" / "secrets" / "google-oauth-token.json"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/spreadsheets",
]

if not CREDS.exists():
    raise SystemExit(f"error: {CREDS} not found — download from Google Cloud Console first")

flow = InstalledAppFlow.from_client_secrets_file(str(CREDS), SCOPES)
# access_type=offline + prompt=consent guarantees a refresh_token is issued
# even if the user has previously authorized this client.
creds = flow.run_local_server(port=0, access_type="offline", prompt="consent")
TOKEN.write_text(creds.to_json())
TOKEN.chmod(0o600)

print(f"\n✓ new token saved to {TOKEN}")
print(f"  has refresh_token: {bool(creds.refresh_token)}")
print(f"  scopes granted: {creds.scopes}")
