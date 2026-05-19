# Make scenario — Able YouTube Shorts daily upload

**Build target:** Make team `1933069`. One scenario, daily 1-upload cadence, draws from Sheet 2 (`02-yt-short`) on spreadsheet `1DnQXWKcbGLMHvzxjk9yjQKDhzOGTm9Wph27ly7tHNlA`, downloads MP4 from Drive folder `1DF6070WBo8mmog6G7QTPqtlZdEZFLFTk`, uploads to YouTube as **Short**.

## Connections (already in place)

| Purpose | Make connection ID |
|---|---|
| Google Sheets + Drive (pauljohnson912 — owns sheet + folder) | `7727156` |
| YouTube Data API v3 (pauljohnson912 — Able channel) | `8949644` |

## Spreadsheet

- ID: `1DnQXWKcbGLMHvzxjk9yjQKDhzOGTm9Wph27ly7tHNlA`
- Tab name: `02-yt-short`
- gid: `110272954`
- 265 rows, all `status=pending`, sorted by `post_order` 1..265

## Drive

- MP4 folder: `1DF6070WBo8mmog6G7QTPqtlZdEZFLFTk`
- Filename pattern: `{file_slug}.mp4` (e.g. `C53_why-able-exists.mp4`)
- 248 publishable MP4s present, 17 placeholder rows in sheet have no MP4 yet (will skip automatically until rendered)

---

## Scenario build — module by module

Open https://us2.make.com/1933069/scenarios → "Create a new scenario".

### Module 1 — Google Sheets: Search Rows

| Field | Value |
|---|---|
| Connection | `7727156` |
| Spreadsheet (search) | `1DnQXWKcbGLMHvzxjk9yjQKDhzOGTm9Wph27ly7tHNlA` |
| Sheet name | `02-yt-short` |
| Table contains headers | Yes |
| Column range | A:M |
| Filter — condition 1 | `status` `equal to` `pending` |
| Sort order | `post_order` ascending |
| Maximum number of returned rows | `1` |

This pulls the lowest-`post_order` row where `status=pending`.

### Module 2 — Google Drive: Search for Files/Folders

| Field | Value |
|---|---|
| Connection | `7727156` |
| Search query type | `Filter` |
| Search in shared drive | No |
| Specific folder | `1DF6070WBo8mmog6G7QTPqtlZdEZFLFTk` (browse to it; should be inside the "social-export" or similar parent) |
| Query — `name` `contains` | `{{1.`file_slug`}}` |
| Query (additional) — `mimeType` `=` | `video/mp4` |
| Returned values | `Files only` |

Module 1 returns `file_slug` (e.g. `C53_why-able-exists`). This searches for `C53_why-able-exists.mp4` in the folder.

### Module 3 — Google Drive: Download a File

| Field | Value |
|---|---|
| Connection | `7727156` |
| File ID | `{{2.id}}` |
| Convert files | No |

Downloads the MP4 binary into Make's data buffer for the next step.

### Module 4 — YouTube: Upload a Video

| Field | Value |
|---|---|
| Connection | `8949644` |
| Title | `{{1.`yt_title`}}` |
| Description | `{{1.`yt_description`}}` |
| Category | `People & Blogs` (id 22) — or `Education` (id 27) if you prefer |
| Privacy status | **`unlisted`** ← keep unlisted for first 1-2 runs |
| Tags | `{{split(1.`yt_tags`; ",")}}` |
| Made for kids | `No` |
| Source File | `Map` toggle ON, then pick: `{{3.data}}` (binary from module 3) |
| File name | `{{2.title}}` |

⚠️ **The "Short" classification is automatic** — YouTube detects Shorts based on aspect ratio (vertical 9:16) + length (≤60s). All your MP4s already meet both, so no extra flag needed. YouTube will add the `#Shorts` tag automatically; your `yt_description` already includes it for redundancy.

### Module 5 — Google Sheets: Update a Row

