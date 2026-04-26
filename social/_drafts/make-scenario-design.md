# Make scenario — design (Phase 4) — LOCKED 2026-04-26

## Goal

Daily cron-triggered scenario reads the next post row from Able's master sheet, resolves the file from Google Drive, posts to **Facebook + Instagram + LinkedIn** (TikTok manual for v1), then writes URLs and status back to the sheet. On any failure, sends a Gmail alert.

## Decisions locked

| # | Question | Decision |
|---|---|---|
| 1 | Posting time | **10am Mountain Mon-Sat, 2pm Mountain Sun.** Implemented as 12:00 / 16:00 in Make's `restrict` (Paul's Make account is in America/New_York TZ; Mountain = NY-2hrs). |
| 2 | TikTok image format | **Skip TikTok in v1.** Write `tt_url = 'manual: pending'`. Post to TikTok manually. v2 add-on: wire up `make-nodes-late` or Blotato. |
| 3 | LinkedIn page type | **Company page** (just created by user). Connection `8569387` (linkedin2). |
| 4 | Failure notifications | **Gmail email** to user on any branch error. Subject "Able social post FAILED · {date} · {platform}". v2 add-on: AI agent that auto-fixes — out of scope for v1. |
| 5 | Carousels on LinkedIn | **Cover slide only** for v1. PDF/document posting needs custom HTTP or extra Make app. v2 upgrade. |

## Source data

- **Sheet:** `1. Master Sheet Generation`, Sheet ID `1DnQXWKcbGLMHvzxjk9yjQKDhzOGTm9Wph27ly7tHNlA`
- **Drive folder:** `Social Posts`, ID `10NMdGGJDFh78ybYJcUDpK2k2mtBTROE7`
- **Subfolders:** `singles/`, `carousels/`, `reels/`
- **Lookup keys:** `post_date == today (Mountain)` AND `status != 'Posted'`

## Trigger schedule

Make's `scheduling.restrict` format with two windows. Day numbering: Sun=0, Mon=1, ..., Sat=6.

```json
{
  "type": "indefinitely",
  "interval": 60,
  "restrict": [
    { "days": [1,2,3,4,5,6], "time": ["12:00", "12:01"], "months": [1,2,3,4,5,6,7,8,9,10,11,12] },
    { "days": [0],           "time": ["16:00", "16:01"], "months": [1,2,3,4,5,6,7,8,9,10,11,12] }
  ]
}
```

- Mon-Sat 12:00 NY = 10am Mountain
- Sun 16:00 NY = 2pm Mountain

**If you change your Make team TZ to America/Denver**, update the times to "10:00" and "14:00". The day-of-week stays the same.

**DST note:** Mountain and Eastern both observe DST, so the 2-hour offset stays constant year-round. No DST adjustment needed.

## Step-by-step flow

| # | Module | Purpose |
|---|---|---|
| 1 | `google-sheets:searchRows` | Filter master sheet for today's row. Stop if no match or if status='Posted'. |
| 2 | `google-drive:searchFiles` | Find media file in Drive by `filename` field. Returns `fileId` + `webContentLink`. |
| 3 | `builtin:BasicRouter` | Fan out to 4 parallel branches: IG, FB, LinkedIn, sheet-update. (TikTok branch is a no-op write for v1.) |
| 4a | `instagram-business:CreatePostPhoto` / `CreateAReelPost` / `CreateCarouselPhoto` | Branch on `format`. single/brandscript → photo. reel → reel. carousel → carousel. |
| 4b | `facebook-pages:CreatePostWithPhotos` | Post `caption_ig` (IG caption reused as FB caption for v1) + media to Able's FB Page. |
| 4c | `linkedin:CreateCompanyImagePost` / `createOrganizationVideoPost` | reel → video post. anything else → image post (cover slide for carousels). |
| 4d | TikTok no-op | Inline write: `tt_url = 'manual: pending'`. No actual API call. |
| 5 | `google-sheets:updateRow` | Write back: `status = 'Posted'`, `ig_url`, `fb_url`, `tt_url`, `li_url`, `posted_at`. |
| 6 | Error handler | On any module failure: write `status = 'Failed: {platform}'` to row + send Gmail alert. |

