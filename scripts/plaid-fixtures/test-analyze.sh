#!/usr/bin/env bash
# Test plaid-analyze edge function with the synthetic fixture.
#
# Usage:
#   FN_URL=http://localhost:54321/functions/v1/plaid-analyze ./test-analyze.sh
#   FN_URL=https://<project>.supabase.co/functions/v1/plaid-analyze \
#     SUPABASE_ANON_KEY=<key> ./test-analyze.sh

set -euo pipefail

FN_URL="${FN_URL:-http://localhost:54321/functions/v1/plaid-analyze}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="$SCRIPT_DIR/analyze-input.json"

AUTH_HEADER=()
if [[ -n "${SUPABASE_ANON_KEY:-}" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer $SUPABASE_ANON_KEY")
fi

echo "POST $FN_URL"
echo "Fixture: $FIXTURE"
echo "  - $(jq '.categorized_transactions | length' "$FIXTURE") categorized transactions"
echo "  - $(jq '.recurring_streams.inflow_streams | length' "$FIXTURE") inflow streams"
echo "  - $(jq '.recurring_streams.outflow_streams | length' "$FIXTURE") outflow streams"
echo "  - lookback: $(jq '.lookback_months' "$FIXTURE") months"
echo "---"

curl -sS -X POST "$FN_URL" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  --data-binary "@$FIXTURE" \
  | jq .
