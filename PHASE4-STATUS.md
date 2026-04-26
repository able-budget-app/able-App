# Phase 4 status — Make scenario CREATED ✅

**Scenario URL:** https://us2.make.com/1933069/scenarios/4869011/edit
**Status:** PAUSED

## What's done

- ✅ Scenario created and updated with new column layout
- ✅ Master sheet schema extended: 22 → 28 columns
  - Added `caption_fb` (column Q) — auto-derived from caption_ig with URL inlined
  - Added `ig_url`, `fb_url`, `tt_url`, `li_url`, `posted_at` (columns X-AB) for Make to write back
- ✅ CSV regenerated. **Re-import to the master sheet.**
- ✅ Scenario filter now uses column W (status) and AB1 range
- ✅ FB module now references caption_fb instead of caption_ig
- ✅ Sheet update step now writes per-platform URLs to columns X-AB

## ⚠️ What you must do, in order

### Step 1 — Re-import the master sheet

The schema changed. The scenario won't work against the old 22-column layout.

1. Open https://docs.google.com/spreadsheets/d/1DnQXWKcbGLMHvzxjk9yjQKDhzOGTm9Wph27ly7tHNlA/edit
2. File → Import → Upload → select `marketing-footage/social-export/_master-sheet.csv` (run `node scripts/build-master-sheet.js` first if needed)
3. Choose "Replace data starting at A1"
4. Verify columns: should now end at AB (28 columns)

### Step 2 — Fix the IG/FB connection so Able's Page is visible

The existing "Paul IG/FB Connection" was OAuth'd before Able's FB Page existed. Facebook's OAuth grants access to **specific Pages at the moment of connection** — new Pages created later are not auto-included.

**The most reliable fix:** reauthorize the connection.

1. In Make → **Connections** (left nav)
2. Click **"Paul IG/FB Connection"**
3. Click **Reverify** or **Reauthorize** (button in the connection details)
4. The Facebook OAuth popup appears. **When asked which Pages to grant access to**, make sure Able's Page is checked (in addition to existing Pages: Idaho Custom Trailers, Scentsible K9, etc.)
5. Click "Continue" / "Save"
6. Back in Make, click "Save" on the connection

**For Instagram specifically**, Able's IG account also needs to:
- Be a **Business or Creator** account (not Personal). Open Instagram app → Settings → Account → Switch to Professional Account.
- Be **linked to Able's Facebook Page**. Open Meta Business Suite (business.facebook.com) → Accounts → Instagram → Add → connect Able's IG to Able's FB Page.

If you don't see Able's Page in the OAuth list during reauthorize, the issue is upstream: Able's Page isn't yet on a Meta Business Account that grants access to Make. Fix in Meta Business Settings → Pages → Add → connect Able's Page → grant Make access via Business Integrations.

**Verification:** After reauthorize, open the scenario, click on any IG or FB module, and check the `Page` dropdown. Able's Page should appear.

### Step 3 — Add the Drive lookup step

The scenario currently has empty `image_url` / `video_url` fields. Add a Drive search module between the sheet read and the router so each post pulls the actual media.

1. Open the scenario
2. Hover between **module 1 (Search Rows)** and **module 2 (Router)** — you'll see a `+` icon between them
3. Click `+`
4. Search "Google Drive" → choose **"Search Files"** (the exact module name in the UI; it might appear as "Search for a File")
5. Configure:
   - **Connection:** "My Google connection (pauljohnson912@gmail.com)" (id 7727156)
   - **Search method:** "By query"
   - **Query:** `name = '{{1.\`K\`}}' and trashed = false`
   - **Limit:** 1
6. Click `OK`
7. Now wire the URL field in each platform module to reference the new Drive module's output:
   - **Module 3 (IG photo):** `image_url` → `{{<drive_id>.webContentLink}}`
   - **Module 4 (IG reel):** `video_url` → `{{<drive_id>.webContentLink}}`
   - **Module 5 (FB photo):** `photos[0].url` → `{{<drive_id>.webContentLink}}`
   - **Module 6 (LinkedIn image):** `image_url` → `{{<drive_id>.webContentLink}}`
   - **Module 7 (LinkedIn video):** `video_url` → `{{<drive_id>.webContentLink}}`
   
   Replace `<drive_id>` with the auto-assigned numeric ID Make gives the Drive module (probably 9 if added at the end, or 2 if inserted between 1 and the router).

