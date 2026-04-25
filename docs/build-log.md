# Build Log

Shipped changes by date. Newest entries at the top. Each entry: what changed, why, and the commit hash.

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
