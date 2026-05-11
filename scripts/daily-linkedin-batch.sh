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

# Make sure SHEET_ID is in env (drafter needs it). Hardcoded fallback below.
if [[ -f .env.local ]] && grep -q "^SHEET_ID=" .env.local; then
    set -a; source <(grep "^SHEET_ID=" .env.local); set +a
fi
: "${SHEET_ID:=1sJvQ3PtEbeizyJLVhEFv3-YgOBZGuiwzb3EdkKXv3ro}"
export SHEET_ID

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
