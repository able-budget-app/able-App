# Able Tasks

Active task list for QA + build rounds. See `qa-log.md` for QA history and `build-log.md` for shipped changes.

## QA Audit Round 1 (2026-04-24)

- [x] Bug Fixer audit (app.html, supabase/functions)
- [x] Allocation Auditor (Smart Allocation flow)
- [x] AI Coach Auditor (real-data grounding)
- [x] Editor: apply fixes, commit `fix QA audit round 1`
- [ ] QA review of editor diff
- [ ] User: review and push to main (deploys via Netlify)

## Round 2 candidates (deferred from Round 1)

UX/design decisions:
- [ ] Split `allocate()` preview from commit - real tap-to-confirm
- [ ] Adjustable amount field in forecast confirm modal
- [ ] Per-occurrence rendering in Upcoming widget for weekly/biweekly bills

Engineering:
- [ ] Auto-detect month boundary so `S.allocated_to_bills` resets without manual close
- [ ] Always-on insufficient-funds warning (not just when fixed-allocations cause shortfall)
- [ ] `visibilitychange` flush of pending `save()` debounce via `navigator.sendBeacon`

Out-of-band:
- [ ] Add `supabase/functions/coach-chat/index.ts` to repo - currently deployed only via dashboard, system prompt is unauditable from source
