#!/usr/bin/env bash
# Deploy Able's edge functions to Supabase.
#
# Usage:
#   scripts/deploy-functions.sh                # deploy all functions under supabase/functions
#   scripts/deploy-functions.sh create-checkout stripe-webhook   # deploy specific ones
#
# Requires: supabase CLI logged in and linked (run once):
#   supabase login
#   supabase link --project-ref <your-project-ref>

set -euo pipefail

cd "$(dirname "$0")/.."

# Every function gets a Deno check before it ships. This is what would have
# caught the "Identifier 'urlOk' has already been declared" bug locally
# instead of at runtime on Supabase.
check_one() {
  local name="$1"
  local entry="supabase/functions/${name}/index.ts"
  if [[ ! -f "$entry" ]]; then
    echo "SKIP $name (no index.ts)"
    return 0
  fi
  if ! command -v deno >/dev/null 2>&1; then
    echo "WARN deno not installed — skipping pre-deploy check for $name"
    echo "     install with: brew install deno"
    return 0
  fi
  echo "CHECK $name"
  deno check --no-lock "$entry"
}

deploy_one() {
  local name="$1"
  echo "DEPLOY $name"
  supabase functions deploy "$name" --no-verify-jwt=false
}

if [[ $# -gt 0 ]]; then
  targets=("$@")
else
  targets=()
  for dir in supabase/functions/*/; do
    base="$(basename "$dir")"
    [[ "$base" == "_shared" ]] && continue
    targets+=("$base")
  done
fi

for t in "${targets[@]}"; do
  check_one "$t"
done

for t in "${targets[@]}"; do
  deploy_one "$t"
done

echo "Done. Deployed: ${targets[*]}"
