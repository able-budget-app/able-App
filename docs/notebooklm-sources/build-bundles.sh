#!/usr/bin/env bash
# Regenerate the NotebookLM source bundles.
# Run from repo root: ./docs/notebooklm-sources/build-bundles.sh
set -euo pipefail

cd "$(dirname "$0")/../.."  # repo root
OUT=docs/notebooklm-sources

# ──────────────────────────────────────────────────────────────────
# 00 — Brand spine (the always-include bundle)
# ──────────────────────────────────────────────────────────────────
{
  echo "# Able Brand Spine — NotebookLM Source Bundle"
  echo ""
  echo "**This document is the canonical brand spine for every NotebookLM notebook generated for Able content.** It bundles the three always-include sources so they live as one Google Doc instead of three. Paste this whole file into one Google Doc, share with edit access, and link that Google Doc as a source in every notebook."
  echo ""
  echo "Three sections:"
  echo "1. Brand script — voice, locked phrases, StoryBrand spine"
  echo "2. Floor-First Budgeting — the methodology (5 rules)"
  echo "3. Able app capabilities — what the app actually does today"
  echo ""
  echo "If any of the underlying source files change, regenerate this bundle from \`docs/notebooklm-sources/build-bundles.sh\` and re-paste."
  echo ""
  echo "---"
  echo ""
  echo "# 1. BRAND SCRIPT"
  echo ""
  cat docs/brand-script.md
  echo ""
  echo "---"
  echo ""
  echo "# 2. FLOOR-FIRST BUDGETING (METHODOLOGY)"
  echo ""
  cat docs/floor-first-method.md
  echo ""
  echo "---"
  echo ""
  echo "# 3. ABLE APP CAPABILITIES (WHAT THE APP ACTUALLY DOES)"
  echo ""
  cat ~/.claude/skills/able-app-capabilities/SKILL.md
} > $OUT/00-able-brand-spine.md

# ──────────────────────────────────────────────────────────────────
# Cluster bundles
# ──────────────────────────────────────────────────────────────────
build_cluster() {
  local out_file=$1
  local cluster_label=$2
  local cluster_intro=$3
  shift 3
  {
    echo "# $cluster_label Cluster — NotebookLM Source Bundle"
    echo ""
    echo "$cluster_intro"
    echo ""
    echo "---"
    for f in "$@"; do
      if [ -f "$f" ]; then
        echo ""
        echo "---"
        echo ""
        echo "# Article: $(basename $f .md | sed 's/^index$/cluster-index/')"
        echo ""
        cat "$f"
      fi
    done
  } > "$out_file"
}

build_cluster "$OUT/budgeting-bundle.md" "Budgeting" \
  "All articles in the budgeting cluster bundled into one Google Doc. Pillar first, then supporting articles (audience-targeted budgets + the methodology adjacent pieces). Paste into one Google Doc, share, and link as a source whenever you generate a budgeting-cluster video." \
  able-content/budgeting/index.md \
  able-content/budgeting/freelancer-budget.md \
  able-content/budgeting/creator-budget.md \
  able-content/budgeting/feast-or-famine.md \
  able-content/budgeting/pay-yourself-steady-paycheck.md \
  able-content/budgeting/commission-income-budget.md \
  able-content/budgeting/coach-consultant-budget.md \
  able-content/budgeting/designer-developer-budget.md \
  able-content/budgeting/etsy-seller-budget.md \
  able-content/budgeting/real-estate-agent-budget.md \
  able-content/budgeting/rideshare-driver-budget.md

build_cluster "$OUT/taxes-bundle.md" "Taxes" \
  "All articles in the taxes cluster bundled into one Google Doc. Pillar first, then the 7 supporting articles. Paste into one Google Doc, share, and link as a source whenever you generate a taxes-cluster video." \
  able-content/taxes/index.md \
  able-content/taxes/how-much-to-set-aside.md \
  able-content/taxes/bad-month-quarterly-taxes.md \
  able-content/taxes/self-employment-tax-deductions.md \
  able-content/taxes/home-office-deduction.md \
  able-content/taxes/schedule-c-walkthrough.md \
  able-content/taxes/1099-nec-explained.md \
  able-content/taxes/1099-k-explained.md

build_cluster "$OUT/business-bundle.md" "Business" \
  "Currently 2 articles. Pillar + emergency-fund. Paste into one Google Doc." \
  able-content/business/index.md \
  able-content/business/emergency-fund.md

build_cluster "$OUT/learn-bundle.md" "Learn" \
  "Self-contained learning paths. Each was originally a sub-pillar with its own structure. Bundled together here so one Google Doc carries the whole learn cluster." \
  able-content/learn/pay-yourself-first/index.md \
  able-content/learn/how-money-works/index.md \
  able-content/learn/get-out-of-debt/index.md \
  able-content/learn/get-business-funding/index.md \
  able-content/learn/improve-your-credit-score/index.md

build_cluster "$OUT/inconsistent-income-data-bundle.md" "Inconsistent Income Data" \
  "Stats-led cluster. Pillar + 2 supporting articles backed by 2025-2026 survey data on the 77M+ Americans with inconsistent income. Bundle this Google Doc as a NotebookLM source for the inconsistent-income-data long-form video and any data-led derivatives. Always include docs/statistics.md as a second source for full citations." \
  able-content/learn/inconsistent-income-data/index.md \
  able-content/learn/inconsistent-income-data/why-87-percent-struggle-to-budget.md \
  able-content/learn/inconsistent-income-data/inside-77-million-variable-income-workers.md \
  docs/statistics.md

echo "[bundles] regenerated:"
wc -l $OUT/*.md
