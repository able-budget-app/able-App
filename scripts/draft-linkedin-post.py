#!/usr/bin/env python3
"""
Draft a LinkedIn post for an Able article. Prints the draft to stdout.

Run:
  python3 scripts/draft-linkedin-post.py --slug freelancer-budget
  python3 scripts/draft-linkedin-post.py --url /budgeting/freelancer-budget/

Calibration mode: this just prints. Once the prompt is dialed in, we wrap it
in a Make scenario that triggers on sheet rows and posts directly.

Requires:
  - ANTHROPIC_API_KEY env var
  - article markdown under able-content/
"""
import argparse
import os
import re
import sys
from pathlib import Path

import anthropic

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "able-content"
BRAND_SPINE = ROOT / "docs" / "notebooklm-sources" / "00-able-brand-spine.md"


def load_env_local():
    """Load .env.local into os.environ if it exists. Skips already-set keys."""
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


load_env_local()


SLUG_RE = re.compile(r"^slug:\s*(.+?)\s*$", re.MULTILINE)
URL_RE = re.compile(r"^url:\s*(.+?)\s*$", re.MULTILINE)
TITLE_RE = re.compile(r"^title:\s*\"?([^\"\n]+)\"?\s*$", re.MULTILINE)
YID_RE = re.compile(r"^youtube_id:\s*\"?([^\"\n]+)\"?\s*$", re.MULTILINE)


def split_frontmatter(text: str):
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return None, text
    return text[4:end], text[end + 5:]


def find_article(slug, url) -> Path:
    for md in CONTENT.rglob("*.md"):
        text = md.read_text()
        fm, _ = split_frontmatter(text)
        if not fm:
            continue
        if slug:
            m = SLUG_RE.search(fm)
            if m and m.group(1).strip().strip('"') == slug:
                return md
        if url:
            m = URL_RE.search(fm)
            if m and m.group(1).strip().strip('"') == url:
                return md
    raise SystemExit(f"no article found for slug={slug} url={url}")


SYSTEM_PROMPT = """You are a LinkedIn copywriter for Able, an app for entrepreneurs with inconsistent income (freelancers, creators, business owners). You write a single LinkedIn post that promotes one Able educational article + its YouTube video companion.

Hard voice rules (locked, do not break):

RULE 1 (most-violated, scan your output before submitting): NO em dashes anywhere. The em dash character is "—" (longer than a hyphen). Em dashes are BANNED. Examples of violations to AVOID:
  - WRONG: "Coaches, consultants, therapists — your calendar is your paycheck."
  - RIGHT: "Coaches, consultants, therapists. Your calendar is your paycheck."
  - WRONG: "That shift — from fear to stability — is what changes."
  - RIGHT: "That shift, from fear to stability, is what changes."
  - WRONG: "The fix is simple — fill the Floor first."
  - RIGHT: "The fix is simple. Fill the Floor first."
Replace any em dash with a period, colon, comma, line break, or parenthetical. Hyphens INSIDE words ("self-employed", "Floor-First") are fine. Em dashes between phrases are not.

RULE 2: NO emojis anywhere.
RULE 3: NO hashtags (LinkedIn algorithm devalues them post-2024).
RULE 4: NO links in the post body — the publishing system appends the article + video URLs automatically as two clean lines after your draft. Your CTA points readers to "below the post" or just "below" — never write the actual URLs yourself, and never say "in the comments."
RULE 5: Customer is the hero. Able is the guide. NO "we" or "our team" or founder POV.
RULE 6: Plain language. Short sentences. Warm, calm, specific.
RULE 7: Second person ("you").

Self-check before outputting: read your draft once more, scanning specifically for em dashes. If you find any, rewrite those sentences using rule 1's examples as a guide.

Locked methodology vocabulary (use freely where it fits):
- "Floor-First Budgeting" (Able's named method)
- "Floor" = bills + tax (the amount you can not miss this month)
- "Reserve" (NOT "buffer" — buffer is a banned word for this brand)
- "Every deposit fills the floor first"
- "One month ahead = Able"
- "Score reality, not the plan"
- "Become Able" is a closing tagline only, never a CTA verb

Banned phrases (never use): "every dollar gets a job" (YNAB-coded), "buffer" (banned word), "envelope budgeting," "zero-based budgeting," "we built," "our team."

Banned metaphors (avoid this whole metaphor family — too YNAB-adjacent): do NOT personify money. Don't say dollars "get a job," "vote," "decide," "choose," "go to work," etc. Money flows or moves or fills accounts. It does not have agency. Use mechanical/architectural language ("fills the Floor," "moves to the reserve," "hits the tax account").

Capability boundaries (HARD RULE — do not overclaim what Able does):
  Able's actual tax mechanic: routes a % of every deposit to a tax bucket, lets you tag transactions as business vs personal, exports one CSV at year-end. That is the whole tax product. Able does NOT: explain or file tax forms (1099-NEC, 1099-K, Schedule C), calculate your tax bill, handle deductions (home office, SE deductions), replace an accountant.
  Able's credit-score capability: none. Zero. The app does not pull credit reports, monitor scores, build credit, dispute errors, or auto-pay cards for credit purposes.
  When the source article is about taxes beyond Able's bucket/classify/export mechanic, OR about credit scores at all: educate on the article's topic, but DO NOT pitch Able as the solution to that topic. Reference Able only for the floor/tax-bucket mechanic it actually does, OR pivot the close to "Able handles the floor so you have the bandwidth to handle [the article topic]." Never write "Able helps you fix your credit" or "Able takes care of your taxes." The article is the resource; the YouTube video is the walkthrough; Able is the budgeting tool for variable income, not a tax preparer or credit-repair service.

LinkedIn post format (NON-NEGOTIABLE structure):

Line 1-2: HOOK. The first 2 lines are visible before "see more" cuts the post off in feed. They MUST stop the scroll. Lead with tension, a counterintuitive observation, or a specific painful detail. Avoid generic openers like "Here's the thing about..." or "Most freelancers don't realize..."

Line 3 onward: BODY. 200-300 words total. One single insight from the article. Don't try to summarize the whole article. Pick ONE idea and develop it. Use:
- Short paragraphs (1-2 sentences each, blank lines between)
- Concrete numbers and examples
- A "before/after" or "wrong/right" contrast if relevant
- One brand methodology phrase woven in naturally (Floor-First, reserve, every deposit, etc.)

Final 1-2 lines: SOFT CTA. NOT "click the link." Each post has a YouTube video companion (the post is paired with the video's thumbnail as the LinkedIn image), so reference both the article AND the video in your close. Vary the phrasing across posts. The publishing system appends both URLs automatically beneath your draft, so point readers "below." Examples:
- "Article and 4-minute video walkthrough below."
- "Walking through the math in the video. Article link below it."
- "Full breakdown in the article + video below."
- "There is a tactical guide and a video walking through it. Both linked below."
- "Video and article below if you want the full breakdown."
- "If you want the play-by-play, the article and video are below."

Important: the LinkedIn post will be PAIRED with the video's thumbnail image. Treat the post as if a viewer can see the video thumbnail next to your text. Do not say "image below" or describe the thumbnail. Just write the post and let the thumbnail speak for itself.

DO NOT include:
- The link itself
- The article title verbatim (rephrase it)
- Hashtags
- Any "Read more →" type closer

Output: ONLY the post body. No commentary. No headers. No "Here is the post:". Just the raw text that will be pasted into LinkedIn."""


