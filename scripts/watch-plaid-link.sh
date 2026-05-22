#!/bin/bash
# Watches a user's Plaid state from pre-Link through the historical-update
# webhook. Prints a snapshot every 30s for 10 minutes (or until
# historical_sync_complete=true). Designed for the "fresh signup → 0 txns"
# debug session.
#
# Usage:  ./scripts/watch-plaid-link.sh you@example.com
#
# Run this in your terminal in the repo root. Start it BEFORE you tap
# "Link Chase" in the app — that way we capture the pre-Link baseline,
# the immediate post-exchange state, the first sync, and the webhook
# follow-up, all in one transcript you can paste back to me.

set -e
cd "$(dirname "$0")/.."

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
  echo "Usage: $0 user@email.com" >&2
  exit 1
fi

if [ ! -f "$HOME/.config/able/.env" ]; then
  echo "ERROR: ~/.config/able/.env not found" >&2
  exit 1
fi
KEY=$(grep -v "^#" "$HOME/.config/able/.env" | grep "^SB_SERVICE_ROLE_KEY=" | cut -d= -f2-)
URL="https://vfnozfvqgevjflwdjlyz.supabase.co"

sb() {
  curl -sS -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Accept: application/json" "$URL/rest/v1/$1"
}

snapshot() {
  local LABEL="$1"
  local USER_ID="$2"
  echo
  echo "==================== $LABEL  ($(date '+%H:%M:%S')) ===================="

  # plaid_items
  echo "-- plaid_items"
  sb "plaid_items?user_id=eq.$USER_ID&select=id,plaid_item_id,institution_name,status,initial_sync_complete,historical_sync_complete,lookback_months,last_sync_at,error_code,error_message&order=created_at.desc" \
    | jq 'map({
        id_short: .id[0:8],
        plaid_item: .plaid_item_id[0:14],
        institution: .institution_name,
        status,
        initial: .initial_sync_complete,
        historical: .historical_sync_complete,
        lookback: .lookback_months,
        last_sync: .last_sync_at,
        err_code: .error_code,
        err_msg: .error_message
      })'

  # plaid_accounts count
  local ACCT
  ACCT=$(sb "plaid_accounts?user_id=eq.$USER_ID&select=count" -H "Prefer: count=exact" | jq -r '.[0].count // 0')
  echo "-- plaid_accounts: $ACCT"

  # plaid_transactions count + date range
  local TXN
  TXN=$(sb "plaid_transactions?user_id=eq.$USER_ID&select=count" -H "Prefer: count=exact" | jq -r '.[0].count // 0')
  local DATE_MIN DATE_MAX
  DATE_MIN=$(sb "plaid_transactions?user_id=eq.$USER_ID&select=date&order=date.asc&limit=1" | jq -r '.[0].date // "—"')
  DATE_MAX=$(sb "plaid_transactions?user_id=eq.$USER_ID&select=date&order=date.desc&limit=1" | jq -r '.[0].date // "—"')
  echo "-- plaid_transactions: $TXN  (range: $DATE_MIN → $DATE_MAX)"

  # plaid_recurring_streams count
  local REC
  REC=$(sb "plaid_recurring_streams?user_id=eq.$USER_ID&select=count" -H "Prefer: count=exact" | jq -r '.[0].count // 0')
  echo "-- plaid_recurring_streams: $REC"
}

# Resolve user_id (will retry if user doesn't exist yet — i.e. you ran
# this BEFORE signup, which is the recommended order).
#
# GoTrue's admin endpoint ignores `?email=...` and returns ALL users when
# given an unknown email — `?filter=...` is the documented substring search.
# We then exact-match on email in jq to avoid prefix collisions.
# `--data-urlencode` is needed because emails with `+` (gmail aliases)
# get mis-parsed as spaces in raw query strings.
resolve_user() {
  curl -sS -G -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    "$URL/auth/v1/admin/users" --data-urlencode "filter=$EMAIL" \
    | jq -r --arg email "$EMAIL" '.users[]? | select(.email == $email) | .id' \
    | head -n 1
}

USER_ID=$(resolve_user)
if [ -z "$USER_ID" ]; then
  echo "No auth user yet for $EMAIL. Waiting for signup..."
  for i in $(seq 1 60); do
    sleep 5
    USER_ID=$(resolve_user)
    if [ -n "$USER_ID" ]; then
      echo "User created: $USER_ID"
      break
    fi
    echo "  (still waiting, ${i}/60 — 5s polls = 5min cap)"
  done
fi

if [ -z "$USER_ID" ]; then
  echo "ERROR: $EMAIL never appeared in auth.users. Aborting." >&2
  exit 1
fi

echo
echo "Watching $EMAIL  ($USER_ID)"
echo "Will snapshot every 30s for 10 minutes (max 21 snapshots)."
echo "Stop early any time with Ctrl+C — the transcript above is what to paste back."

snapshot "T+0  PRE / IMMEDIATE" "$USER_ID"

for i in $(seq 1 20); do
  sleep 30

  # Stop early when historical_sync_complete = true on every item
  ALL_DONE=$(sb "plaid_items?user_id=eq.$USER_ID&select=historical_sync_complete" \
    | jq -r 'if length == 0 then "no_items" else (all(.historical_sync_complete == true)) end')

  snapshot "T+$((i*30))s" "$USER_ID"

  if [ "$ALL_DONE" = "true" ]; then
    echo
    echo "✅ historical_sync_complete=true on all items. Stopping early."
    exit 0
  fi
done

echo
echo "⏰ 10-minute window elapsed. If historical=false at this point,"
echo "   open Supabase dashboard → Edge Functions → plaid-webhook → Logs"
echo "   and grep for SYNC_UPDATES_AVAILABLE."
