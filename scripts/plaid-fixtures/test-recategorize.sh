#!/usr/bin/env bash
# Test plaid-recategorize edge function with the synthetic fixture.
#
# Usage:
#   FN_URL=http://localhost:54321/functions/v1/plaid-recategorize ./test-recategorize.sh
#   FN_URL=https://<project>.supabase.co/functions/v1/plaid-recategorize \
#     SUPABASE_ANON_KEY=<key> ./test-recategorize.sh
#
# For local: run `supabase functions serve plaid-recategorize` in another terminal first.
# For deployed: paste plaid-recategorize/index.ts into Supabase dashboard, set ANTHROPIC_API_KEY secret.

set -euo pipefail

FN_URL="${FN_URL:-http://localhost:54321/functions/v1/plaid-recategorize}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="$SCRIPT_DIR/recategorize-input.json"

AUTH_HEADER=()
if [[ -n "${SUPABASE_ANON_KEY:-}" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer $SUPABASE_ANON_KEY")
fi

echo "POST $FN_URL"
echo "Fixture: $FIXTURE ($(jq '.transactions | length' "$FIXTURE") transactions)"
echo "---"

curl -sS -X POST "$FN_URL" \
  -H "Content-Type: application/json" \
  "${AUTH_HEADER[@]}" \
  --data-binary "@$FIXTURE" \
  | jq .
