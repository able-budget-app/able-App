# Make scenario — design (Phase 4)

## Goal

Daily cron-triggered scenario reads the next post row from Able's master sheet, resolves the file from Google Drive, posts to **Facebook, Instagram Business, TikTok, and LinkedIn**, then writes the post URLs and status back to the sheet.

## Trigger

Time-based: daily at 15:00 UTC (~9am MDT). Uses Make's built-in scheduling rather than a Watch trigger to avoid double-firing.

## Source data

- **Sheet:** `1. Master Sheet Generation`, Sheet ID `1DnQXWKcbGLMHvzxjk9yjQKDhzOGTm9Wph27ly7tHNlA`
- **Drive folder:** `Social Posts`, ID `10NMdGGJDFh78ybYJcUDpK2k2mtBTROE7`. Subfolders `singles/`, `carousels/`, `reels/`.
- **Lookup keys:** `post_date == today (UTC)` AND `status != 'Posted'`.
- **Caption fields used:** `caption_ig`, `caption_tt`, `caption_li`. LinkedIn caption already includes the URL via build-master-sheet.js append.

## Step-by-step flow

| # | Module | Purpose |
|---|---|---|
| 1 | **google-sheets — searchRows / makeAPICall** | Filter master sheet for today's row(s). Stop if no match. |
| 2 | **router** | Filter: `status != 'Posted'`. If skip, route to a no-op "skip" branch with a note. |
| 3 | **google-drive — searchFiles** | Find file in Drive by `filename` field within `drive_folder` subfolder. Returns `fileId`. |
| 4a | **instagram-business — CreatePostPhoto** OR **CreateAReelPost** OR **CreateCarouselPhoto** | Branch on `format` column. `single` → photo. `reel` → reel (video). `carousel` → carousel (multi-image). |
| 4b | **facebook-pages — CreatePostWithPhotos** OR similar video module | Post `caption_fb` (use IG caption as fallback for v1) + media to Able's Facebook Page. |
| 4c | **tiktok — addTiktokPost** (via `make-nodes-late`) OR equivalent | Post `caption_tt` + media. **TikTok requires the post to come from a Business account; verify connection scope.** |
| 4d | **linkedin — CreateCompanyImagePost** OR **createOrganizationVideoPost** | Post to Able's LinkedIn company page (not personal). |
| 5 | **google-sheets — updateRow** | Write back: `status = 'Posted'`, `ig_url`, `tt_url`, `li_url`. Optional: `posted_at` timestamp. |
| 6 | **error-handler (router)** | On any post failure: write `status = 'Failed: {platform}'` and short error message. Don't retry automatically — rely on the next day's run for retries. |

## Branches by `format`

The Drive folder and Instagram module both depend on `format`:

- `format == 'single'` — Drive folder `singles/`, IG module `CreatePostPhoto`, asset is `.png`
- `format == 'carousel'` — Drive folder `carousels/{id}/`, IG module `CreateCarouselPhoto` (takes 2-10 image fileIds), asset is per-slide `.png`s
- `format == 'reel'` — Drive folder `reels/`, IG module `CreateAReelPost`, asset is `.mp4`
- `format == 'brandscript'` — same shape as `single` (1080×1080 PNG); use `CreatePostPhoto`

For TikTok and LinkedIn, only `reel` (video) and `single`/`carousel`/`brandscript` (image) matter — both platforms accept either. For TikTok specifically, only video posts are widely supported via the API; image posts are limited. **Decision:** route only `reel` rows to TikTok in v1; skip non-video formats with a note in `tt_url` ("skipped: image-only"). Image posts can be added later with a manual workflow if engagement on TikTok proves valuable.

## Connections required (set up in Make UI)

The scenario design assumes these OAuth connections exist on the user's Make team. **Cannot create scenario until all are connected.**

1. **Google Sheets** — read/write. Scope `https://www.googleapis.com/auth/spreadsheets`. Connect via OAuth from the Sheets module in Make. ✅ Existing connection on team 1933069.
2. **Google Drive** — file search + download. Scope `https://www.googleapis.com/auth/drive.readonly`. Same OAuth user as Sheets is fine. ✅ Existing connection on team 1933069.
3. **Facebook Pages** — post to Able's Facebook Page. Required: Facebook Page admin access on the connected FB account. ⚠️ Existing FB connection on team 1933069 is tied to Paul's personal account which is linked to Idaho Custom Trailers / Scentsible K9 pages — needs to be reconnected (or the Able FB Page added to the same Meta Business account so it shows up as a selectable Page in the module).
4. **Instagram Business** — must be connected via Facebook (Meta) Business account, with Instagram Business or Creator account linked to a Facebook Page. Personal IG accounts cannot post via API. Required: IG Business account ID, FB Page access token. ⚠️ Same issue as Facebook — existing IG connection is tied to other businesses, not Able. Needs Able's IG Business account linked to a Page that's accessible from Paul's Meta Business.
5. **TikTok** — TikTok for Business account required. Personal accounts cannot post via API. Connection requires TikTok app approval flow. ❌ NOT connected on team 1933069.
6. **LinkedIn** — LinkedIn company page required (not personal profile). Posting to a personal profile is possible but the brand pattern is Able's company page. Required: company page admin access on the connected LinkedIn account. ❌ NOT connected on team 1933069.

## Data assumptions

- The master sheet row for "today" exists (build-master-sheet.js writes 175 rows; cadence covers 159 days from W1 day 1).
- The `post_date` column is in `YYYY-MM-DD` format and the sheet uses Pacific Time. Make scenario should compare against `formatDate(now; "YYYY-MM-DD"; "America/Denver")` to match.
- File naming convention from `scripts/export-social.py`: `singles/{id}-{slug}.png`, `carousels/{id}-{slug}/slide-{n}.png`, `reels/{id}-{slug}.mp4`.
- Drive search by name within parent folder is reliable enough that we don't need to hardcode fileIds.

## Error handling philosophy

- **One pass per day.** If a post fails, write `status = 'Failed: {platform}'` and let the user investigate manually. Don't auto-retry across runs.
- **No silent failures.** Every error path writes back to the sheet so the user has a single source of truth.
- **Don't post partial.** If IG succeeds but TT fails, the row should still record the IG URL but flag `Failed: TikTok`. The next day's run won't re-post the IG content.

## Things deliberately out of scope for v1

- Engagement listening (auto-reply, auto-DM)
- Cross-posting to Threads, X
- A/B testing different captions
- Post insights / analytics rollback into the sheet
- Comment monitoring
- Story posts

(Facebook is now in scope for v1 per user request. Threads will pick up most IG posts automatically if cross-posting is enabled in IG settings — that's free and doesn't need its own scenario branch.)

## Open questions for the user (require human decision)

1. **Posting time.** 9am MDT = 15:00 UTC. Right slot? Or 8am local / 10am local?
2. **TikTok image format.** Skip non-reel rows, or post images via TikTok's image post API (newer, less battle-tested)?
3. **LinkedIn — personal or company page?** Brand pattern is company page, but if Able doesn't have one yet, personal profile is a fallback. The decision changes which LinkedIn module is used.
4. **Failure notifications.** Should a failed post send a Slack/email alert in addition to writing to the sheet? V1 says no, but if the user wants alerts, add a Notification module step.
5. **Carousels on LinkedIn.** LinkedIn handles document carousels (PDF) differently than image carousels. For carousel rows, post just the cover slide to LinkedIn? Or build a PDF of all slides? V1 recommends cover-slide only.
