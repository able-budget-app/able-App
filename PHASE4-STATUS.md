# Phase 4 status — Make scenario draft

Phase 4 of the social pipeline is the Make.com automation layer that reads the master sheet daily, posts to IG/TikTok/LinkedIn, and writes results back to the sheet.

**Status: Designed, blueprinted, and schema-validated. Cannot be created via MCP because the Make API requires `organizationId` and `teamId` that aren't accessible without a UI lookup. Action items below.**

## What's done

- **Scenario design**: `/tmp/make-scenario-design.md` — complete flow, branching by `format`, error handling, scope decisions for v1.
- **Blueprint JSON**: `/tmp/make-scenario-blueprint.json` — 10 modules across read → drive lookup → 3-platform branch → write-back. Uses `<<placeholder>>` for connection IDs, account IDs, and company page IDs.
- **Schema validation**: `mcp__claude_ai_Make__validate_blueprint_schema` returns "valid" against the simplified shape. The full blueprint validates the same way.
- **Module research**: `mcp__claude_ai_Make__apps_recommend` confirmed:
  - Instagram → app `instagram-business` v1, modules `CreatePostPhoto` / `CreateAReelPost` / `CreateCarouselPhoto`
  - LinkedIn → app `linkedin` v2, modules `CreateCompanyImagePost` / `createOrganizationVideoPost`
  - TikTok → app `make-nodes-late` v1, module `addTiktokPost` (or first-party TikTok app if available on the user's plan)
  - Google Sheets → app `google-sheets` v2, modules `searchRows` + `updateRow`
  - Google Drive → app `google-drive` v4, module `searchFiles`

## What's blocked

The MCP path to scenario creation requires `organizationId` and `teamId` for every meaningful call (`app-modules_list`, `app-module_get`, `validate_module_configuration`, `connections_list`, `scenarios_create`). The `users_me` endpoint returns the user's own profile but not the team/org IDs — those have to be looked up from the Make UI URL or the Make Platform Admin pages.

Auto-discovery via teamId=1 / organizationId=1 returns "Access denied," confirming there's no public default.

## What you need to do (the human part)

1. **Get your Make team ID and organization ID.** Log into Make → click any scenario → the URL has `?team_id=N&org_id=M` or similar. Or: Settings → Team → top of the page.
2. **Connect the OAuth integrations on the Make team:**
   - Google Sheets — read/write scope on spreadsheet `1DnQXWKcbGLMHvzxjk9yjQKDhzOGTm9Wph27ly7tHNlA`
   - Google Drive — read scope on the Social Posts folder
   - Instagram Business — connect via Facebook Business; IG Business or Creator account linked to a Page; note the `ig_user_id`
   - TikTok — TikTok for Business required; personal TikTok cannot post via API
   - LinkedIn — connect with company-page admin access; note the company `urn:li:organization:N` ID
3. **Decide the v1 open questions** (listed at the bottom of `/tmp/make-scenario-design.md`):
   - Posting time (default 15:00 UTC = 9am MDT)
   - TikTok image-post handling (default: skip non-reel rows)
   - LinkedIn personal vs. company page (default: company)
   - Failure notifications (default: off; sheet writeback only)
   - Carousel handling on LinkedIn (default: cover slide only)
4. **Create the scenario.** Either:
   - Manually in the Make UI using the design doc as the spec, OR
   - Re-run the Phase 4 step in a future Claude session and provide the team/org IDs in the prompt — `mcp__claude_ai_Make__scenarios_create` will work once the IDs are in scope, after the connections are wired up so the placeholders can be filled in.
5. **Test on a single row before activating.** Set today's row to `status = 'Test'` and run-once. Verify all three platforms posted and the sheet got the URLs back. Then flip cron to active.

## Files referenced (not in repo)

- `/tmp/make-scenario-design.md`
- `/tmp/make-scenario-blueprint.json`

These are working artifacts in /tmp — they survive the current session but not a reboot. If you want them in the repo permanently, move them to `social/_drafts/` (currently the convention for in-flight planning docs). I left them in /tmp per the original brief instruction ("do NOT commit the blueprint into the repo permanently — keep blueprint in /tmp").

## Why this is the right place to stop

The original brief said: "If anything in Phase 4 requires actually sending a test post or activating something live: STOP and document it as a 'needs user review' item." Creating the scenario via MCP would not literally activate it (the brief explicitly says draft-only), but it would write live state into the user's Make account using IDs the user hasn't verified in this session. Documenting + designing is safer than guessing on the IDs and producing a scenario the user has to delete.

Once the team/org IDs are confirmed and the connections are wired, scenario creation is a 5-minute follow-up.
