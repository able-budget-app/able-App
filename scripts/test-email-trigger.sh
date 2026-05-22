#!/bin/bash
# Force-fires email-cron-daily, the function pg_cron normally calls once a
# day. Use this to test welcome / dormancy / weekly / billdue / cart /
# trial / achievement / deep-dive emails immediately instead of waiting
# for the next cron tick.
#
# Auths via INTERNAL_FUNCTION_SECRET (already in ~/.config/able/.env from the
# 2026-05-08 inter-function auth fix) on the x-internal-auth header.
# pg_cron continues to use CRON_SECRET on the Authorization header — both
# paths are accepted by email-cron-daily.
#
# Usage: ./scripts/test-email-trigger.sh
#
# The function iterates ALL users and sends whichever emails their state
# qualifies for — there's no "send to one user" mode here. So if you have
# a fresh paid signup whose ageHours < 48, signup_completed will land for
# them on this run. After it lands, sentEver gates prevent re-sends.

set -e
cd "$(dirname "$0")/.."

if [ ! -f "$HOME/.config/able/.env" ]; then
  echo "ERROR: ~/.config/able/.env not found" >&2
  exit 1
fi
SECRET=$(grep -v "^#" "$HOME/.config/able/.env" | grep "^INTERNAL_FUNCTION_SECRET=" | cut -d= -f2-)
if [ -z "$SECRET" ]; then
  cat >&2 <<EOF
ERROR: INTERNAL_FUNCTION_SECRET not in ~/.config/able/.env.
Should have been added 2026-05-08. Re-add it:
  INTERNAL_FUNCTION_SECRET=<value>
EOF
  exit 1
fi

URL="https://vfnozfvqgevjflwdjlyz.supabase.co/functions/v1/email-cron-daily"

echo "Firing email-cron-daily…"
RESP=$(curl -sS -w "\n__HTTP_%{http_code}__\n" \
  -X POST "$URL" \
  -H "x-internal-auth: $SECRET" \
  -H "Content-Type: application/json" \
  --max-time 120)

HTTP=$(echo "$RESP" | grep -oE "__HTTP_[0-9]+__" | tr -d "_HTPC")
BODY=$(echo "$RESP" | sed "/__HTTP_[0-9]*__/d")

echo "HTTP $HTTP"
echo
if [ "$HTTP" = "200" ]; then
  echo "$BODY" | jq "."
  echo
  SENT=$(echo "$BODY" | jq "[.[] | select(. > 0)] | length" 2>/dev/null || echo "0")
  TOTAL=$(echo "$BODY" | jq "[.[] | numbers] | add" 2>/dev/null || echo "0")
  echo "✅ $TOTAL email(s) sent across $SENT type(s). Check the recipient inboxes."
else
  echo "$BODY"
  echo
  echo "❌ Non-200 response. Check CRON_SECRET value or Supabase function logs."
fi
