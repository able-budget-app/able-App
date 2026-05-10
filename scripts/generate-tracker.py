#!/usr/bin/env python3
"""
Walk able-content/ and generate a fully populated tracker CSV with one
row per article. Pre-fills:
  page_url, page_title, page_type, cluster, priority, status,
  yt_title, yt_description (boilerplate), yt_tags (default + cluster),
  yt_thumbnail_path, video_drive_id (placeholder), yt_playlist

Run: python3 scripts/generate-tracker.py

Writes to: docs/notebooklm-youtube-tracker.csv
Overwrites the file. The pre-existing pilot row is regenerated identically
since it derives from able-content/budgeting/index.md.
"""
import csv
import json
import yaml
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "able-content"
VIDEO_DIR = ROOT / "article-video" / "videos"
OUT_PATH = ROOT / "docs" / "notebooklm-youtube-tracker.csv"


def chapters_for(slug: str) -> str:
    """If a script.json with durations exists for this slug, return a
    YouTube-format chapter list. Empty string otherwise — caller leaves
    the placeholder in the description so it's obvious nothing was
    auto-filled yet."""
    sj = VIDEO_DIR / slug / "script.json"
    if not sj.exists():
        return ""
    try:
        data = json.loads(sj.read_text())
    except json.JSONDecodeError:
        return ""

    intro_d = data.get("intro", {}).get("durationSec")
    outro_d = data.get("outro", {}).get("durationSec")
    segs = data.get("segments", [])
    if not intro_d or not segs or any("durationSec" not in s for s in segs):
        # TTS hasn't run yet (durations missing). Don't fake chapters.
        return ""

    def fmt(sec: float) -> str:
        m = int(sec // 60)
        s = int(sec % 60)
        return f"{m:02d}:{s:02d}"

    lines = [f"{fmt(0)} Intro"]
    t = intro_d
    for seg in segs:
        label = (seg.get("eyebrow") or seg.get("id", "")).title()
        lines.append(f"{fmt(t)} {label}")
        t += seg["durationSec"]
    if outro_d:
        lines.append(f"{fmt(t)} Outro")
    return "\n".join(lines)

# Cluster → playlist name mapping (mirrors the Make scenario spec)
PLAYLIST_BY_CLUSTER = {
    "budgeting": "Budgeting",
    "taxes": "Taxes",
    "business": "Business",
    "learn-payself": "Learn — Pay Yourself First",
    "learn-debt": "Learn — Get Out of Debt",
    "learn-credit": "Learn — Improve Your Credit Score",
    "learn-funding": "Learn — Get Business Funding",
    "learn-money": "Learn — How Money Works",
}

# Default tags applied to every video. Topic-specific tags get overlaid.
DEFAULT_TAGS = [
    "Able", "Able app", "becomeable", "Floor-First Budgeting",
    "variable income", "inconsistent income", "budgeting for freelancers",
    "1099 budgeting", "budgeting app",
]
CLUSTER_TAGS = {
    "budgeting": ["how to budget", "freelance budget", "self-employed budget"],
    "taxes":     ["quarterly taxes", "self-employment tax", "1099 taxes", "tax deduction"],
    "business":  ["small business credit", "emergency fund", "business cash flow"],
    "learn-payself": ["pay yourself first", "owner pay", "owner draw"],
    "learn-debt":    ["how to get out of debt", "debt snowball", "debt avalanche"],
    "learn-credit":  ["credit score", "improve credit", "FICO score"],
    "learn-funding": ["small business loan", "SBA loan", "business credit"],
    "learn-money":   ["compound interest", "rule of 72", "money management"],
}

# YouTube description template — first 157 chars are the SEO snippet.
def description_for(meta: dict, page_url: str, cluster: str, chapters: str) -> str:
    hook = meta.get("meta_description") or meta.get("title", "")
    title = meta.get("title", "").rstrip(" .")
    utm = f"utm_source=youtube&utm_medium=video&utm_campaign={cluster}"
    chapters_block = chapters if chapters else "00:00 Intro\n(fill from script.json before publish)"
    return (
        f"{hook}\n"
        f"\n"
        f"From Able — the budgeting app built for inconsistent income.\n"
        f"\n"
        f"🔗 Read the full article: https://becomeable.app{page_url}?{utm}\n"
        f"\n"
        f"⏱ Chapters\n"
        f"{chapters_block}\n"
        f"\n"
        f"📚 Floor-First Budgeting\n"
        f"Per-deposit allocation that pays your bills and taxes before any dollar gets to vote on dinner. Five rules:\n"
        f"1. Know your floor. Bills plus tax equal the amount you can't miss.\n"
        f"2. Every deposit fills the floor first.\n"
        f"3. Build your reserve before you spend.\n"
        f"4. One month ahead = Able.\n"
        f"5. Score reality, not the plan.\n"
        f"\n"
        f"🎁 Try Able free for 30 days\n"
        f"https://becomeable.app?{utm}\n"
        f"$14.99/month or $129/year. Card required, no charge until day 31. Cancel anytime.\n"
        f"\n"
        f"#FloorFirstBudgeting #VariableIncome #FreelanceMoney"
    )


def derive_slug(article_path: Path) -> str:
    """Slug for the article-video folder. budgeting/index.md → budgeting,
    taxes/how-much-to-set-aside.md → taxes-how-much-to-set-aside,
    learn/pay-yourself-first/index.md → learn-pay-yourself-first."""
    rel = article_path.relative_to(CONTENT_DIR)
    parts = list(rel.parts)
    if parts[-1] == "index.md":
        parts = parts[:-1]
    else:
        parts[-1] = parts[-1].replace(".md", "")
    return "-".join(parts)


def parse_frontmatter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}
    yaml_block = text[4:end]
    try:
        return yaml.safe_load(yaml_block) or {}
    except yaml.YAMLError as e:
        print(f"  [warn] YAML parse failed for {path}: {e}", file=sys.stderr)
        return {}


