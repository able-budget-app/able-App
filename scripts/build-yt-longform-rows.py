#!/usr/bin/env python3
"""
Generate yt-longform sheet rows for the 52 new articles drafted in this batch.

For each article markdown, derives:
  slug:               cluster-prefixed slug matching article-video/videos/<slug>/
  status:             ready-to-upload
  yt_title:           article title (capped 100 chars, YouTube limit)
  yt_description:     meta_description + article URL + trial CTA (capped 5000)
  yt_tags:            target_keyword + secondary_keywords joined, max 30
  youtube_video_id:   empty

Usage:
  python3 scripts/build-yt-longform-rows.py                  # prints CSV to stdout
  python3 scripts/build-yt-longform-rows.py --out FILE.csv   # writes to file

After running, paste the CSV body (skip the header if your sheet already has
one) into the yt-longform tab of the mega-workbook. The upload script will
then pick these rows up as `ready-to-upload`.
"""
import argparse
import csv
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "able-content"
SITE = "https://becomeable.app"

NEW_52 = [
    "able-content/business/profit-margins-for-service-businesses.md",
    "able-content/business/owner-draws-vs-salary.md",
    "able-content/business/scope-creep-defense.md",
    "able-content/business/setting-prices-variable-income.md",
    "able-content/business/invoicing-101-for-freelancers.md",
    "able-content/business/bookkeeping-basics-for-solo-operators.md",
    "able-content/business/business-banking-101.md",
    "able-content/business/llc-vs-sole-prop.md",
    "able-content/business/cash-flow-basics-service-business.md",
    "able-content/business/building-a-business-reserve.md",
    "able-content/business/hiring-your-first-contractor.md",
    "able-content/business/firing-a-bad-client.md",
    "able-content/business/business-deductions-overview.md",
    "able-content/business/health-insurance-for-self-employed.md",
    "able-content/business/retirement-saving-variable-income.md",
    "able-content/business/first-90-days-self-employment.md",
    "able-content/business/year-end-financial-routine.md",
    "able-content/business/when-to-raise-your-rates.md",
    "able-content/business/finding-an-accountant.md",
    "able-content/business/the-deposit-up-front-conversation.md",
    "able-content/business/scaling-from-solo-to-small-team.md",
    "able-content/business/diversifying-revenue-streams.md",
    "able-content/business/end-of-quarter-financial-checkup.md",
    "able-content/business/networking-on-variable-income.md",
    "able-content/business/business-credit-cards-for-self-employed.md",
    "able-content/business/transitioning-from-w2-to-self-employed.md",
    "able-content/business/sabbatical-or-extended-time-off-self-employed.md",
    "able-content/business/the-yearly-strategy-day.md",
    "able-content/budgeting/handling-a-windfall.md",
    "able-content/budgeting/surviving-a-slow-month.md",
    "able-content/budgeting/managing-cash-income.md",
    "able-content/budgeting/couples-on-variable-income.md",
    "able-content/budgeting/per-deposit-method-explained.md",
    "able-content/budgeting/why-monthly-budgets-fail-variable-income.md",
    "able-content/budgeting/tracking-recurring-charges.md",
    "able-content/budgeting/the-30-day-trial-mindset.md",
    "able-content/budgeting/the-good-month-rules.md",
    "able-content/budgeting/holiday-season-budgeting.md",
    "able-content/budgeting/saving-for-irregular-expenses.md",
    "able-content/budgeting/what-to-do-with-an-unexpected-deposit.md",
    "able-content/budgeting/personal-vs-business-spending-line.md",
    "able-content/budgeting/the-mid-month-financial-check.md",
    "able-content/budgeting/how-to-recover-from-a-financial-setback.md",
    "able-content/budgeting/teaching-your-partner-the-per-deposit-method.md",
    "able-content/taxes/estimated-tax-penalties-explained.md",
    "able-content/taxes/sales-tax-basics-for-service-businesses.md",
    "able-content/learn/how-money-works/setting-financial-goals-on-variable-income.md",
    "able-content/learn/how-money-works/the-true-cost-of-debt.md",
    "able-content/learn/how-money-works/emergency-fund-vs-business-reserve.md",
    "able-content/learn/how-money-works/the-cost-of-a-financial-decision.md",
    "able-content/learn/get-out-of-debt/avalanche-vs-snowball-variable-income.md",
    "able-content/learn/get-out-of-debt/negotiating-with-creditors-when-self-employed.md",
]


def derive_slug(md_path: Path) -> str:
    """able-content/business/foo.md -> business-foo
    able-content/learn/how-money-works/bar.md -> learn-how-money-works-bar"""
    rel = md_path.relative_to(CONTENT)
    parts = list(rel.parts)
    parts[-1] = parts[-1].rsplit(".", 1)[0]
    return "-".join(parts)


def make_description(fm: dict) -> str:
    meta = fm.get("meta_description", "")
    url = fm.get("url", "/")
    full_url = f"{SITE}{url}"
    parts = [
        meta,
        "",
        f"Read the full article: {full_url}",
        "",
        "Able is the budgeting app built for self-employed people with",
        "variable income. Every deposit splits across tax, bills, reserve,",
        "and debt automatically. Start a 30-day free trial:",
        f"{SITE}/get-able",
    ]
    return "\n".join(parts)[:5000]


def make_tags(fm: dict) -> str:
    target = fm.get("target_keyword", "")
    secondary = fm.get("secondary_keywords", []) or []
    tags = []
    if target:
        tags.append(target.strip())
    for s in secondary:
        if not s:
            continue
        s = s.strip()
        if s and s not in tags:
            tags.append(s)
    return ", ".join(tags[:30])


def parse_frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    _, fm_raw, _ = text.split("---", 2)
    return yaml.safe_load(fm_raw) or {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="CSV output path (default: stdout)")
    args = ap.parse_args()

    out_stream = open(args.out, "w", newline="") if args.out else sys.stdout
    writer = csv.writer(out_stream)
    writer.writerow(
        ["slug", "status", "yt_title", "yt_description", "yt_tags", "youtube_video_id"]
    )

    n = 0
    for rel in NEW_52:
        p = ROOT / rel
        if not p.exists():
            print(f"[skip] {rel} not found", file=sys.stderr)
            continue
        fm = parse_frontmatter(p.read_text())
        slug = derive_slug(p)
        title = (fm.get("title") or "")[:100]
        description = make_description(fm)
        tags = make_tags(fm)
        writer.writerow([slug, "ready-to-upload", title, description, tags, ""])
        n += 1

    if args.out:
        out_stream.close()
    print(f"[done] wrote {n} rows", file=sys.stderr)


if __name__ == "__main__":
    main()
