# Build Log

Shipped changes by date. Newest entries at the top. Each entry: what changed, why, and the commit hash.

---

## 2026-04-24 - pricing increase ($9.99/$79 -> $14.99/$129)

Commit: `pricing: $14.99 monthly, $129 annual ('save $50' framing)`

New Stripe prices created on the existing product:
- Monthly: `price_1TPyQ6DBmPAhrdxkrsz0gtfq` ($14.99 USD recurring monthly)
- Annual: `price_1TPyPZDBmPAhrdxkAwiyRC6U` ($129 USD recurring yearly)

Old prices (`price_1TO3hVDBmPAhrdxkIbpGti8n` and `price_1TPUDjDBmPAhrdxkL7IkGqp3`) are archived in Stripe so new checkouts can't pick them up; existing subscribers stay on the old amounts (grandfather). Lifetime price unchanged.

Code touched (1 batch):
- Stripe price ID constants in `app.html`
- App paywall display: monthly + annual cards, fine print, per-month equivalent ($6.58 -> $10.75)
- Marketing pricing in `index.html`: stakes callout, monthly card, annual card, submeta
- 4 comparison pages (rocket-money, mint-shutting-down, monarch-money, ynab) Able pricing column
- 3 email templates (`trial-day-5-nudge.md`, `trial-day-7-last-call.md`, `welcome-04-day-2-check-in.md`)
- `docs/seo-content-brief.md`

Annual savings framing changed: "Two months free" -> "Save $50 with annual." The math actually shifted slightly (old saved $40.88, new saves $50.88, both ~3+ months free), but $50 is the cleaner round number and matches how the user wants it framed.

Memory updated: `project_launch_checklist.md` now reflects new pricing + grandfather note.

