#!/usr/bin/env bash
# Smoke-test the plaid-sync edge function via direct service-role call.
# Mirrors what plaid-webhook does after SYNC_UPDATES_AVAILABLE.
#
# One-time setup:
#   1. Copy your service role key from Supabase dashboard → Project Settings → API.
#   2. Run:   echo "SB_SERVICE_ROLE_KEY=$(pbpaste)" > .env.local
#      (this writes the clipboard contents to .env.local without terminal wrap.)
#
# Usage:
#   scripts/plaid-test.sh <plaid_item_row_id>
#
# Example:
#   scripts/plaid-test.sh 4a18cecb-3eb4-4932-afcb-d7ae8b59ccd5

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ -z "${SB_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing SB_SERVICE_ROLE_KEY." >&2
  echo "Setup: copy the service_role key from Supabase dashboard → Project Settings → API," >&2
  echo "       then run:  echo \"SB_SERVICE_ROLE_KEY=\$(pbpaste)\" > .env.local" >&2
  exit 1
fi

ITEM="${1:-}"
if [[ -z "$ITEM" ]]; then
  echo "Usage: $0 <plaid_item_row_id>" >&2
  echo "       (lookup with: SELECT id FROM plaid_items;)" >&2
  exit 1
fi

SB_URL="${SB_URL:-https://vfnozfvqgevjflwdjlyz.supabase.co}"

echo "POST $SB_URL/functions/v1/plaid-sync   item=$ITEM"
echo "---"
curl -sS -X POST "$SB_URL/functions/v1/plaid-sync" \
  -H "Authorization: Bearer $SB_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"plaid_item_row_id\":\"$ITEM\"}"
echo
echo "---"
echo "Now check Supabase dashboard → Edge Functions → plaid-sync → Logs"
