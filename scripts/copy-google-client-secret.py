#!/usr/bin/env python3
"""
One-shot: copy the client_secret from the local Google OAuth credentials
JSON to the macOS clipboard via pbcopy. Used during OAuth client rotation.

Usage:
  python3 scripts/copy-google-client-secret.py
"""

import json
import subprocess
from pathlib import Path

CREDS = Path.home() / ".config" / "able" / "secrets" / "google-oauth-credentials.json"

if not CREDS.exists():
    raise SystemExit(f"error: {CREDS} not found")

d = json.load(open(CREDS))
inner = d.get("installed") or d.get("web") or {}

print("Top-level keys in JSON:", list(d.keys()))
print("Inner keys (under installed/web):", list(inner.keys()))
print()

secret = inner.get("client_secret")
if not secret:
    raise SystemExit("error: no client_secret field found in JSON — wrong file?")

# Sanity check the value looks right (Google client secrets start with GOCSPX-)
prefix = secret[:8]
print(f"client_secret first 8 chars: {prefix!r}")
print(f"client_secret length: {len(secret)} chars")
print(f"looks like GOCSPX-prefixed Google secret: {secret.startswith('GOCSPX-')}")

subprocess.run(["pbcopy"], input=secret.encode(), check=True)
print()
print("✓ client_secret now on clipboard. Paste into Supabase GOOGLE_OAUTH_CLIENT_SECRET.")
