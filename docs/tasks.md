# Able Tasks

Active task list for QA + build rounds. See `qa-log.md` for QA history and `build-log.md` for shipped changes.

## QA Audit Round 1 (2026-04-24)

- [x] Bug Fixer audit (app.html, supabase/functions)
- [x] Allocation Auditor (Smart Allocation flow)
- [x] AI Coach Auditor (real-data grounding)
- [x] Editor: apply fixes, commit `fix QA audit round 1`
- [x] QA review of editor diff (PASS WITH CONCERNS, follow-up shipped as `f10c518`)
- [x] User: review and push to main (deployed via Netlify)

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

## Round 4 - punch list (2026-04-24)

- [x] Logo underline in app (auth, paywall, navbar) matching marketing site
- [x] Smart-default surplus split button ("Use this" with 5/50/35/10)
- [x] Google OAuth: force account picker via `prompt: select_account`
- [x] OAuth callback errors surface to auth screen instead of silent console log
- [x] Auth flow: removed `initialSessionHandled` gate so `SIGNED_IN` always runs the flow when a user is present
- [x] Email layout redesigned (table-based for Outlook compat, underlined logo header, gradient accent strip, gradient CTA, branded footer)

Deferred to a future pass (per scope, not blockers):
- Animated GIFs in emails - requires designer assets, drop into `inner` HTML when ready
- Deeper Google OAuth race investigation if the `prompt: select_account` + auth-flow fix doesn't fully resolve the incognito flow
