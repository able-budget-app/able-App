# Build Log

Shipped changes by date. Newest entries at the top. Each entry: what changed, why, and the commit hash.

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