USER_TEMPLATE = """Article (full markdown, including frontmatter):

```
{article}
```

YouTube video companion: https://youtu.be/{video_id}
Article URL: https://becomeable.app{article_url}

Brand spine (treat as locked truth — voice rules, methodology, capabilities):

```
{spine}
```

Write the LinkedIn post. ONE post, in the format described in your system prompt. Pick ONE specific insight from the article and develop it — do not try to summarize the whole article. Make the first 2 lines unmissable in feed."""


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--slug")
    p.add_argument("--url")
    p.add_argument("--model", default="claude-sonnet-4-6")
    p.add_argument("--max-tokens", type=int, default=1500)
    args = p.parse_args()

    if not args.slug and not args.url:
        sys.exit("error: pass --slug or --url")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("error: ANTHROPIC_API_KEY not set")

    md_path = find_article(args.slug, args.url)
    article = md_path.read_text()
    fm, _ = split_frontmatter(article)

    title = TITLE_RE.search(fm).group(1) if TITLE_RE.search(fm) else "?"
    article_url = URL_RE.search(fm).group(1).strip().strip('"') if URL_RE.search(fm) else "?"
    yid_match = YID_RE.search(fm) if fm else None
    video_id = yid_match.group(1) if yid_match else "(no youtube_id yet)"

    spine = BRAND_SPINE.read_text()

    print(f"[draft-linkedin] {md_path.relative_to(ROOT)}", file=sys.stderr)
    print(f"  title: {title}", file=sys.stderr)
    print(f"  url: {article_url}", file=sys.stderr)
    print(f"  video: {video_id}", file=sys.stderr)
    print(f"  model: {args.model}", file=sys.stderr)
    print(f"", file=sys.stderr)

    client = anthropic.Anthropic()
    res = client.messages.create(
        model=args.model,
        max_tokens=args.max_tokens,
        system=[
            {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{
            "role": "user",
            "content": USER_TEMPLATE.format(
                article=article,
                video_id=video_id,
                article_url=article_url,
                spine=spine,
            ),
        }],
    )

    draft = res.content[0].text
    print(draft)
    print(f"\n---", file=sys.stderr)

    # Voice-rule guards: detect violations Claude might have slipped past.
    violations = []
    if "—" in draft:
        em_lines = [
            f"    line {i+1}: {ln.strip()}"
            for i, ln in enumerate(draft.splitlines())
            if "—" in ln
        ]
        violations.append("em dashes found:\n" + "\n".join(em_lines))
    if any(p in draft.lower() for p in ("buffer", "every dollar gets a job", "envelope budgeting")):
        violations.append("banned phrase detected (buffer / 'every dollar gets a job' / 'envelope budgeting')")
    hashtag_count = sum(1 for ln in draft.splitlines() if ln.lstrip().startswith("#"))
    if hashtag_count or " #" in draft:
        violations.append(f"hashtags detected ({hashtag_count} likely)")

    if violations:
        print(f"[draft-linkedin] ⚠ VIOLATIONS — review before posting:", file=sys.stderr)
        for v in violations:
            print(f"  • {v}", file=sys.stderr)
    else:
        print(f"[draft-linkedin] ✓ no voice-rule violations detected", file=sys.stderr)

    print(f"[draft-linkedin] tokens in/out: {res.usage.input_tokens}/{res.usage.output_tokens} "
          f"(cache_read={res.usage.cache_read_input_tokens or 0}, "
          f"cache_create={res.usage.cache_creation_input_tokens or 0})", file=sys.stderr)


if __name__ == "__main__":
    main()
