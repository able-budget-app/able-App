#!/bin/bash
# Sends one push notification to a single user via send-push. Use this to
# smoke-test APNs (or web push) end-to-end without waiting for a real
# trigger (bill_due_tomorrow etc.) from email-cron-daily.
#
# Auths via INTERNAL_FUNCTION_SECRET on x-internal-auth, same pattern as
# test-email-trigger.sh.
#
# Usage:
#   ./scripts/test-apns.sh <user_id> [title] [body]
#
# Example:
#   ./scripts/test-apns.sh 8f3c... "Test" "Wired up."
#
# Tips:
#   - Find your user_id with: select id, email from auth.users where email='you@x.com';
#   - On the device, install the TestFlight build, open Able → More →
#     Push notifications → Enable. That writes a row to push_subscriptions
#     with platform='ios'. Then run this script.
#   - The function fans out to ALL of the user's subscriptions — if you
#     have both web (in a browser) and iOS active, both get pinged.

set -e
cd "$(dirname "$0")/.."

USER_ID="$1"
TITLE="${2:-Test push}"
BODY="${3:-If you can see this, APNs is wired up correctly.}"

if [ -z "$USER_ID" ]; then
  echo "Usage: $0 <user_id> [title] [body]" >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found in repo root" >&2
  exit 1
fi
SECRET=$(grep -v "^#" .env.local | grep "^INTERNAL_FUNCTION_SECRET=" | cut -d= -f2-)
if [ -z "$SECRET" ]; then
  echo "ERROR: INTERNAL_FUNCTION_SECRET not in .env.local" >&2
  exit 1
fi

URL="https://vfnozfvqgevjflwdjlyz.supabase.co/functions/v1/send-push"

PAYLOAD=$(jq -nc \
  --arg uid "$USER_ID" \
  --arg title "$TITLE" \
  --arg body "$BODY" \
  '{user_id: $uid, payload: {title: $title, body: $body, url: "/app.html", tag: "test-apns"}}')

echo "Firing send-push to $USER_ID…"
echo "  title: $TITLE"
echo "  body:  $BODY"
echo

RESP=$(curl -sS -w "\n__HTTP_%{http_code}__\n" \
  -X POST "$URL" \
  -H "x-internal-auth: $SECRET" \
  -H "Content-Type: application/json" \
  --max-time 30 \
  --data "$PAYLOAD")

HTTP=$(echo "$RESP" | grep -oE "__HTTP_[0-9]+__" | tr -d "_HTPC")
BODY_RESP=$(echo "$RESP" | sed "/__HTTP_[0-9]*__/d")

echo "HTTP $HTTP"
echo "$BODY_RESP" | jq "." 2>/dev/null || echo "$BODY_RESP"
echo

if [ "$HTTP" = "200" ]; then
  SENT=$(echo "$BODY_RESP" | jq ".sent" 2>/dev/null || echo "?")
  REMOVED=$(echo "$BODY_RESP" | jq ".removed" 2>/dev/null || echo "?")
  ERRORS=$(echo "$BODY_RESP" | jq ".errors" 2>/dev/null || echo "?")
  echo "✅ sent=$SENT removed=$REMOVED errors=$ERRORS"
  if [ "$SENT" = "0" ]; then
    echo
    echo "Sent 0 — likely no subscriptions for this user yet."
    echo "On the device: open Able → More → Push notifications → Enable."
  fi
else
  echo "❌ Non-200. Check Supabase Edge Function logs for send-push."
fi
