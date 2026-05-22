#!/usr/bin/env bash
# Smoke-test the plaid-sync-sweep edge function via direct service-role call.
# Mirrors what pg_cron does on its 15-minute schedule.
#
# Usage:
#   scripts/plaid-sweep-test.sh
#
# Reads SB_SERVICE_ROLE_KEY from ~/.config/able/.env (same as scripts/plaid-test.sh).

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f "$HOME/.config/able/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$HOME/.config/able/.env"
  set +a
fi

if [[ -z "${SB_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Missing SB_SERVICE_ROLE_KEY. See scripts/plaid-test.sh for setup." >&2
  exit 1
fi

SB_URL="${SB_URL:-https://vfnozfvqgevjflwdjlyz.supabase.co}"

echo "POST $SB_URL/functions/v1/plaid-sync-sweep"
echo "---"
curl -sS -X POST "$SB_URL/functions/v1/plaid-sync-sweep" \
  -H "Authorization: Bearer $SB_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
echo
echo "---"
echo "Now check Supabase dashboard → Edge Functions → plaid-sync-sweep → Logs"