The .md email templates in `/emails/` are reference copies (the live emails are in `supabase/functions/email-cron-daily/index.ts`, which doesn't reference dollar amounts directly - it uses dynamic copy and the Stripe-billed amount). So no edge-function redeploy needed for this pricing change. Just `git push` for the static site.

---

## 2026-04-24 - punch list (logo, split default, auth, email design)

Commit: `polish: logo underline, split defaults, auth fixes, email redesign`

Six fixes from a brain-dump punch list:

- Logo underline now applied to `.logo`, `.auth-logo`, `.paywall-logo` matching the marketing site treatment (data-URI SVG, centered fixed-width below the text). Three CSS additions, no markup changes.
- Settings → "How to split surplus money" now offers a "Use this" button with literature-default split (5% pay yourself / 50% extra debt / 35% buffer / 10% spend). Frames Able's positioning per memory: extending Ramsey-aggressive-debt with a small Profit-First owner draw baseline.
- Google OAuth: `signInWithOAuth` now passes `queryParams: { prompt: 'select_account' }`. Without this, Google silently signs the user in with the browser's cached account, which made "sign out then create a new account" loop into the same account and made Sign Up vs Sign In behave identically. This should also help the incognito-signup-redirects-to-auth-screen bug.
- OAuth callback errors no longer log silently. If `getSession()` throws during code exchange, the URL params are cleared (so a refresh doesn't retry the dead code) and `showAuthError` surfaces a real message.
- Auth listener: removed the `initialSessionHandled` gate from the `SIGNED_IN` handler. The original gate was a defensive workaround for a Supabase SDK race where queries could hang before INITIAL_SESSION; with current SDK timeouts, the gate's main effect was leaving users stuck on the auth screen if INITIAL_SESSION fired without a user. Now `SIGNED_IN` always runs the auth flow when a user is present; the existing `runAuthFlow` guard dedupes against concurrent INITIAL_SESSION-triggered runs.
- Email layout (`supabase/functions/email-cron-daily/index.ts`) redesigned: table-based outer structure for Outlook compatibility, branded logo header with hand-drawn underline (data-URI SVG `<img>`), gradient accent strip on the card, gradient CTA, "becomeable.app" footer. All 11 templates pick up the new shell automatically since they go through `layout()`.

**Deploy split between two surfaces:**
- Static-site changes (`app.html`) deploy via Netlify on `git push origin main`.
- The email function update requires a separate deploy step: `./scripts/deploy-functions.sh email-cron-daily`. A `git push` does NOT redeploy edge functions.

---

## 2026-04-24 - coach-chat source committed + client cleanup

Commit: `add coach-chat function source + revert redundant client history send`

- `supabase/functions/coach-chat/index.ts` added, matching the deployed function byte-for-byte. Closes the round 1 audit gap where the live function was deployed via the Supabase dashboard but never committed - the system prompt, model ID, rate limit, and grounding logic are now versioned.
- Client-side `coachSend` no longer ships `history: coachHistory.slice(0,-1)` in the request body. The backend re-loads conversation history from the `coach_messages` table keyed by `user_id` (limit 40, ordered ASC), so the client send was redundant payload. Reverts a portion of round 1 fix #12.
- Heads-up unrelated to this commit: the deployed function uses `claude-haiku-4-5`, not Sonnet 4.6 as commit `3145e3d`'s description claimed. Haiku is fine for this use case (cheaper, faster, still capable of the empathy-first reasoning the brand voice describes), but the prior commit message was wrong.
- Future cleanup parked: function uses inline CORS headers instead of importing from `_shared/cors.ts` like other functions. Not worth changing in this commit since it's a faithful copy of what's running, but worth a refactor pass when convenient.

---

## 2026-04-24 - QA audit round 3 (UX bucket)

Commit: `fix QA audit round 3 - UX bucket` (hash filled in after commit)

Three deferred UX items, all in `app.html`. Unifies direct and forecast paths through a shared preview modal.

- **Real tap-to-confirm**: `allocate()` no longer mutates state. It computes jobs, stages them in `_pendingAlloc`, and opens `modal-alloc-preview`. The actual `applyJobs` call moves to `confirmAlloc()`. Cancel discards the staged allocation and leaves the input fields populated so the user can adjust without retyping.
- **Editable amount in preview**: the modal now has an amount input that re-runs `computeJobs` on change and re-renders the job list. Works for both direct income (on-the-fly adjustment) and forecast confirm (forecast-amount-edit was the original ask). Confirm re-validates and re-syncs in case the user edited without triggering oninput.
- **Per-occurrence upcoming widget**: `renderUpcoming` now reads from `billsInWindow()` instead of `S.bills`, so weekly/biweekly bills show their cumulative window total. Multi-occurrence rows display "$50 x 3 in 14d" so the totals match what the allocator reserves.

Refactor: `_pendingForecastIdx` / `_pendingForecastJobs` / `confirmForecastAlloc` / `cancelForecastPreview` / `isConfirmingForecast` all collapsed into the unified `_pendingAlloc` + `confirmAlloc` + `cancelAllocPreview` + `isAllocating` set. Single source of truth, simpler invariants.

---

## 2026-04-24 - QA audit round 2 (engineering bucket)

Commit: `fix QA audit round 2 - engineering items` (hash filled in after commit)

Four engineering items deferred from round 1, all in `app.html`. No DB schema changes.

- `visibilitychange` listener flushes the 800ms debounced `save()` immediately when the document goes hidden, so backgrounding the app mid-allocation doesn't drop the write. Implemented by extracting `_writeUserData()` and adding `flushSave()`.
- The insufficient-funds warning that previously always read "Fixed allocations left X short" now branches: if fixed allocations caused the shortfall, the wording stays; if the deposit itself was just smaller than upcoming bills, the wording correctly says so.
- Month-boundary auto-detect: the running `S.allocated_to_bills` counter is now gated by `S.settings.allocResetMonth`. If we cross a calendar month without a manual close, both the read (in `computeJobs`) and the write (in `applyJobs`) treat the prior counter as zero. Legacy users without `allocResetMonth` fall back to inspecting the top history entry's timestamp.
- The `modal-alloc-preview` Close and × buttons now route through `cancelForecastPreview()` which clears `_pendingForecastIdx` and `_pendingForecastJobs` before closing the modal.

UX-bucket items (split allocate preview from commit, forecast amount edit, per-occurrence upcoming widget) remain deferred pending design decisions - tracked in `docs/tasks.md` under Round 3.

---

## 2026-04-24 - QA audit round 1 fixes

Commit: `fix QA audit round 1` (hash filled in after commit)

11 fixes across the allocation engine, forecast flow, coach chat, and bill/debt CRUD. Driven by a 3-auditor read-only sweep (Bug Fixer, Allocation Auditor, AI Coach Auditor). See `qa-log.md` for full findings, fixes, and items deferred to round 2.

Headline:
- Forecast index mismatch (silent wrong-row allocation when forecasts entered out of date order) fixed.
- Forecast cross-tab double-allocation race fixed via re-check + flag.
- Legacy bills with `priority` undefined no longer silently skipped by `computeJobs`.
- `obBuildWithAI` switched to `functions.invoke()` so the user's JWT is attached, not the anon key.
- Coach payload now sends prior conversation turns; multi-turn chat is no longer amnesiac.
- Score archived in `resetMonth` now matches the live Score tab via `computeMonthlyScore()`.
- Allocate button guarded against rapid double-tap.
- `renderUpcoming` now repaints after every bill/debt mutation.

Not pushed - awaiting user review and `git push origin main` (which is denied in `.claude/settings.json` deliberately, since pushing main triggers Netlify auto-deploy).
