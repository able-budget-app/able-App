#!/usr/bin/env python3
"""
Generate yt-longform sheet rows for the 52 new articles drafted in this batch.

Matches the existing 33-column schema of the yt-longform tab. For each article:
  - Reads the article markdown frontmatter (title, meta_description, url,
    target_keyword, secondary_keywords, cluster).
  - Reads the rendered video's script.json (segment timings + eyebrows) and
    builds the YouTube-format chapter list.
  - Composes the branded yt_description with the standard blocks
    (Floor-First method, trial CTA, hashtags) and UTM-tagged links.
  - Composes the brand-prefixed yt_tags list, capped at 30.

Static columns left blank (set by other pipelines):
  notebook_url, video_duration_actual, youtube_video_id, youtube_url,
  video_drive_id, view_count_30d, clickthrough_30d, linkedin_*, notes.

Usage:
  python3 scripts/build-yt-longform-rows.py                  # stdout
  python3 scripts/build-yt-longform-rows.py --out FILE.csv   # to file

After running, paste the 52 data rows (skip the header) below the existing
76 rows of the yt-longform tab.
"""
import argparse
import csv
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "able-content"
VIDEOS = ROOT / "article-video" / "videos"
SITE = "https://becomeable.app"

# Exact column order of the existing yt-longform tab (33 columns).
HEADERS = [
    "slug", "page_url", "page_title", "page_type", "cluster", "priority",
    "status", "last_updated", "notebook_url", "source_materials", "prompt_used",
    "video_duration_target", "video_duration_actual", "youtube_video_id",
    "youtube_url", "yt_title", "yt_description", "yt_tags", "yt_thumbnail_path",
    "video_drive_id", "yt_playlist", "yt_chapters", "embed_position",
    "embed_status", "schema_status", "view_count_30d", "clickthrough_30d",
    "linkedin_post_text", "linkedin_status", "linkedin_scheduled_date",
    "linkedin_url", "linkedin_posted_date", "notes",
]

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

# Cluster-specific values.
PLAYLIST_BY_CLUSTER = {
    "budgeting": "Budgeting",
    "business": "Business",
    "taxes": "Taxes",
    "how-money-works": "How Money Works",
    "get-out-of-debt": "How to Get Out of Debt",
}

UTM_CAMPAIGN_BY_CLUSTER = {
    "budgeting": "budgeting",
    "business": "business",
    "taxes": "taxes",
    "how-money-works": "how-money-works",
    "get-out-of-debt": "get-out-of-debt",
}

HASHTAGS_BY_CLUSTER = {
    "budgeting": "#FloorFirstBudgeting #VariableIncome #FreelanceMoney",
    "business": "#FloorFirstBudgeting #VariableIncome #FreelanceBusiness",
    "taxes": "#FloorFirstBudgeting #VariableIncome #FreelanceTaxes",
    "how-money-works": "#FloorFirstBudgeting #VariableIncome #MoneyBasics",
    "get-out-of-debt": "#FloorFirstBudgeting #VariableIncome #DebtFree",
}

# Brand tags prepended to every video's yt_tags (in order).
BRAND_TAGS = [
    "Able", "Able app", "becomeable", "Floor-First Budgeting",
    "variable income", "inconsistent income",
]

CLUSTER_TAGS = {
    "budgeting": [
        "budgeting for freelancers", "1099 budgeting", "budgeting app",
        "how to budget", "freelance budget", "self-employed budget",
    ],
    "business": [
        "freelance business", "self-employed business",
        "running a small business", "solo entrepreneur",
    ],
    "taxes": [
        "freelance taxes", "1099 taxes", "self-employed taxes",
        "quarterly taxes", "estimated taxes",
    ],
    "how-money-works": [
        "personal finance", "money management", "financial literacy",
        "compound interest",
    ],
    "get-out-of-debt": [
        "debt payoff", "getting out of debt", "credit card debt",
        "debt snowball", "debt avalanche",
    ],
}

