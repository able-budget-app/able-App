# NotebookLM → YouTube → Embed Pipeline

End-to-end spec for turning each Able article into a 5–8 min NotebookLM video, posting it on YouTube, and embedding it back into the source page. Manual workflow — Paul drives each step. The companion tracker (`docs/notebooklm-youtube-tracker.csv`) is the row-by-row checklist; this file is the playbook for what each column means and the templates to copy from.

---

## The pipeline at a glance

```
Article (.md) ─┐
               ├─→ NotebookLM notebook ─→ Generate video overview
Source spines ─┘                              │
                                              ▼
                                       Download .mp4
                                              │
                                              ▼
                                   Upload to YouTube (channel)
                                              │
                                              ▼
                          Article frontmatter: youtube_id: "abc123"
                                              │
                                              ▼
                              Article page renders embed + schema
```

Time cost per article: **30–45 min** end to end (notebook setup → generation review → YouTube upload + description → site embed).

---

## Pre-flight (one-time setup, before the pilot)

Before running the first pilot, confirm:

1. **NotebookLM Plus access.** Video Overviews are a Plus-tier feature (Google Workspace Business / individual paid). Free tier only does Audio Overviews.
2. **YouTube channel.** A channel with the Able brand identity (avatar = Able wordmark, banner = brand green with one of our hooks). Custom URL: `youtube.com/@becomeable` or similar. If not yet set up, that's a separate ~30 min task.
3. **Channel default settings.** Default playlist set, default category set ("Howto & Style" or "Education"), default tags, default end-screen template.
4. **Thumbnail template.** A reusable Figma/Photoshop template using brand green + Bricolage Grotesque. One template, swap text per video.
5. **`youtube_id` frontmatter** wired into article rendering (small build task — when ready, I'll add it).

---

## Tracker columns explained

These columns live in `docs/notebooklm-youtube-tracker.csv`. Import that CSV into Google Sheets to start.

### Page identity (5 cols)

| Column | What goes in it | Example |
|---|---|---|
| `page_url` | Live URL of the source page | `/budgeting/` |
| `page_title` | H1 / SEO title from the article | `How to Budget With Inconsistent Income: The Complete Guide` |
| `page_type` | `pillar` / `supporting` / `cluster-index` / `landing` | `pillar` |
| `cluster` | Which content cluster | `budgeting` |
| `priority` | `1` (next) / `2` (queue) / `3` (later) | `1` |

### Status (2 cols)

| Column | Allowed values | When to update |
|---|---|---|
| `status` | `draft` → `sources` → `notebook` → `generating` → `review` → `published` → `embedded` | Each phase boundary |
| `last_updated` | YYYY-MM-DD | Every status change |

### NotebookLM (5 cols)

| Column | What goes in it | Notes |
|---|---|---|
| `notebook_url` | URL of the Google notebook | Paste from NotebookLM after creating |
| `source_materials` | Bullet list of every source loaded into the notebook | Pipe-delimited in CSV; expand newlines after import |
| `prompt_used` | The customization prompt fed to NotebookLM at generate-time | See "Prompt templates" below |
| `video_duration_target` | e.g. `6 min` | Aspirational |
| `video_duration_actual` | After generation | Reality |

### YouTube (8 cols)

| Column | What goes in it | Limit |
|---|---|---|
| `youtube_video_id` | The 11-char ID | YouTube assigns at upload |
| `youtube_url` | Full URL | `https://youtu.be/<id>` |
| `yt_title` | Video title | 100 chars hard, 70 chars before truncation in feed |
| `yt_description` | Full description with chapters + links | First 157 chars are the SEO snippet |
| `yt_tags` | Comma-separated | 500 chars total, 30 tags max |
| `yt_thumbnail_path` | Repo path or upload URL | 1280×720, < 2MB |
| `yt_playlist` | Channel playlist | Pillar / Supporting / Cluster Indexes |
| `yt_chapters` | `00:00 Intro\n01:30 Section 1\n...` | Min 3 chapters, min 10s each, first must be `00:00` |

### On-site embed (3 cols)

| Column | What goes in it |
|---|---|
| `embed_position` | `top` / `above-bullets` / `mid-article` / `bottom` |
| `embed_status` | `pending` / `live` |
| `schema_status` | `pending` / `live` (VideoObject JSON-LD added) |

### Tracking (3 cols)

| Column | What goes in it |
|---|---|
| `view_count_30d` | Snapshot 30 days post-publish |
| `clickthrough_30d` | UTM clicks back to article |
| `notes` | Anything ad-hoc |

---

## NotebookLM prompt templates

NotebookLM's video customization prompt is the single biggest quality lever. Without one it produces generic, hype-y AI narration. With a tight one, it sounds on-brand.

### Universal preamble (paste into every prompt first)

```
This is for Able, an app for people whose income doesn't arrive on a steady schedule — freelancers, creators, gig workers, business owners.

VOICE RULES:
- Calm and specific. No hype. No exclamation points. No "level up" or "game-changer" language.
- No em dashes. Hyphens are fine.
- Never call it "the Able method." Always "Floor-First Budgeting."
- Use "reserve" — never "buffer" or "smoothing reserve."
- Never compare Able to YNAB, Mint, or any specific competitor by name.
- The villain is the monthly-paycheck assumption. Not any specific person or company.
- Customer is the hero. Able is the guide. Don't make Able the protagonist.
- Don't promise outcomes. Use language like "helps you" not "guarantees you'll save."

LOCKED VOCABULARY:
- The floor = bills + tax (the unmissable amount)
- Per-deposit allocation = each deposit gets split when it lands
- Reserve = the cushion that covers slow months
- "Become Able" = closing tagline only, never used as a CTA

LENGTH: 5 to 7 minutes. Two voices, conversational.
```

### Pillar article prompt addition

```
This is a pillar article — comprehensive and evergreen. Cover the methodology in depth. Explain the floor concept clearly. Walk through Floor-First Budgeting's 5 rules. Use specific numbers when the article cites them ($500 to $1,000 monthly leak, etc.). End on the identity shift: "From Unable to Able."
```

### Supporting article prompt addition

```
This is a supporting article focused on one topic. Stay narrow. Don't try to cover the entire methodology. Lean into the one specific question this article answers. End with a sentence that points back to the broader pillar without being salesy.
```

### Cluster index prompt addition

```
This is a cluster overview page. Treat it as a tour through the topic. Mention the supporting articles by topic so listeners know where to go deeper. Don't try to teach everything in one video — point and signal.
```

---

## Source materials (what to load into every notebook)

Sources are pre-bundled at `docs/notebooklm-sources/`. **One-time setup:** copy each bundle into a Google Doc, save the URLs. **Per video:** add 3 sources to the notebook (brand spine + cluster bundle + the specific article).

**The 5 bundles (each → one Google Doc):**

| Bundle file | What's in it | When to use it |
|---|---|---|
| `00-able-brand-spine.md` | brand-script + floor-first-method + app-capabilities | **Every notebook.** |
| `budgeting-bundle.md` | budgeting/index.md + 10 supporting | Any budgeting video |
| `taxes-bundle.md` | taxes/index.md + 7 supporting | Any taxes video |
| `business-bundle.md` | business/index.md + emergency-fund | Any business video |
| `learn-bundle.md` | 5 learn sub-pillar index pages | Any learn video |

**Per-notebook source list (3 sources):**
1. Brand spine Google Doc (always)
2. The relevant cluster bundle Google Doc
3. The specific article being videofied (paste markdown or link the live URL)

**Why bundles instead of loose files:** NotebookLM caps at 50 sources but quality drops well before that. 3 well-chosen sources beats 30 noisy ones. Bundling means the AI gets the whole brand context in one source instead of 11 small ones, and doesn't have to stitch context across files.

**Regenerating bundles** (when underlying articles change):
```bash
./docs/notebooklm-sources/build-bundles.sh
```
Then re-paste the changed bundle into its Google Doc. Active notebooks won't auto-update — re-link or re-upload after a regeneration.

**Optional but useful for specific videos:**
- A research / source PDF the article cites (e.g., the JPMorgan Chase Institute volatility study, Federal Reserve SHED 2024)

---

## YouTube description template

First 157 chars are the SEO snippet shown in search results. Front-load the value. Then a structured body.

```
{HOOK in <150 chars — the article's core promise, plain language>

How to budget when your income doesn't arrive on a steady schedule. From Able — the budgeting app built for inconsistent income.

🔗 Read the full article: https://becomeable.app{page_url}?utm_source=youtube&utm_medium=video&utm_campaign={cluster}

⏱ Chapters
00:00 {chapter 1 title}
01:30 {chapter 2 title}
...

📚 The methodology
Floor-First Budgeting is per-deposit allocation that pays your bills and taxes before any dollar gets to vote on dinner. Five rules:
1. Know your floor. Bills plus tax equal the amount you can't miss.
2. Every deposit fills the floor first.
3. Build your reserve before you spend.
4. One month ahead = Able.
5. Score reality, not the plan.

🎁 Try Able free for 30 days
https://becomeable.app?utm_source=youtube&utm_medium=video&utm_campaign={cluster}
$14.99/month or $129/year. Card required, no charge until day 31. Cancel anytime.

#FloorFirstBudgeting #VariableIncome #FreelanceMoney
```

Replace `{HOOK}`, `{chapter X title}`, `{page_url}`, `{cluster}` per video.

---

## YouTube tags (default set)

Same 5–6 tags appear on every video. Add 3–5 topic-specific tags per video.

**Default (every video):**
```
Able, Able app, becomeable, Floor-First Budgeting, variable income, inconsistent income, budgeting for freelancers, 1099 budgeting, budgeting app
```

**Topic-specific examples:**
- Tax videos: `quarterly taxes, self-employment tax, tax deduction, 1099 taxes`
- Budgeting how-tos: `how to budget, freelancer budget, budget app`
- Business/credit: `business credit, payday loan, credit score`

---

## Thumbnail spec

- Size: 1280×720 (YouTube's required minimum), 16:9
- Brand green (#2a7a4a) gradient as base
- Text overlay: 4–6 word hook in Bricolage Grotesque 800-weight
- Brand underline (the squiggle SVG) under one keyword
- Optional: phone shot from `marketing-footage/product-shots/` on right
- Wordmark "Able" small in bottom-left
- File saved at `marketing-footage/youtube-thumbnails/{slug}.png`

Reuse the brand-asset CSS if you want to render thumbnails programmatically — `brand/_brand.css` already has the right tokens. If easier, use Figma with the same palette.

---

## Schema.org embedding (for SEO win)

When the embed lands on the article page, also drop a `VideoObject` JSON-LD next to it. Google uses this for video-rich-results in search.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "{yt_title}",
  "description": "{first 200 chars of yt_description}",
  "thumbnailUrl": ["https://becomeable.app/marketing-footage/youtube-thumbnails/{slug}.png"],
  "uploadDate": "{ISO 8601, e.g. 2026-05-09T15:00:00-06:00}",
  "duration": "PT{minutes}M{seconds}S",
  "contentUrl": "https://www.youtube.com/watch?v={youtube_video_id}",
  "embedUrl": "https://www.youtube.com/embed/{youtube_video_id}"
}
</script>
```

I'll wire this up to render automatically when `youtube_id` is set in article frontmatter, once we're past the pilot.

---

## Pilot picks

For the test, my pick is `/budgeting/` (the budgeting pillar). It's the most strategic piece — if NotebookLM can do this article well, it can do the rest.

If you'd rather start smaller, alternatives:
- `/budgeting/freelancer-budget/` — narrow audience, easier to nail voice
- `/taxes/how-much-to-set-aside/` — concrete how-to, easy to chapter
- `/learn/pay-yourself-first/` — methodology-adjacent, brand-aligned by default

---

## After the pilot

Once we have one good video and one happy embed:

1. **Decide cadence.** 1 per week? 2 per week? Sustainable beats fast.
2. **Batch-generate by cluster.** All budgeting → all taxes → all learn. Keeps voice consistent across a cluster.
3. **Build the embed component.** Article page reads `youtube_id` from frontmatter, renders embed + schema in one block. Once-and-done; every future article auto-embeds.
4. **Add a "Watch the AI overview" button** at the top of articles that have a video, scrolling to the embed lower down. Best of both worlds — high engagement signal without pushing the article text below the fold.
5. **Track.** Add the 30-day view count and UTM clickthrough data back to the tracker monthly. Cull the videos that don't earn their keep.

---

## What this is NOT

- Not a one-time blast. The point is leveraged content over months and years.
- Not a replacement for blog SEO. The article is the SEO surface; the video is the engagement + YouTube SEO surface.
- Not auto-generated forever. Quality drops if you don't review every video before posting.
- Not for every page. The app, the landing, the comparison pages — they're not the right format. Articles only.
