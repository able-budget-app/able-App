# Content Engine Roadmap

Self-feeding loop: video render → YouTube → article embed → LinkedIn post → new article → repeat. Captured as a roadmap so the pieces can be built incrementally without losing the vision.

## The full loop

```
                       ┌──────────────────────────────────────┐
                       │   Topic queue (Google Sheet)         │
                       │   - title, target keyword, cluster   │
                       │   - status: queued → in-flight → live│
                       └─────────────────┬────────────────────┘
                                         │ next-up
                                         ▼
                  ┌──────────────────────────────────────┐
                  │ A. Article drafter (Claude)          │
                  │ - SEO-optimized markdown article     │
                  │ - Lands in able-content/             │
                  └─────────────────┬────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │ B. Site rebuild                      │
                  │ - python3 scripts/build-resources.py │
                  │ - New /cluster/slug/ page is live    │
                  └─────────────────┬────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │ C. Video pipeline (existing)         │
                  │ - npm run draft → script.json        │
                  │ - npm run all → mp4 + thumbnail      │
                  │ - manual upload to Drive folder      │
                  └─────────────────┬────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │ D. YouTube auto-upload (Make)        │
                  │ - existing spec, adds: write yt_id   │
                  │   back to article frontmatter        │
                  └─────────────────┬────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │ E. Article embed + redeploy          │
                  │ - youtube_id in frontmatter          │
                  │ - re-run build-resources.py          │
                  │ - VideoObject schema live            │
                  └─────────────────┬────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │ F. LinkedIn engine (Make)            │
                  │ - takes yt_id + article URL          │
                  │ - composes brand-voice post copy     │
                  │ - posts as text + first-comment link │
                  │   (LinkedIn algo penalizes link in   │
                  │    main post body)                   │
                  └─────────────────┬────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │ G. Cross-post (Twitter / Threads /   │
                  │    Facebook) — optional phase 4      │
                  └─────────────────┬────────────────────┘
                                    │
                                    └──────► loop back to topic queue
                                            (cron picks next topic)
```

## Build phases

### Phase 1 — Manual (where we are now)
Render existing 76 articles' videos, manual YouTube upload, manual frontmatter paste, manual rebuild. Validates the pipeline; identifies what's worth automating.

### Phase 2 — Make scenario for YouTube upload (next)
Spec already exists at `docs/article-video-make-scenario.md`. Build it in Make UI. Write `youtube_id` back to a Google Sheet column.

### Phase 3 — Article frontmatter auto-update + redeploy
After YouTube upload writes `youtube_id`:
- A Make scenario edits the matching article's frontmatter (via GitHub API: read file → patch frontmatter → commit)
- Triggers Netlify rebuild (auto on push)
- Embed goes live without Paul touching anything

### Phase 4 — LinkedIn engine
Trigger: tracker row `status = live` (set by phase 2 scenario)
Output: a LinkedIn post with brand-voice hook + link

Module chain in Make:
1. Sheet watcher (status flipped to `live`)
2. Claude module: write LinkedIn post copy from article + video metadata
   - Hook in first 2 lines (cuts off in feed otherwise)
   - 200-300 word body — single insight from the article
   - No link in the body (algorithm penalty)
3. LinkedIn — Create Post (text only)
4. LinkedIn — Comment on Own Post (with the YouTube link + article link)
5. Sheet update: `linkedin_url`, `linkedin_posted_date`

LinkedIn integration in Make is built-in. Need: page connection (company page is better than personal for SEO).

### Phase 5 — Article drafter (Claude)
Input: a topic from the queue (title, target keyword, cluster, length target)
Output: full markdown article with frontmatter, lands in `able-content/<cluster>/<slug>.md`

Reuses the same brand-spine approach the video drafter does. Quality bar:
- Voice rules locked (no em dashes, no buffer, no YNAB)
- Methodology spine (Floor-First) baked in where relevant
- Word count appropriate to type (pillar 2500+, supporting 800-1500)
- Internal links to related articles
- Meta_title + meta_description SEO-optimized

Run locally first (manual review) before automating. After 3-5 confirmed-good drafts, automate via cron.

### Phase 6 — Recurring drip
Cron schedule (Make scenario or actual cron):
- 1× per week: pick next topic from queue, run Phase 5 → 1 → 2 → 3 → 4
- Topic queue can be:
  - **Manual list** in a Google Sheet (you maintain)
  - **Search-trend driven** (Google Trends API in Make picks rising queries that match Able's cluster vocabulary)
  - **Comment-mined** (extract questions from YouTube comments / blog comments and queue them as supporting articles)

The render bottleneck: **Remotion needs a machine.** For 1×/week, Paul's Mac is fine. Higher cadence: move to Remotion Lambda (paid AWS service) or a small DigitalOcean droplet running the render on cron.

## Open design questions to revisit

- **LinkedIn voice:** the brand voice is calm/specific. LinkedIn rewards a slightly different cadence (story → tension → insight → ask). Worth A/B testing two prompt variants when phase 4 ships.
- **Topic queue source:** start manual, decide whether to automate after seeing what topics actually convert.
- **Render automation:** Remotion Lambda is ~$0.10 per video (vs. free on Paul's Mac). Worth it once cadence > 2/week.
- **Comment management:** YouTube comments need someone to respond. Either Paul, a VA, or a Make scenario that drafts replies for review.
- **Cross-platform:** Twitter / Threads / Facebook would each be a clone of phase 4's pattern. Cheap to add once one platform's working.

## Why this matters

Each loop builds:
- **Article SEO** — google indexes the page
- **YouTube SEO** — YouTube indexes the video; transcript is a separate corpus
- **LinkedIn distribution** — page authority + backlink to article
- **Schema.org VideoObject** — the article is eligible for video-rich-results
- **Internal link mesh** — each article links to related ones; new articles add new edges

Compounding effect after 100 articles + 100 videos + 100 LinkedIn posts is genuinely large. Each cycle costs ~$0.20 in API credits + 30 min of human time (review, post-render upload). Sustainable.

## What to build first (when you come back)

In order:
1. Phase 2 — YouTube auto-upload Make scenario (~1 hr to build, spec ready)
2. Phase 3 — frontmatter auto-update via GitHub API (~30 min)
3. Phase 4 — LinkedIn engine (~2 hr, including LinkedIn auth dance)

Phases 5-6 are the bigger lifts. Worth doing 5 manually a few times before automating to lock in the prompt.
