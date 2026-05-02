#!/usr/bin/env bash
# Smoke-test the plaid-classify-batch edge function via direct service-role call.
# Use this for one-off backfills (pass max_batches to process more rows per run).
#
# Usage:
#   scripts/plaid-classify-test.sh [plaid_item_row_id] [max_batches]
#   scripts/plaid-classify-test.sh                      # all unclassified, 5 batches
#   scripts/plaid-classify-test.sh "" 40                # all unclassified, 40 batches (2000 txns)
#   scripts/plaid-classify-test.sh 4a18cecb-... 20      # one item, 20 batches

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ -z "${SB_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing SB_SERVICE_ROLE_KEY. See scripts/plaid-test.sh for setup." >&2
  exit 1
fi

SB_URL="${SB_URL:-https://vfnozfvqgevjflwdjlyz.supabase.co}"
ITEM="${1:-}"
MAX_BATCHES="${2:-5}"

BODY="{\"max_batches\":$MAX_BATCHES"
if [[ -n "$ITEM" ]]; then
  BODY="$BODY,\"plaid_item_row_id\":\"$ITEM\""
fi
BODY="$BODY}"

echo "POST $SB_URL/functions/v1/plaid-classify-batch"
echo "body: $BODY"
echo "---"
curl -sS -X POST "$SB_URL/functions/v1/plaid-classify-batch" \
  -H "Authorization: Bearer $SB_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY"
echo
echo "---"
echo "Now check Supabase dashboard → Edge Functions → plaid-classify-batch → Logs"
