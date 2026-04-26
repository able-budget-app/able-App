# Phase 4 status — Make scenario draft

Phase 4 of the social pipeline is the Make.com automation layer that reads the master sheet daily, posts to **Facebook + Instagram + TikTok + LinkedIn**, and writes results back to the sheet.

**Status:** Designed, blueprinted, schema-validated. Team ID confirmed (`1933069`). Connection inventory done. Ready to create — but blocked on the 5 design decisions below + 3 missing OAuth connections.

---

## ⚠️ The 5 questions you need to decide before scenario creation

(Pick a default if you're not sure — defaults are reasonable.)

**Q1. Posting time.** When should the daily cron fire?
- **Default:** 15:00 UTC = 9am MDT (Denver time). Same time the email cron fires today.
- Alternatives: 8am local (14:00 UTC) or 10am local (16:00 UTC).

**Q2. TikTok image-post handling.** TikTok's API best supports video. Should the scenario:
- **Default:** Skip non-reel rows. Write `tt_url = "skipped: non-video"` on those days. Only `format == 'reel'` rows post to TikTok.
- Alternative: Use TikTok's image-post API for singles/carousels. It works but is less battle-tested and rejects images that don't meet specific aspect-ratio rules.

**Q3. LinkedIn — personal or company page?** Brand pattern is company page.
- **Default:** Company page. Requires Able to have a LinkedIn company page (does it?). If yes, the scenario uses `linkedin:CreateCompanyImagePost` / `createOrganizationVideoPost`.
- Alternative: Personal profile (your account). Simpler setup, weaker brand presence. Switches modules to `linkedin:ShareImage` / `createVideoPost`.

**Q4. Failure notifications.** When a post fails (rate limit, expired token, bad media), what should happen?
- **Default:** Write `status = 'Failed: {platform}'` to the sheet. No alert. You see it next time you open the sheet.
- Alternative: Also send an email or Slack message via a Make Notification module. (You have Gmail connected on team 1933069 — easy to wire up if you want it.)

**Q5. Carousels on LinkedIn.** LinkedIn's image-post API only takes one image at a time.
- **Default:** Post just the carousel cover slide to LinkedIn (slide 1). The IG/FB posts get the full carousel; LinkedIn gets the cover.
- Alternative: Build a PDF of all slides via an extra Make module (PDF.co or similar — you already have a PDF.co connection from the Rebuilt scenarios) and post that as a LinkedIn document. More setup, more visible carousel on LinkedIn.

**Reply with your picks (e.g., "defaults for all" or "1: 9am, 2: skip, 3: company, 4: gmail, 5: cover only") and I'll update the blueprint and proceed to scenario creation.**

---

## Make team inventory (what I found on team `1933069`)

✅ **Already connected on team 1933069:**
- Google (multi-account: pauljohnson912 + contact@scentsiblek9training) — covers Sheets + Drive
- Facebook ("Paul IG/FB Connection", scope 11) — works for both FB and IG-via-FB
- Anthropic Claude, OpenAI, Cloudinary, Canva, PDF.co, Gmail, GoHighlevel, Squarespace, Twilio, Typeform, PDFMonkey, Apify, Google Business Profile

⚠️ **Connected but tied to wrong business:** The existing Facebook connection is linked to your personal Meta account, which currently has Idaho Custom Trailers and Scentsible K9 pages attached. **For Able-specific posting, you need to either:**
- Add Able's Facebook Page to the same Meta Business account (then it shows up as a selectable Page in the FB Pages module), OR
- Add Able's IG Business account as a connected IG account on Able's FB Page, OR
- Create a new Make connection for Able specifically and select Able's Page.

❌ **NOT connected on team 1933069 — must be added in Make UI:**
- TikTok — Make → Connections → Add → search "TikTok" → choose TikTok for Business → OAuth flow. **Personal TikTok accounts can't post via API.** If Able doesn't have a TikTok for Business yet, this is a setup item before the scenario can run.
- LinkedIn — Make → Connections → Add → search "LinkedIn" → OAuth. For company-page posting (Q3 default), you'll be prompted to grant access to a LinkedIn company page — Able needs to have one and you need admin access to it.

---

## About scenario `4827807`

The URL you pasted (`https://us2.make.com/1933069/scenarios/4827807/edit`) is **"Rebuilt 1B - Copy"** — an existing scenario for one of your other businesses (uses Anthropic + Google Drive + HTTP). That's not the Able social-posting scenario.

**I'll create a fresh scenario for Able once you've answered the 5 questions and connected TikTok + LinkedIn (and optionally fixed the FB/IG-to-Able-Page issue).** The new scenario can live in a new folder named "Able" so it stays separate from your other businesses.

---

## How to re-authorize GitHub (so the cloud overnight runs work next time)

The two scheduled `RemoteTrigger` runs last night auto-disabled with `auto_disabled_repo_access`. That means the cloud runner that executes scheduled Claude tasks lost permission to read/write your GitHub repo `able-budget-app/able-App`. Fix:

1. Open **claude.ai** in a browser (NOT Claude Code CLI — this is a web-app setting).
2. Click your profile/avatar → **Settings**.
3. Look for **Connectors**, **Integrations**, or **Connected Apps** in the left nav. (The exact label moves around between releases.)
4. Find **GitHub** in the list.
5. If it says "Disconnected" or shows an error: click **Connect** / **Re-authorize** and run through the OAuth flow. When GitHub asks which repos to grant access to, select either "All repositories" or specifically include `able-budget-app/able-App`.
6. If you don't see a **Connectors** menu at all, the feature might be at: **Settings → Integrations → Code execution** or under your account-tier settings if it's a Max-only feature.

After re-authorizing, the next scheduled remote run will be able to clone, commit, and push to the repo. (Today's all-manual session bypassed that path, so the cloud auth wasn't needed.)

---

## What I committed in this session

- **Phase 2 captions:** all 159 cadence slots × 3 platforms = 477 captions across 4 batch commits (`84531ae`, `3bb2805`, `7f6e007`, `bb762f3`)
- **Phase 4 design + blueprint:** moved into the repo at `social/_drafts/make-scenario-design.md` and `social/_drafts/make-scenario-blueprint.json` (this update)
- **PHASE4-STATUS.md** — the file you're reading

## What's left for me to do, once you decide

1. Update the blueprint to add the Facebook branch.
2. Update the blueprint based on your Q1-Q5 answers.
3. Validate each module's configuration against Make's schema (`mcp__claude_ai_Make__validate_module_configuration`).
4. Create the scenario via `mcp__claude_ai_Make__scenarios_create` in a new "Able" folder, paused (no cron yet).
5. Document the scenario ID + the connection-IDs you'll need to drop into the placeholder fields in the Make UI.

Total time once you reply: ~15-20 minutes. Most of it is the validate-each-module step which is per-module API calls.