def yt_title(meta: dict) -> str:
    """YouTube title — pull from meta_title first (already keyword-aware),
    fall back to title. Cap at 90 chars."""
    t = meta.get("meta_title") or meta.get("title") or ""
    return t[:90]


def main():
    rows = []
    for md_path in sorted(CONTENT_DIR.rglob("*.md")):
        if md_path.name == "README.md":
            continue
        meta = parse_frontmatter(md_path)
        if not meta:
            print(f"  [skip] no frontmatter: {md_path}", file=sys.stderr)
            continue
        slug = derive_slug(md_path)
        cluster = meta.get("cluster", "")
        page_type = meta.get("page_type", "supporting")
        page_url = meta.get("url", "")
        priority = "1" if page_type == "pillar" else "2"

        tags = ", ".join(DEFAULT_TAGS + CLUSTER_TAGS.get(cluster, []))
        playlist = PLAYLIST_BY_CLUSTER.get(cluster, "Misc")

        chapters = chapters_for(slug)
        # Compute total runtime if we have one (from durations in script.json)
        sj = VIDEO_DIR / slug / "script.json"
        total = ""
        if sj.exists():
            try:
                d = json.loads(sj.read_text())
                if d.get("totalSeconds"):
                    m = int(d["totalSeconds"] // 60)
                    s = int(d["totalSeconds"] % 60)
                    total = f"{m}:{s:02d}"
            except Exception:
                pass

        rows.append({
            "slug": slug,
            "page_url": page_url,
            "page_title": meta.get("title", ""),
            "page_type": page_type,
            "cluster": cluster,
            "priority": priority,
            "status": "draft",
            "last_updated": "",
            "notebook_url": "",
            "source_materials": "(see docs/notebooklm-sources/)",
            "prompt_used": "(see docs/notebooklm-youtube-spec.md)",
            "video_duration_target": "3-4 min",
            "video_duration_actual": total,
            "youtube_video_id": "",
            "youtube_url": "",
            "yt_title": yt_title(meta),
            "yt_description": description_for(meta, page_url, cluster, chapters),
            "yt_tags": tags,
            "yt_thumbnail_path": f"article-video/videos/{slug}/thumbnail.png",
            "video_drive_id": "",  # filled when uploaded to Drive
            "yt_playlist": playlist,
            "yt_chapters": chapters,
            "embed_position": "top",
            "embed_status": "pending",
            "schema_status": "pending",
            "view_count_30d": "",
            "clickthrough_30d": "",
            "notes": "",
        })

    # Sort: pillars first, then alphabetical within cluster
    rows.sort(key=lambda r: (r["page_type"] != "pillar", r["cluster"], r["slug"]))

    fieldnames = list(rows[0].keys())
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(rows)

    pillars = sum(1 for r in rows if r["page_type"] == "pillar")
    supporting = len(rows) - pillars
    print(f"[tracker] wrote {OUT_PATH.relative_to(ROOT)}")
    print(f"          {len(rows)} rows: {pillars} pillars, {supporting} supporting")
    by_cluster = {}
    for r in rows:
        by_cluster[r["cluster"]] = by_cluster.get(r["cluster"], 0) + 1
    for c, n in sorted(by_cluster.items()):
        print(f"            {c}: {n}")


if __name__ == "__main__":
    main()
