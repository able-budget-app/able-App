#!/bin/bash
# Pulls Paul's current Supabase state for E2E diagnosis. Run after a
# fresh-signup test; pipe output to me. No screenshots needed.
#
# Usage:  ./scripts/diag-user-state.sh
# Optional env: USER_EMAIL (defaults to pauljohnson912@gmail.com)

set -e
cd "$(dirname "$0")/.."

# Load service role key from ~/.config/able/.env
if [ ! -f "$HOME/.config/able/.env" ]; then
  echo "ERROR: ~/.config/able/.env not found" >&2
  exit 1
fi
KEY=$(grep -v "^#" "$HOME/.config/able/.env" | grep "^SB_SERVICE_ROLE_KEY=" | cut -d= -f2-)
if [ -z "$KEY" ]; then
  echo "ERROR: SB_SERVICE_ROLE_KEY not found in ~/.config/able/.env" >&2
  exit 1
fi
URL="https://vfnozfvqgevjflwdjlyz.supabase.co"
EMAIL="${USER_EMAIL:-pauljohnson912@gmail.com}"

# Helper: REST call against the public schema
sb() {
  curl -sS -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Accept: application/json" "$URL/rest/v1/$1"
}

# Find user_id from auth.users (admin endpoint).
# GoTrue ignores `?email=` and returns ALL users on unknown addresses;
# `?filter=` is the real substring search. Exact-match in jq.
# `--data-urlencode` is needed because emails with `+` (gmail aliases)
# get mis-parsed as spaces in raw query strings.
USER_ID=$(curl -sS -G -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$URL/auth/v1/admin/users" --data-urlencode "filter=$EMAIL" \
  | jq -r --arg email "$EMAIL" '.users[]? | select(.email == $email) | .id' \
  | head -n 1)

if [ -z "$USER_ID" ]; then
  echo "ERROR: no auth user found for $EMAIL" >&2
  exit 1
fi

echo "=== USER ==="
echo "email:    $EMAIL"
echo "user_id:  $USER_ID"
echo

echo "=== user_data ==="
sb "user_data?id=eq.$USER_ID&select=sources,bills,debts,settings,profile,obligations" | jq '
  if length == 0 then "NO ROW (signup didn'"'"'t create user_data)" else
    .[0] | {
      sources: (.sources // []),
      sources_count: (.sources // [] | length),
      bills_count: (.bills // [] | length),
      bills_pending_review: (.bills // [] | map(select(.pending_review == true)) | length),
      bills_sample: (.bills // [] | .[0:3] | map({name, amount, pending_review, source_plan_id})),
      debts_count: (.debts // [] | length),
      debts_pending_review: (.debts // [] | map(select(.pending_review == true)) | length),
      debts_sample: (.debts // [] | map({name, balance, min, rate, pending_review, source_plan_id})),
      obligations_count: (.obligations // [] | length),
      settings_keys: (.settings // {} | keys),
      intake_channels: (.settings.intake_channels // null),
      profile_brought_here: (.profile.brought_here // null)
    }
  end
'
echo

echo "=== analyzer_plans (latest 3) ==="
sb "analyzer_plans?user_id=eq.$USER_ID&order=created_at.desc&limit=3&select=id,status,created_at,applied_at,plan_json" | jq '
  map({
    id: .id[0:8],
    status,
    created_at,
    applied_at,
    plan_income_sources: (.plan_json.income_sources // [] | map(.name)),
    plan_income_sources_count: (.plan_json.income_sources // [] | length),
    plan_bills_count: (.plan_json.bills // [] | length),
    plan_debts_count: (.plan_json.debts // [] | length),
    plan_debts: (.plan_json.debts // [] | map({name, min_payment, balance_estimate, rate_estimate}))
  })
'
echo

echo "=== plaid_transactions ==="
TOTAL=$(sb "plaid_transactions?user_id=eq.$USER_ID&select=count" -H "Prefer: count=exact" | jq -r '.[0].count // 0')
CLASSIFIED=$(sb "plaid_transactions?user_id=eq.$USER_ID&select=count&able_classified_at=not.is.null" -H "Prefer: count=exact" | jq -r '.[0].count // 0')
echo "total: $TOTAL"
echo "classified: $CLASSIFIED"
echo "remaining: $((TOTAL - CLASSIFIED))"
DATE_RANGE=$(sb "plaid_transactions?user_id=eq.$USER_ID&select=date&order=date.asc&limit=1" | jq -r '.[0].date // "none"')
DATE_END=$(sb "plaid_transactions?user_id=eq.$USER_ID&select=date&order=date.desc&limit=1" | jq -r '.[0].date // "none"')
echo "date range: $DATE_RANGE → $DATE_END"
echo

echo "=== plaid_recurring_streams ==="
sb "plaid_recurring_streams?user_id=eq.$USER_ID&select=direction,status,frequency,merchant_name,average_amount" | jq '
  {
    total: length,
    inflow: map(select(.direction == "inflow")) | length,
    outflow: map(select(.direction == "outflow")) | length,
    sample_outflow: map(select(.direction == "outflow")) | .[0:8] | map({merchant_name, frequency, average_amount, status})
  }
'
echo

echo "=== plaid_accounts ==="
sb "plaid_accounts?user_id=eq.$USER_ID&select=name,official_name,mask,type,subtype,current_balance,last_balance_at" | jq 'map({name, mask, type, subtype, current_balance, last_balance_at})'
echo

echo "=== DONE ==="
