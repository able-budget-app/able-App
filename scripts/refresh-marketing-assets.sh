#!/usr/bin/env bash
# refresh-marketing-assets.sh
# One-command refresh of the entire phone-frame marketing library.
#
# Pipeline:
#   1. capture-product-shots.py — 13 raw + 52 composed phone-frame shots
#      (9 base re-captures against current app.html + 4 new screens)
#   2. render-product-templates.py — 7 use-templates + 8 BrandScript
#      templates rendered against the fresh base shots = 60 PNGs
#   3. render-lifestyle-shots.py — 15 lifestyle scenes × 4 aspects = 60 PNGs
#
# Total output: ~172 fresh PNGs in marketing-footage/product-shots/
# Runtime: ~10-15 minutes on M-series Mac.
#
# Run from anywhere:
#   bash scripts/refresh-marketing-assets.sh
# Or:
#   ./scripts/refresh-marketing-assets.sh   (after chmod +x)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "─────────────────────────────────────────"
echo " Refreshing marketing-footage library"
echo " Root: $ROOT"
echo "─────────────────────────────────────────"
echo

t0=$(date +%s)

echo "[1/3] Capturing base + new screens..."
python3 scripts/capture-product-shots.py
echo

echo "[2/3] Rendering templates + brandscript variants..."
python3 scripts/render-product-templates.py
echo

echo "[3/3] Rendering lifestyle scenes..."
python3 scripts/render-lifestyle-shots.py
echo

t1=$(date +%s)
elapsed=$((t1 - t0))

echo "─────────────────────────────────────────"
echo " Done in ${elapsed}s"
echo
echo " Asset counts:"
echo "   raw:                 $(find marketing-footage/product-shots/_raw -name '*.png' | wc -l | tr -d ' ')"
echo "   base composed:       $(find marketing-footage/product-shots -maxdepth 2 -name '*.png' -path '*-*' -not -path '*/_raw/*' -not -path '*/templates*' -not -path '*/lifestyle/*' -not -path '*/_*' | wc -l | tr -d ' ')"
echo "   templates:           $(find marketing-footage/product-shots/templates -name '*.png' | wc -l | tr -d ' ')"
echo "   templates-brandscript: $(find marketing-footage/product-shots/templates-brandscript -name '*.png' | wc -l | tr -d ' ')"
echo "   lifestyle:           $(find marketing-footage/product-shots/lifestyle -name '*.png' | wc -l | tr -d ' ')"
echo "─────────────────────────────────────────"