## Connection IDs (real, from team 1933069)

| Connection | ID | Module pkg |
|---|---|---|
| Google (Sheets + Drive) | `7727156` | google-sheets, google-drive |
| Facebook (FB + IG via Meta) | `7816528` | facebook-pages, instagram-business |
| LinkedIn | `8569387` | linkedin |
| Gmail (alerts) | `7861787` | google-email |

## Account-level IDs Paul still needs to fill in (in Make UI after scenario creation)

These are not connection IDs — they're the specific Page/Account/Organization within each connected service. Paul picks them from a dropdown in the Make scenario editor when he opens each module:

- **IG Business Account ID** — Paul selects Able's IG Business account from dropdown. (Requires Able's IG to be linked to a FB Page accessible from `7816528`.)
- **Facebook Page ID** — Paul selects Able's FB Page from dropdown. (Same Meta Business account requirement.)
- **LinkedIn Organization URN** — Paul selects Able's company page from dropdown. Format: `urn:li:organization:N`.

If Able's FB Page / IG account aren't yet attached to Paul's Meta Business, they need to be added first. Same for LinkedIn — the `8569387` connection should already grant access to the Able company page since you created it before connecting.

## File naming convention (from `scripts/export-social.py`)

- `singles/{id}-{slug}.png`
- `carousels/{id}-{slug}/slide-{n}.png` (cover = slide-1)
- `reels/{id}-{slug}.mp4`

## Branches by `format`

- `single` / `brandscript` — IG `CreatePostPhoto`, FB `CreatePostWithPhotos`, LinkedIn `CreateCompanyImagePost`, asset `.png`
- `carousel` — IG `CreateCarouselPhoto` (multi-image), FB `CreatePostWithPhotos` (multi-image), LinkedIn `CreateCompanyImagePost` with cover only, asset per-slide `.png`
- `reel` — IG `CreateAReelPost`, FB `CreatePostWithPhotos` with video, LinkedIn `createOrganizationVideoPost`, asset `.mp4`

## TikTok v2 add-on plan

When ready to add TikTok automation:
- **Option A (free, untested):** Add `make-nodes-late` app to team, connect TikTok account, add a 4th branch in router using `addTiktokPost`. Caveat: low popularity (~0.001), limited support.
- **Option B (paid, battle-tested):** Sign up for Blotato (or Publer, Buffer, Later), connect to TikTok, use `blotato:Post`. Adds $10-30/mo per scheduling tool but supports cross-posting cleanly.
- **Option C (custom):** Direct HTTP calls to TikTok's Content Posting API. Requires TikTok Developer app approval (weeks).

Recommendation: revisit after 30 days of running the v1 scenario. If TikTok proves to be a meaningful traffic source, adopt Blotato. If not, manual posting is fine.

## LinkedIn document-carousel v2 upgrade

When ready to upgrade carousels from cover-slide to full PDF:
1. Add a PDF.co `HTMLtoPDF` step that builds a multi-page PDF from the carousel slides
2. Replace `linkedin:CreateCompanyImagePost` with `linkedin:Make an API Call` to LinkedIn's UGC Posts endpoint with a document attachment
3. Test on a single carousel first

This is ~30-45 min of work. Defer until v1 has proven steady.

## Error handling philosophy

- One pass per day. No auto-retry across runs.
- Every error writes back to the sheet `status` column.
- Every error also sends a Gmail alert to Paul.
- Don't post partial silently — if IG succeeds but LinkedIn fails, the row records the IG URL and flags `Failed: LinkedIn` in status.

## Things deliberately out of scope for v1

- TikTok content posting (manual for now)
- Threads (will pick up IG cross-posts automatically if enabled in IG settings)
- X / Twitter
- Engagement listening (auto-reply, auto-DM)
- LinkedIn document-PDF carousels (cover slide only)
- A/B testing different captions
- Post insights / analytics rollback into the sheet
- Comment monitoring
- Story posts
- AI agent that auto-fixes failures (low priority per user)
