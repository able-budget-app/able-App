#!/usr/bin/env bash
# Daily LinkedIn pipeline: upload 5 YouTube videos, patch article frontmatter,
# regenerate tracker, draft 5 LinkedIn posts. Run once a day until backlog
# (currently ~63 videos) is cleared.
#
# Usage:
#   ./scripts/daily-linkedin-batch.sh           # default --batch=5
#   ./scripts/daily-linkedin-batch.sh 10        # custom batch size
#
# Exits non-zero if any step fails (quota hit, OAuth expired, etc).

set -euo pipefail

cd "$(dirname "$0")/.."

BATCH="${1:-5}"

# Load SHEET_ID + tab overrides from .env.local if present. No hardcoded
# fallback — require explicit env so a forgotten migration fails loudly
# instead of silently posting to the old single-purpose sheet.
if [[ -f .env.local ]]; then
    set -a
    source <(grep -E "^(SHEET_ID|YT_LONGFORM_TAB|SHORTS_SHEET_ID|SHORTS_TAB)=" .env.local || true)
    set +a
fi
: "${SHEET_ID:?error: SHEET_ID not set. Add SHEET_ID=<mega-workbook-id> to .env.local}"
export SHEET_ID
[[ -n "${YT_LONGFORM_TAB:-}" ]] && export YT_LONGFORM_TAB

bar() { printf '═%.0s' {1..60}; echo; }

bar
echo "  Able daily LinkedIn batch (batch=$BATCH)"
echo "  $(date '+%Y-%m-%d %H:%M %Z')"
bar

echo
echo "→ Step 1/4: Upload $BATCH videos to YouTube"
python3 scripts/youtube-upload.py --batch="$BATCH"

echo
echo "→ Step 2/4: Patch article frontmatter with new youtube_ids"
python3 scripts/inject-youtube-ids.py

echo
echo "→ Step 3/4: Regenerate tracker CSV"
python3 scripts/generate-tracker.py

echo
echo "→ Step 4/4: Draft $BATCH LinkedIn posts"
python3 scripts/draft-linkedin-batch.py --count="$BATCH"

echo
bar
echo "  ✓ Done. Review drafts in the tracker sheet, flip"
echo "    linkedin_status from 'pending_review' to 'approved'."
bar
