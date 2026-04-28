# Demo recording setup

How to launch a frozen, lived-in version of the Able app for screen-recording marketing demos. The state is local-only and never touches the production Supabase project.

## Quick start

1. From the repo root, start a static file server:
   ```bash
   python3 -m http.server 8765
   ```
2. In your browser, open:
   ```
   http://localhost:8765/app.html?demo=1
   ```

That's it. The app loads "Alex," a freelance designer with a populated allocation engine, bills, debt, deposit history, AI Coach context, and Learning Center progress.

## What's seeded

| Bucket | Value |
| --- | --- |
| Profile | Alex · Freelance design |
| Income sources | Freelance design · Client retainer · Side projects · Other |
| Last 3 deposits | $2,400 (8d ago) · $1,800 (15d ago) · $3,200 (22d ago) — all "Freelance design" |
| Bills | Rent $1,400 (in 6d) · Phone $85 (in 4d) · Internet $90 (in 11d) · Health insurance $340 (in 9d) · Software $120 (ongoing) · CC minimum $125 (auto-linked) |
| Debt | Chase Sapphire CC — $4,200 balance · 22% APR · $125 minimum |
| Tax set-aside | 28% (fixed allocation, off the top, applies to every source) |
| Allocation split | 28% taxes · 20% extra debt · 15% buffer · 14% pay yourself · 8% free spending |
| Allocation window | 14 days |
| Buffer | $3,200 (goal $14,000 = 6 months of expenses) |
| Money Literacy Score | ~73/100 (30 of 41 lessons completed; 3 in *How to Get Out of Debt*) |
| Learn streak | 9 days current · 12 days longest |
| AI Coach | Pre-seeded with one Q&A thread about the $2,400 deposit |

Bill due dates are computed at load time from "today + N days," so they always look correct relative to the recording date.

## Demo controls (paste into DevTools console)

| Command | What it does |
| --- | --- |
| `window.resetAbleDemo()` | Reload with a fresh seed (clears any in-memory edits made during recording). |
| `window.exitAbleDemo()` | Disable demo mode and reload (back to the real auth screen). |

The first time you load `?demo=1`, the seed flag is also stored in `sessionStorage` so reloads inside the same tab stay in demo mode without needing the query param. Closing the tab clears it; otherwise call `exitAbleDemo()`.

## Recording flow that exercises the full app

1. **Home (Dashboard)** — score, "next 14 days" runway, recent activity.
2. **Log income** — type a deposit, watch the allocation preview build (taxes off the top → bills → debt → buffer → pay yourself → free spending).
3. **Bills** — five upcoming bills, sorted by due date. Edit / mark paid.
4. **Debt** — Chase Sapphire $4,200 with the projected payoff timeline. Drag the "Extra payment" slider.
5. **AI Coach** — tap the Coach tab; the pre-seeded thread is visible. (Live replies are stubbed — the model isn't connected in demo mode.)
6. **Learn** — Money Literacy Score, course progress, badges, "Get Out of Debt" course showing 3/10 done.
7. **Settings** — split percentages, allocation window, fixed allocations (28% tax rule).

## How it works (under the hood)

- `?demo=1` triggers an inline loader in `app.html` (just under the Supabase script) that pulls in `scripts/demo-seed.js`.
- `demo-seed.js` runs **before** the app's main inline script, so it can replace `window.supabase.createClient` with a stub that:
  - Reports an active subscription on `profiles`.
  - Returns the Alex persona on `user_data`.
  - Returns 30 completed lessons on `lesson_progress`.
  - Returns a sample chat thread on `coach_messages`.
  - Returns `{ data: null, error: ... }` on every write (`upsert`/`insert`/`update`/`delete`), so the app's normal save path runs but nothing leaks to the real database.
- After the page loads, the seed fires a synthetic `INITIAL_SESSION` auth event so the app's standard load pipeline runs against the stubbed client. From the app's perspective, it's a real signed-in user.
- A small CSS rule prevents the auth/paywall/onboarding screens from flashing during the auth handoff.

If you make in-recording edits (e.g. mark a bill paid), they live only in the page's in-memory `S` object. A reload restores the canonical seed.

## Don't push this to production

The demo path is gated by an explicit `?demo=1` (or `sessionStorage.able_demo === '1'`) check. If neither is present, `demo-seed.js` is never even fetched, so production users are unaffected. Still — there's no reason to ship the seed to the live host. Keep `scripts/demo-seed.js` either local-only or behind a build-time flag if you start deploying from this branch.

To strip the demo entirely:
1. Delete `scripts/demo-seed.js`.
2. Remove the inline loader block in `app.html` (the `<!-- Demo seed (local-only) -->` comment + script tag right after the Supabase CDN script).