### Step 4 — Pick the right account/page in each platform module

For each of modules 3, 4, 5, 6, 7:
- Click the module → in the sidebar, the `Page` / `Account` / `Company` dropdown is empty
- Click the dropdown → select Able's IG / FB Page / LinkedIn company page
- (If it says "Connect another account" instead of showing options, the connection step in #2 above wasn't successful — go back and reauthorize)

### Step 5 — Set up failure notifications (Gmail email)

The scaffold doesn't have error handlers wired up. Add them:

1. Right-click on each platform module (3, 4, 5, 6, 7) → **Add error handler**
2. Choose **"Resume"** (so other branches still run if one fails)
3. Connect the error handler to a new module: search **Email → Send an Email**
4. Configure:
   - **Connection:** "My Gmail connection" (id 7861787)
   - **To:** pauljohnson912@gmail.com
   - **Subject:** `Able social FAILED · {{formatDate(now; "YYYY-MM-DD")}} · {{<module name>}}`
   - **Body:** `Post id: {{1.\`E\`}}, format: {{1.\`D\`}}, slug: {{1.\`F\`}}. Error: {{<error variable>}}`

Repeat for each platform module.

### Step 6 — Set today's row's post_date and test

The scenario filters by `post_date == today`. Until post_dates are populated, the filter never matches.

1. Pick a post you want to test with (today's date, format=single is easiest)
2. In the master sheet, set that row's `post_date` to today's date in YYYY-MM-DD format (e.g., `2026-04-26`)
3. Make sure that row's `status` column is empty
4. In the Make scenario, click **"Run once"** (top toolbar)
5. Watch the run inspector — confirm:
   - Module 1 finds the row
   - Drive module finds the file
   - IG, FB, LinkedIn each post successfully (or you see specific errors)
   - Module 8 updates the sheet status to "Posted" with URLs in X-AB
6. Verify the posts appear on IG, FB, LinkedIn

### Step 7 — Activate the schedule

Once a single test post works end-to-end:
1. Populate `post_date` for at least the next 1-2 weeks of cadence
2. In Make scenario settings, toggle **Active: ON**
3. The scenario will fire at the next scheduled time (Mon-Sat 12:00 NY = 10am Mountain, Sun 16:00 NY = 2pm Mountain)

---

## What's still pending after Step 7

- **TikTok automation** — currently `tt_url = "manual"` placeholder. v2 add-on with `make-nodes-late` or Blotato.
- **LinkedIn document/PDF carousels** — currently cover slide only. v2 upgrade.
- **AI agent that auto-fixes failed posts** — low priority per your call.

---

## Schema changes — for reference

Master sheet column layout (28 columns):

| Col | Header | Notes |
|---|---|---|
| A | week | |
| B | day | |
| C | post_date | YYYY-MM-DD; you populate this |
| D | format | single / brandscript / carousel / reel |
| E | id | |
| F | slug | |
| G | theme | |
| H | week_theme | |
| I | notes | |
| J | punch | |
| K | filename | What's in Drive — single source of truth for Drive search |
| L | drive_folder | Folder hint |
| M | relevant_links | URL appended to LI captions, swapped into FB captions |
| N | caption_ig | "Link in bio" CTA |
| O | caption_tt | URL inline |
| P | caption_li | URL appended automatically |
| Q | **caption_fb** (NEW) | IG body with URL inlined (no "Link in bio") |
| R | blog_url | Phase 3 |
| S | yt_short_url | Phase 3 |
| T | yt_long_url | Phase 3 |
| U | notebooklm_url | Phase 3 |
| V | repurpose_status | Free-text |
| W | **status** (moved from V) | Pending / Posted / Failed |
| X | **ig_url** (NEW) | Make writes back |
| Y | **fb_url** (NEW) | Make writes back |
| Z | **tt_url** (NEW) | Make writes back ("manual" for now) |
| AA | **li_url** (NEW) | Make writes back |
| AB | **posted_at** (NEW) | Timestamp Make writes back |

## Files in repo

- `social/_drafts/make-scenario-design.md` — design doc
- `social/_drafts/make-scenario-blueprint.json` — final blueprint (matches the live scenario)
- `scripts/build-master-sheet.js` — schema source of truth
- `marketing-footage/social-export/_master-sheet.csv` — generated, ready to re-import
- `PHASE4-STATUS.md` — this file