| Field | Value |
|---|---|
| Connection | `7727156` |
| Spreadsheet | `1DnQXWKcbGLMHvzxjk9yjQKDhzOGTm9Wph27ly7tHNlA` |
| Sheet name | `02-yt-short` |
| Row number | `{{1.`__ROW_NUMBER__`}}` (the original row pointer from module 1) |
| Values — `status` | `posted` |
| Values — `youtube_video_id` | `{{4.id}}` |
| Values — `youtube_url` | `https://youtube.com/shorts/{{4.id}}` |
| Values — `yt_published_date` | `{{formatDate(now; "YYYY-MM-DD")}}` |

---

## Scheduling

| Field | Value |
|---|---|
| Run scenario | `At regular intervals` |
| Interval | `60` minutes |
| Advanced — Scheduling | Once daily at chosen time |

**Recommended cadence:** daily at **19:00 America/New_York** (7pm ET / 5pm Mountain). Peak YouTube Shorts watch window without colliding with the IG/FB/LI scenario `4869011` which fires 12:00 NY.

Set in the scheduling UI as:
- Days: `Mon, Tue, Wed, Thu, Fri, Sat, Sun`
- Time: `19:00`
- Timezone: `America/New_York`

## Error handling

For each module, right-click → "Add error handler" → `Break` with these settings:
- Number of attempts: `3`
- Interval between attempts: `60` seconds
- Store incomplete executions: ON

YouTube quota errors (403) — the daily 10,000-unit quota allows ~6 uploads/day. At 1/day cadence we'll never hit it. If we ever go over, the error handler will retry once and then leave the row at `status=pending` for the next day's run.

---

## First-run test plan (BEFORE activating schedule)

1. **Leave scenario PAUSED** after building.
2. Click "Run once" in the Make UI.
3. Confirm: scenario picks up row 1 (`C126_brandscript-general`), finds MP4 in Drive, uploads to YouTube as **unlisted**.
4. Open YouTube Studio → confirm the upload appears as Short (vertical thumbnail, "Shorts" badge).
5. Check Sheet 2 row 1 — `status=posted`, `youtube_video_id` populated, `youtube_url` filled.
6. **Watch the unlisted Short** end-to-end on the channel — verify metadata (title, description, tags) renders correctly, no truncation issues.
7. Repeat with "Run once" 1-2 more times — should grab row 2, then row 3.

If runs 1-2 look clean:
- Switch module 4's `Privacy status` to `public`.
- Manually flip the first 1-2 uploaded Shorts to `public` in YouTube Studio.
- Activate the scenario schedule.

If anything fails:
- **Drive search returns no file:** filename mismatch. Verify `file_slug` in sheet vs actual MP4 name in Drive.
- **YouTube upload 401:** OAuth scope issue. Reconnect `8949644` with `youtube.upload` scope explicitly checked.
- **YouTube upload 403 (quota):** check Google Cloud Console for quota status.
- **Sheets update writes to wrong row:** ensure module 5 uses `__ROW_NUMBER__`, not `post_order` — Sheets module's row reference is the spreadsheet row, not the data column.

---

## Activation checklist

- [ ] Module 4 privacy = `public` (after sanity check)
- [ ] First 1-2 unlisted uploads flipped to `public` in YouTube Studio
- [ ] Scheduling set to `19:00 America/New_York` daily
- [ ] Scenario toggle: **ACTIVE**
- [ ] Update `~/.claude/projects/-Users-pauljohnson-Desktop-Able/memory/make_scenario_state.md` with the new scenario ID + connection map

## Post-activation

- 265 rows / 1 per day = **~8.5 months of runway**
- 17 placeholder rows (`status=pending` but no MP4 yet) will silently skip — module 2 returns 0 files, scenario errors out for that day. Either render MP4s for those slugs (they're carousels in `data.js` that haven't been rendered yet) or flip them to `status=skip` so the scenario filter excludes them.
- Comments / replies aren't automated — manage from YouTube Studio.
