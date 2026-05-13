#!/usr/bin/env python3
"""
Weekly LinkedIn batch drafter. Picks the next N eligible articles, drafts
LinkedIn posts via Claude, writes drafts back to the YouTube tracker sheet
with status='pending_review' and a scheduled_date (next Tue / next Thu).

You then review the drafts in the sheet — edit if needed, flip linkedin_status
to 'approved'. The Make scenario will fire them on schedule.

Run weekly (Sunday afternoon is ideal):
  python3 scripts/draft-linkedin-batch.py             # default --count=2
  python3 scripts/draft-linkedin-batch.py --count=3   # 3 drafts (e.g. catch-up week)
  python3 scripts/draft-linkedin-batch.py --dry-run   # preview without writing

Eligibility: rows where youtube_video_id is populated AND linkedin_status is empty.
Re-runs are safe — already-drafted rows are skipped.

Pass --overwrite to re-draft rows that already have a draft. This preserves
linkedin_scheduled_date (won't reshuffle the calendar) but replaces the text
and resets linkedin_status to 'pending_review'.

Requires:
  - secrets/google-oauth-token.json  (from scripts/youtube-upload.py first run)
  - ANTHROPIC_API_KEY in .env.local or environment
  - SHEET_ID env var
"""
import argparse
import os
import random
import re
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import anthropic
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "able-content"
BRAND_SPINE = ROOT / "docs" / "notebooklm-sources" / "00-able-brand-spine.md"
TOKEN_FILE = ROOT / "secrets" / "google-oauth-token.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/spreadsheets",
]


def load_env_local():
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


def split_frontmatter(text):
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return None, text
    return text[4:end], text[end + 5:]


# ─── Drafting prompt (kept in sync with scripts/draft-linkedin-post.py) ────

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


# ─── Sheets helpers ────────────────────────────────────────────────────

def col_letter(idx):
    out = ""
    while True:
        out = chr(ord("A") + idx % 26) + out
        idx = idx // 26 - 1
        if idx < 0:
            return out


def load_creds():
    if not TOKEN_FILE.exists():
        sys.exit(
            f"Missing {TOKEN_FILE.relative_to(ROOT)}. "
            f"Run scripts/youtube-upload.py --dry-run once to complete OAuth."
        )
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def _execute_with_retry(req, attempts=4, base_delay=2.0):
    """Run a googleapiclient request with exponential backoff on transient errors.
    Retries on 429/500/502/503/504; re-raises on auth, quota, or other 4xx."""
    for n in range(attempts):
        try:
            return req.execute()
        except HttpError as e:
            status = getattr(e.resp, "status", 0)
            if status not in (429, 500, 502, 503, 504) or n == attempts - 1:
                raise
            delay = base_delay * (2 ** n) + random.uniform(0, 1)
            print(f"  [retry] Google API {status}, sleeping {delay:.1f}s ({n + 1}/{attempts - 1})", file=sys.stderr)
            time.sleep(delay)


def get_sheet(sheets_svc, sheet_id):
    req = sheets_svc.spreadsheets().values().get(
        spreadsheetId=sheet_id, range="A1:ZZ"
    )
    res = _execute_with_retry(req)
    values = res.get("values", [])
    if not values:
        sys.exit("error: sheet empty")
    return values[0], values[1:]


def update_cell(sheets_svc, sheet_id, row_1based, col_idx, value):
    cell = f"{col_letter(col_idx)}{row_1based}"
    req = sheets_svc.spreadsheets().values().update(
        spreadsheetId=sheet_id, range=cell, valueInputOption="RAW",
        body={"values": [[value]]},
    )
    _execute_with_retry(req)


# ─── Schedule helper ───────────────────────────────────────────────────

def next_tue_thu(start_date, count):
    """Return the next `count` Tue/Thu dates strictly after `start_date`."""
    days = []
    d = start_date + timedelta(days=1)
    while len(days) < count:
        if d.weekday() in (1, 3):  # Tue=1, Thu=3
            days.append(d)
        d += timedelta(days=1)
    return days


# ─── Draft a single post ───────────────────────────────────────────────

def find_article_by_url(article_url):
    for md in CONTENT.rglob("*.md"):
        text = md.read_text()
        fm, _ = split_frontmatter(text)
        if not fm:
            continue
        m = URL_RE.search(fm)
        if m and m.group(1).strip().strip('"') == article_url:
            return md
    return None


def draft_post(client, article_md, article_url, video_id, spine):
    article_text = article_md.read_text()
    res = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=[
            {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{
            "role": "user",
            "content": USER_TEMPLATE.format(
                article=article_text,
                video_id=video_id or "(no youtube_id yet)",
                article_url=article_url,
                spine=spine,
            ),
        }],
    )
    return res.content[0].text, res.usage


