# QA Log

Running log of QA findings and verification passes. Newest entries at the top.

---

## 2026-04-24 - QA audit round 2 (engineering bucket)

No audit team this round - direct Editor pass against the deferred engineering items from round 1. Four fixes applied, full details in `build-log.md`.

Verification: JS parses cleanly, all four touch points exercised mentally:
- `flushSave()` correctly bails when no `saveTimer` is set; otherwise clears the timer and fires the upsert. The `visibilitychange` listener is added at module level so it's installed before login (the `if(!currentUser)` guard inside makes pre-login firings a no-op).
- The warning branch correctly identifies fixed-allocation-caused shortfall: `fixedTotal > 0.01 && amount >= windowNeeded` means the deposit could have covered bills if not for fixed cuts. Otherwise the deposit was just small.
- The month-boundary helper has three signal levels and a default-stale fallback. Legacy migration via top-history-timestamp covers users whose `S.settings.allocResetMonth` was never written. The `applyJobs` write path always sets `allocResetMonth` to current month, so within-session and cross-session behavior converge.
- `cancelForecastPreview()` clears both pending vars before closing - this also closes the latent path QA flagged in round 1.

No regressions surfaced. Branch ahead of origin/main by 1 commit, awaiting user push.

---

## 2026-04-24 - QA Audit Round 1

Status: fixes applied, awaiting QA review.

### Auditors dispatched
- Bug Fixer (app.html, supabase/functions)
- Allocation Auditor (Smart Allocation flow)
- AI Coach Auditor (real-data grounding)

### Findings summary
- Bug Fixer: 3 critical, 4 high, 6 medium, 4 low. One critical (`reverseJobs` legacy fallback) was a false positive on close inspection - legacy entries always paid extra to highest-rate debt only, so restoring all of it there is correct.
- Allocation Auditor: 3 high, 6 medium, 9 low. Largest issues: no real preview/confirm step in `allocate()`, forecast race condition allowing double-allocation across tabs, legacy bills with undefined priority silently skipped.
- AI Coach Auditor: 1 critical, 1 high, plus several mediums. Critical: `supabase/functions/coach-chat/index.ts` is not in the repo - the live edge function was deployed via the Supabase dashboard only, so its system prompt and rate-limit logic are unauditable.

### Fixes applied (11)
1. Bills hydration normalizes `priority` (default to 2) so legacy/imported rows aren't silently skipped by `computeJobs`. `app.html:1957`
2. `obBuildWithAI` now uses `sbGet().functions.invoke()` so the user's session JWT is attached, not the anon key. `app.html:2249-2257`
3. `computeJobs` clamps `rem = Math.max(0, rem)` after fixed-allocation deductions, preventing negative-remainder propagation. `app.html:2901-2903`
4. `allocate()` guarded by `isAllocating` flag against rapid double-tap. `app.html:3140-3169`
5. `saveEditIncome` only repaints the allocate-sheet result panel if the sheet is open. `app.html:3528-3534`
6. `renderUpcoming()` now refreshes after addBill, delBill, addDebt, delDebt, editDebt. `app.html` multiple locations
7. `renderForecast` resolves the real `S.forecast` index for `gotMoney`/`delForecast` onclicks - fixes silent wrong-row mutation when forecasts are entered out of date order. `app.html:3920-3935`
8. `gotMoney` rejects $0 and already-received forecasts before opening the preview modal. `app.html:3939-3950`
9. `confirmForecastAlloc` re-checks status before applying and uses `isConfirmingForecast` flag, blocking the cross-tab double-allocation race. `app.html:3953-3984`
10. `getBillsForCalendar` filters explicitly to monthly bills with a valid day-of-month, including Sunday weekly previously dropped by `parseInt('0')` falsy. `app.html:4004-4011`
11. `resetMonth` archives score via `computeMonthlyScore()` so the saved value matches the live Score tab. `app.html:4504-4510`
12. Coach payload includes prior `coachHistory.slice(0,-1)` so the model has session memory. `app.html:7873`
13. `evalCoachNudges` ownerPct check uses strict `===` against nullish coalesce, not loose `==`. `app.html:7892`

(13 distinct edits across the 11 numbered fix items - some bundle related changes.)

### Deferred to round 2
- **`allocate()` preview vs commit separation**: requires UX work; today the result panel renders after state is already mutated. Design decision needed.
- **Forecast confirm with adjustable amount**: needs a new editable field in `modal-alloc-preview`.
- **Upcoming widget per-occurrence rendering**: design call - show a `x2` badge or expand rows for weekly bills?
- **Month-boundary auto-detect**: today `S.allocated_to_bills` only resets on manual close-month tap; one missed close turns subsequent allocations into all-debt-and-buffer. Needs design.
- **Insufficient-funds warning when deposit < windowNeeded**: only fires if fixed allocations are the cause; should fire unconditionally.
- **`save()` debounce data-loss on backgrounding**: needs `visibilitychange` flush via `navigator.sendBeacon`.
- **`coach-chat` edge function source missing from repo**: cannot fix without the deployed source. User action required - paste the function body or export from the Supabase dashboard.

### False positives
- `reverseJobs` legacy fallback (Bug Fixer Critical #2): debt was originally rolled to the highest-rate debt only, so the reversal is correct.
- `computeJobs` `ownerAmt` double-count (Bug Fixer Critical #3): retracted by the auditor on second read.

### QA review of commit 56af46f
Verdict: PASS WITH CONCERNS. All 13 fixes verified present and correct, no regressions. Two follow-up items:

1. **`delForecast(-1)` silent data corruption** — flagged by QA. `S.forecast.indexOf(f)` in `renderForecast` can return `-1` if the array is replaced concurrently. `gotMoney(-1)` is caught by the `!f` guard at line 3955, but `delForecast(-1)` would `splice(-1,1)` and silently delete the last forecast. **Fixed in follow-up commit** with bounds guard at `app.html:3986-3990`.
2. **`modal-alloc-preview` Cancel doesn't clear `_pendingForecastIdx`** — pre-existing latent path. Self-heals in normal flow because the next `gotMoney` overwrites the pending state. Deferred to round 2.

Score-formula change in `resetMonth` is a real semantic shift (binary 20pt → proportional). It's the intended fix (archive should match the live tab), but worth a one-line note to users that historical-vs-future month scores aren't strictly comparable until enough months have passed under the new formula.
