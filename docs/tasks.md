# Able Tasks

Active task list for QA + build rounds. See `qa-log.md` for QA history and `build-log.md` for shipped changes.

## QA Audit Round 1 (2026-04-24)

- [x] Bug Fixer audit (app.html, supabase/functions)
- [x] Allocation Auditor (Smart Allocation flow)
- [x] AI Coach Auditor (real-data grounding)
- [x] Editor: apply fixes, commit `fix QA audit round 1`
- [ ] QA review of editor diff
- [ ] User: review and push to main (deploys via Netlify)

## Round 2 - engineering bucket (2026-04-24)

- [x] `visibilitychange` flush of pending `save()` debounce
- [x] Always-on insufficient-funds warning, branched by cause
- [x] Auto-detect month boundary so `S.allocated_to_bills` resets without manual close
- [x] Modal-Cancel pending forecast cleanup

## Round 3 - UX bucket (2026-04-24)

- [x] Split `allocate()` preview from commit - real tap-to-confirm
- [x] Adjustable amount field in forecast confirm modal (also gives direct-income users on-the-fly amount adjustment)
- [x] Per-occurrence rendering in Upcoming widget for weekly/biweekly bills

## Out-of-band

- [x] Add `supabase/functions/coach-chat/index.ts` to repo (2026-04-24)