METHODOLOGY_BLOCK = (
    "📚 Floor-First Budgeting\n"
    "Per-deposit allocation that pays your bills and taxes before any "
    "dollar gets to vote on dinner. Five rules:\n"
    "1. Know your floor. Bills plus tax equal the amount you can't miss.\n"
    "2. Every deposit fills the floor first.\n"
    "3. Build your reserve before you spend.\n"
    "4. One month ahead = Able.\n"
    "5. Score reality, not the plan."
)


def parse_frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    _, fm_raw, _ = text.split("---", 2)
    return yaml.safe_load(fm_raw) or {}


def derive_slug(md_path: Path) -> str:
    """able-content/business/foo.md -> business-foo
    able-content/learn/how-money-works/bar.md -> learn-how-money-works-bar"""
    rel = md_path.relative_to(CONTENT)
    parts = list(rel.parts)
    parts[-1] = parts[-1].rsplit(".", 1)[0]
    return "-".join(parts)


def derive_cluster_key(fm: dict, slug: str) -> str:
    """Normalize cluster identifier. fm.cluster might be 'budgeting' or
    'how-money-works' (the latter for /learn/how-money-works/* articles)."""
    return (fm.get("cluster") or "").strip()


def fmt_timestamp(sec: float) -> str:
    m = int(sec // 60)
    s = int(sec % 60)
    return f"{m:02d}:{s:02d}"


def title_case(s: str) -> str:
    return " ".join(w[:1].upper() + w[1:].lower() if w else w for w in s.split())


def build_chapters(slug: str) -> str:
    """Match article-video/scripts/chapter-list.ts logic: eyebrow → title-case label,
    fallback to id. Cumulative timestamps from durationSec."""
    script_path = VIDEOS / slug / "script.json"
    if not script_path.exists():
        return ""
    script = json.loads(script_path.read_text())
    lines = []
    t = 0.0
    lines.append(f"{fmt_timestamp(t)} Intro")
    t += float(script.get("intro", {}).get("durationSec") or 5)
    for seg in script.get("segments", []):
        label_src = seg.get("eyebrow") or seg.get("id") or ""
        label = title_case(label_src)
        lines.append(f"{fmt_timestamp(t)} {label}")
        t += float(seg.get("durationSec") or 10)
    lines.append(f"{fmt_timestamp(t)} Outro")
    return "\n".join(lines)


def video_duration_total(slug: str) -> str:
    """Read total seconds from script.json (set during TTS pass)."""
    script_path = VIDEOS / slug / "script.json"
    if not script_path.exists():
        return ""
    script = json.loads(script_path.read_text())
    total = float(script.get("totalSeconds") or 0)
    if total <= 0:
        intro = float(script.get("intro", {}).get("durationSec") or 0)
        outro = float(script.get("outro", {}).get("durationSec") or 0)
        segs = sum(float(s.get("durationSec") or 0) for s in script.get("segments", []))
        total = intro + outro + segs
    if total <= 0:
        return ""
    return fmt_timestamp(total)


def make_yt_title(article_title: str) -> str:
    suffix = " | Able"
    if len(article_title) + len(suffix) <= 100:
        return article_title + suffix
    # Truncate the article title to fit.
    return article_title[: 100 - len(suffix)] + suffix


def make_description(fm: dict, slug: str, cluster_key: str) -> str:
    meta = (fm.get("meta_description") or "").strip()
    url = fm.get("url") or "/"
    campaign = UTM_CAMPAIGN_BY_CLUSTER.get(cluster_key, cluster_key)
    hashtags = HASHTAGS_BY_CLUSTER.get(cluster_key, HASHTAGS_BY_CLUSTER["budgeting"])

    article_link = (
        f"{SITE}{url}?utm_source=youtube&utm_medium=video&utm_campaign={campaign}"
    )
    trial_link = (
        f"{SITE}?utm_source=youtube&utm_medium=video&utm_campaign={campaign}"
    )

    chapters = build_chapters(slug)
    chapters_block = ("⏱ Chapters\n" + chapters) if chapters else ""

    blocks = [
        meta,
        "",
        "From Able — the budgeting app built for inconsistent income.",
        "",
        f"🔗 Read the full article: {article_link}",
    ]
    if chapters_block:
        blocks += ["", chapters_block]
    blocks += [
        "",
        METHODOLOGY_BLOCK,
        "",
        "🎁 Try Able free for 30 days",
        trial_link,
        "$14.99/month or $129/year. Card required, no charge until day 31. Cancel anytime.",
        "",
        hashtags,
    ]
    return "\n".join(blocks)[:5000]


def make_tags(fm: dict, cluster_key: str) -> str:
    tags = list(BRAND_TAGS)
    for t in CLUSTER_TAGS.get(cluster_key, []):
        if t not in tags:
            tags.append(t)
    target = (fm.get("target_keyword") or "").strip()
    if target and target not in tags:
        tags.append(target)
    for s in fm.get("secondary_keywords") or []:
        s = (s or "").strip()
        if s and s not in tags:
            tags.append(s)
    return ", ".join(tags[:30])


def build_row(md_rel: str) -> list:
    p = ROOT / md_rel
    fm = parse_frontmatter(p.read_text())
    slug = derive_slug(p)
    cluster_key = derive_cluster_key(fm, slug)
    title = (fm.get("title") or "").strip()
    url = fm.get("url") or "/"
    page_type = (fm.get("page_type") or "supporting").strip()

    yt_title = make_yt_title(title)
    yt_description = make_description(fm, slug, cluster_key)
    yt_tags = make_tags(fm, cluster_key)
    yt_thumbnail_path = f"article-video/videos/{slug}/thumbnail.png"
    yt_playlist = PLAYLIST_BY_CLUSTER.get(cluster_key, cluster_key.title())
    chapters = build_chapters(slug)
    duration_actual = video_duration_total(slug)

    return [
        slug,                                       # slug
        url,                                        # page_url
        title,                                      # page_title
        page_type,                                  # page_type
        cluster_key,                                # cluster
        "2",                                        # priority (1 = pillars, 2 = supporting)
        "ready-to-upload",                          # status
        "",                                         # last_updated
        "",                                         # notebook_url
        "(see docs/notebooklm-sources/)",           # source_materials
        "(see docs/notebooklm-youtube-spec.md)",    # prompt_used
        "3-4 min",                                  # video_duration_target
        duration_actual,                            # video_duration_actual
        "",                                         # youtube_video_id
        "",                                         # youtube_url
        yt_title,                                   # yt_title
        yt_description,                             # yt_description
        yt_tags,                                    # yt_tags
        yt_thumbnail_path,                          # yt_thumbnail_path
        "",                                         # video_drive_id
        yt_playlist,                                # yt_playlist
        chapters,                                   # yt_chapters
        "top",                                      # embed_position
        "pending",                                  # embed_status
        "pending",                                  # schema_status
        "",                                         # view_count_30d
        "",                                         # clickthrough_30d
        "",                                         # linkedin_post_text (filled by draft-linkedin-batch.py)
        "",                                         # linkedin_status
        "",                                         # linkedin_scheduled_date
        "",                                         # linkedin_url
        "",                                         # linkedin_posted_date
        "",                                         # notes
    ]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="CSV output path (default: stdout)")
    args = ap.parse_args()

    out_stream = open(args.out, "w", newline="") if args.out else sys.stdout
    writer = csv.writer(out_stream)
    writer.writerow(HEADERS)

    n = 0
    for rel in NEW_52:
        if not (ROOT / rel).exists():
            print(f"[skip] {rel} not found", file=sys.stderr)
            continue
        writer.writerow(build_row(rel))
        n += 1

    if args.out:
        out_stream.close()
    print(f"[done] wrote {n} rows ({len(HEADERS)} cols each)", file=sys.stderr)


if __name__ == "__main__":
    main()
