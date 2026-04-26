# Phase 4 status — Make scenario CREATED ✅

## Scenario live

**Scenario ID:** `4869011`
**Name:** "Able social — daily cross-post (Phase 4 v1)"
**Edit URL:** https://us2.make.com/1933069/scenarios/4869011/edit
**Status:** PAUSED (`isActive: false`) — won't run until you activate it

## What's wired up

| Module | App | Connection ID | Notes |
|---|---|---|---|
| 1. Read today's row | google-sheets:filterRows | 7727156 (Google) | Filters by `post_date == today` AND `status != Posted` |
| 2. Router | builtin | — | Fans out to 4 parallel branches |
| 3. IG photo post | instagram-business:CreatePostPhoto | 7816528 (FB/IG) | For single/brandscript/carousel |
| 4. IG reel post | instagram-business:CreateAReelPost | 7816528 | For reel format |
| 5. FB photo post | facebook-pages:CreatePostWithPhotos | 7816528 | For all non-reel formats |
| 6. LinkedIn image post | linkedin:CreateCompanyImagePost | 8569387 | For all non-reel formats |
| 7. LinkedIn video post | linkedin:createOrganizationVideoPost | 8569387 | For reel format |
| 8. Update sheet status | google-sheets:updateRow | 7727156 | Marks row as Posted |

**Scheduling (applied):**
- Mon-Sat at 12:00 NY time = **10am Mountain**
- Sun at 16:00 NY time = **2pm Mountain**

(If you change your Make team timezone to America/Denver, edit scheduler to 10:00 / 14:00.)

---

## ⚠️ Things you need to finish in the Make UI before activating

The scenario is a **scaffold**. It has the right modules and the right connections, but several module-level fields need to be picked from dropdowns or filled in. Open the scenario and click each module to configure:

### 1. Pick the right account/page in each platform module

- **IG modules (3, 4):** Click the module → `Page` dropdown → select Able's IG Business account.
  - Requires Able's IG Business account to be linked to a FB Page accessible from your Facebook connection.
- **FB module (5):** Click the module → `Page` dropdown → select Able's FB Page.
- **LinkedIn modules (6, 7):** Click the module → `Company` dropdown → select Able's company page (the one you just created).

### 2. Add the media URL source — **scenario currently has empty image_url / video_url fields**

The original design had a Google Drive search step that auto-resolved the file from the `filename` column. I had to remove it because Make's google-drive `searchFiles` module doesn't exist at the version I tried. You have two options:

**Option A (simpler — recommended for v1):** Add a `drive_url` column to the master sheet manually.
- Add column W = `drive_url` to the spreadsheet
- For each row, paste the Drive shareable link in the format `https://drive.google.com/uc?id={fileId}&export=download`
- Update each platform module's `image_url` / `video_url` / `photos[0].url` field to reference `{{1.`W`}}`
- Update the filter range in module 1 from `A1:V1` to `A1:W1`
- Tedious for 175 rows, but you can do it once via a sheet formula if filenames are consistent

**Option B (proper — recommended for v2):** Insert a Drive lookup step
- Open the scenario, click between modules 1 and 2 (router), click `+ Add module`
- Search for `Google Drive` → choose `Search files` (the right module name in the UI)
- Configure: search query `name = '{{1.`K`}}' and trashed = false`, limit 1
- Then update each platform module's URL field to reference the Drive output's `webContentLink`

I recommend Option A for the first test (it's faster), then upgrade to Option B once you're comfortable.

### 3. Set up failure notifications (Q4 answer)

The current scenario doesn't have the Gmail error-handler I'd planned (kept the v1 scaffold simple to ship). To add:

- Right-click each platform module → `Add error handler` → choose `Resume` (so other branches still run)
- Connect the error handler to a new module: `Email → Send an Email`
- Select your Gmail connection (`7861787`)
- Configure:
  - To: `pauljohnson912@gmail.com`
  - Subject: `Able social post FAILED · {{formatDate(now; "YYYY-MM-DD")}} · {module name}`
  - Body: include `{{1.`E`}}` (post id), `{{1.`D`}}` (format), and the error message

### 4. Test on a single row before activating

1. Pick today's row in the sheet — confirm `caption_ig` / `caption_fb` / `caption_li` are populated
2. Make sure `status` column is empty
3. Open scenario → click `Run once` (top toolbar)
4. Watch the run inspector — confirm each branch posts successfully
5. Verify the posts on IG/FB/LinkedIn
6. Verify the sheet `status` updated to "Posted at YYYY-MM-DD HH:mm"
7. If everything works, click the toggle to activate the schedule

---

## TikTok still pending

**Decision (Q2):** Skip TikTok in v1. Confirmed via Make's app catalog: the official `tiktok` Make app is **ads-only** (campaigns, ad groups). Content posting requires a third-party app.

For v1, post to TikTok manually using the same captions from the sheet.

For v2, options to automate:
- `make-nodes-late:addTiktokPost` — community-maintained, free, low-popularity (caveat: untested at scale)
- `blotato:Post` — paid scheduler ~$15/mo, supports IG+TT+LI all in one
- `postfast:createPosts` — similar paid scheduler

---

## LinkedIn carousels: cover slide only (Q5)

**Decision:** v1 posts only the carousel cover slide to LinkedIn. The IG and FB carousels show the full multi-slide swipe; LinkedIn shows just slide 1.

For v2 upgrade to PDF document carousels:
1. Add a PDF.co `HTMLtoPDF` step (you already have a PDF.co connection)
2. Replace `linkedin:CreateCompanyImagePost` with `linkedin:Make an API Call` to LinkedIn's UGC Posts endpoint
3. Estimated work: 30-45 min

---

## Files in repo

- `social/_drafts/make-scenario-design.md` — full design doc with locked decisions
- `social/_drafts/make-scenario-blueprint.json` — final blueprint JSON (the version that got created)
- `PHASE4-STATUS.md` — this file

## Phase 4 v2 backlog (ranked)

1. Add `drive_url` column to master sheet OR wire up Drive lookup step in scenario (required before activation)
2. Add Gmail failure notifications on each platform module
3. Test on a single row, fix any module config issues
4. Wire up TikTok via `make-nodes-late` or Blotato
5. LinkedIn document/PDF carousels
6. AI agent that auto-fixes failed posts (low priority per your call)

---

## How to re-authorize GitHub (still needed for overnight cloud runs)

You said this is done — confirming the steps for posterity:

1. claude.ai → Settings → Connectors → GitHub → re-authorize
2. Grant access to `able-budget-app/able-App`
3. Next scheduled overnight `RemoteTrigger` will work