def check_violations(draft):
    issues = []
    if "—" in draft:
        issues.append("em dashes")
    if "buffer" in draft.lower():
        issues.append("'buffer' banned phrase")
    if "every dollar gets a job" in draft.lower():
        issues.append("'every dollar gets a job' banned")
    if any(ln.lstrip().startswith("#") for ln in draft.splitlines()) or " #" in draft:
        issues.append("hashtags")
    return issues


# ─── Main ───────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--count", type=int, default=2, help="Number of drafts to generate (default 2)")
    p.add_argument("--sheet-id", help="Google Sheet ID (or SHEET_ID env)")
    p.add_argument("--dry-run", action="store_true", help="Generate drafts but don't write to sheet")
    p.add_argument("--overwrite", action="store_true",
                   help="Re-draft rows that already have a draft. Preserves linkedin_scheduled_date.")
    args = p.parse_args()

    sheet_id = args.sheet_id or os.environ.get("SHEET_ID")
    if not sheet_id:
        sys.exit("error: pass --sheet-id or set SHEET_ID env")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("error: ANTHROPIC_API_KEY not set (add to .env.local)")

    creds = load_creds()
    sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
    header, rows = get_sheet(sheets, sheet_id)
    cols = {h.strip(): i for i, h in enumerate(header)}

    required_cols = (
        "page_url", "youtube_video_id",
        "linkedin_post_text", "linkedin_status",
        "linkedin_scheduled_date",
    )
    missing = [c for c in required_cols if c not in cols]
    if missing:
        sys.exit(
            f"error: sheet is missing columns: {missing}\n"
            f"Add these column headers to row 1 of the sheet, then retry."
        )

    # Find eligible rows
    queue = []
    for i, row in enumerate(rows):
        row = row + [""] * (len(header) - len(row))
        url = row[cols["page_url"]].strip()
        vid = row[cols["youtube_video_id"]].strip()
        li_status = row[cols["linkedin_status"]].strip()
        existing_sched = row[cols["linkedin_scheduled_date"]].strip()
        if not url or not vid:
            continue
        if args.overwrite:
            # Only consider already-drafted rows
            if not li_status:
                continue
        else:
            # Original behavior: only un-drafted rows
            if li_status:
                continue
        queue.append((i, row, url, vid, existing_sched))
        if len(queue) >= args.count:
            break

    if not queue:
        if args.overwrite:
            print("[batch] no rows to overwrite (need youtube_video_id populated AND linkedin_status non-empty)")
        else:
            print("[batch] no eligible rows (need youtube_video_id populated AND linkedin_status empty)")
        return

    print(f"[batch] {len(queue)} draft(s) to {'overwrite' if args.overwrite else 'generate'}")

    # Schedule: new rows get next N Tue/Thu; overwrite preserves existing scheduled_date
    if args.overwrite:
        schedule = [None] * len(queue)  # signal: keep existing
    else:
        schedule = next_tue_thu(date.today(), len(queue))
    spine = BRAND_SPINE.read_text()
    client = anthropic.Anthropic()

    total_in, total_out = 0, 0
    for n, ((i, row, url, vid, existing_sched), sched) in enumerate(zip(queue, schedule), start=1):
        sched_label = existing_sched if sched is None else sched.isoformat()
        sched_suffix = "(preserved)" if sched is None else f"({sched.strftime('%a')})"
        print(f"\n[{n}/{len(queue)}] {url} → scheduled {sched_label} {sched_suffix}")
        md = find_article_by_url(url)
        if not md:
            print(f"  [skip] no article markdown found for {url}")
            continue

        draft, usage = draft_post(client, md, url, vid, spine)
        issues = check_violations(draft)
        total_in += usage.input_tokens
        total_out += usage.output_tokens

        # Print preview
        print(f"  ── draft ──────────────────────────────────────────────")
        for line in draft.splitlines():
            print(f"  {line}")
        print(f"  ───────────────────────────────────────────────────────")
        if issues:
            print(f"  ⚠ violations: {', '.join(issues)}")
        else:
            print(f"  ✓ no violations")

        if args.dry_run:
            print(f"  [dry] would write to row {i+2}")
            continue

        # Write to sheet
        sheet_row = i + 2  # 1-based + header
        update_cell(sheets, sheet_id, sheet_row, cols["linkedin_post_text"], draft)
        update_cell(sheets, sheet_id, sheet_row, cols["linkedin_status"], "pending_review")
        if sched is not None:
            update_cell(sheets, sheet_id, sheet_row, cols["linkedin_scheduled_date"], sched.isoformat())
        print(f"  ✓ written to sheet row {sheet_row}")

    print(f"\n[batch] done — tokens in/out: {total_in}/{total_out}")
    if not args.dry_run:
        print(f"\n  Next: review drafts in the sheet (column linkedin_post_text).")
        print(f"  When ready, flip linkedin_status from 'pending_review' to 'approved'.")
        print(f"  Make scenario will post on the scheduled date.")


if __name__ == "__main__":
    main()
