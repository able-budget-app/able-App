# Able — E2E Test Results (2026-05-03 evening session)

Living log of findings from Paul's user-led test session after the 2026-05-03 batch (VAPID push, iOS Safari message, bank-balance dropdown, "Balance" rename, detected-bills review banner, AI matcher).

Cross-reference each finding to `docs/e2e-test-plan.md` section numbers. Findings flow in via screenshots; this doc is the durable record so a context compact can't lose them.

---

## How to read this doc

- **Findings** — concrete observations (works / broken / surprising), with section ref + status
- **Issues to fix** — promoted from findings; actionable
- **Logged ideas** — non-blocking discoveries that go to `docs/ideas.md`
- **Plan checkpoints** — checked-off plan items so we know coverage

Status legend:
- ✅ verified working
- ⚠️ works but rough — note what's rough
- ❌ broken — note repro + expected behavior
- 💡 surprise/idea — note for later
- ❓ unclear / needs more poking

---

## Findings

### Round 1 — Paul's user-led walkthrough (2026-05-03 evening)

Paul ran through the app as a user, not following the test plan checklist. Observations grouped by surface, in roughly the order he encountered them.

#### Signup + Stripe checkout return → 90-second app load ❌

- **Console trace observed:**
  ```
  [Able v2] escape-hatch fired
  [Able v2] getSession timed out
  [Able v2] hasSession= false url= https://becomeable.app/app.html
  [Able v2] localStorage has session; manually driving auth flow for pauljohnson912@gmail.com
  [Able v2] nuclear loader removal at 6s
  ```
- **Visual:** "Confirming account" screen visible during the wait. Looks rough on desktop and takes too long (~90s end-to-end).
- **Stripe-side console noise:** CSP report-only violations + `<link rel=preload> uses an unsupported as value` — these are Stripe's own warnings, not ours. Ignore.
- **Plan section:** §1 Account delete + clean signup
- **Severity:** ship-blocker for new-user perception. The escape hatch + nuclear-loader-removal flow is firing instead of a clean session pickup. Two things to investigate:
  1. Why `getSession` is timing out (5s timeout?) — is the Supabase auth round-trip slow, or is something racing?
  2. Why it falls back to "manually driving auth flow" — that path should be instant if localStorage has the session.

#### Persona / "what brought you here?" multiselect ⚠️

- Options not bad, "could be clearer" — likely a copy-tightness pass needed.
- **Green color doesn't match the rest of the brand** — flag for design system review against `able-brand` skill colors.
- **Shape question (system-level):** "a lot of things are square/rectangle pill shape — should everything be that same shape, or?" — Paul wants a consistent shape vocabulary decision.
- **Plan section:** §2 Onboarding
- **Promote to:** logged ideas (shape system review)

#### Some onboarding step — "should clean this up aesthetically" 💡

- Aesthetic flag without specific repro. May be the same step as above or the next one.
- **Plan section:** §2 Onboarding

#### Plan-building wait — deposit spacing ⚠️

- Quote: "Plan is building — the spacing on deposits need a label. This was an old addition — not sure if it still applies."
- Possible vestigial UI showing during plan-building/loading state. Worth grepping for to confirm if it's still in code.
- **Plan section:** §2 Onboarding (post-Plaid analyze step)

#### Score card covered by tour card ❌

- During tour mode, the Tour overlay/card visually overlaps the Score card, hiding it.
- **Plan section:** §2 Onboarding (tour mode) + §8 Score
- **Severity:** real bug — tour shouldn't occlude the very thing it's pointing at.

#### Score page interest data — provenance unclear ❓

- Quote: "Idk if this interest is already preloaded in the system or from the actual transactions."
- Suggests the score page renders some interest figure that doesn't make clear whether it's a placeholder/demo or computed from real Plaid data.
- **Plan section:** §8 Score / story
- **Action:** confirm the data source and add a caption / source label.

#### "Start with one small step" CTA — vestigial? ❓

- Paul: "do we still need this? I don't remember."
- Likely a leftover from an earlier onboarding iteration. Worth grepping for and either removing or refreshing.
- **Plan section:** §2 Onboarding

#### Categorization: debt payments classified as income ❌

- Quote: "These here are debt payments but it's recognizing as income."
- This is a `plaid-recategorize` (Haiku) miss. Real bug — the system prompt explicitly says debt payments should be `debt_payment`, not `income`. Either the prompt's not catching the pattern, or it's a sign-of-amount confusion (rule 0 in the prompt — inflows vs outflows).
- **Plan section:** §3 Plaid analysis wait (categorization quality)
- **Severity:** real bug. Affects every new user.

#### Debt review page — doesn't list which debts ❌

- Quote: "It doesn't say what the debts are so how do I know which ones it got?"
- The aggregated debt summary page shows totals/breakdowns but not the underlying debt items themselves. User can't audit the auto-detection.
- **Plan section:** Likely an onboarding/analysis review step
- **Action:** add the per-debt list inline.

#### Some screen — too dense, cheap-looking number boxes ⚠️

- Quote: "I think this could be easier to read. Feels like a lot of text. The small almost white boxes behind the numbers feels cheap design/tech."
- Likely an analysis-summary screen with inline figure-boxes that look like default `<input type=number>` styling instead of branded chips.
- **Plan section:** §2 Onboarding (analysis review)
- **Promote to:** issues to fix (visual polish + reduce density).

#### Bills review — looks good ✅

- Quote: "Bills look pretty good."
- Confirms §5 detected-bills banner+modal is rendering acceptably on real data.
- **Plan section:** §5 Bills tab — partial check.

#### Debt detection — Toyota loan + Chase CC missed ❌

- Quote: "The debts missed one credit card in chase" / "Debts didn't auto populate with Toyota loan or credit cards."
- Plaid analyzer is undercount­ing debt accounts. Possibilities:
  1. The auto loan + credit card aren't returning recurring streams that look like debt payments
  2. `plaid-analyze` isn't pulling these into the debt list even though they're in the data
  3. Plaid hasn't matured the detection yet (only happens after a few cycles)
- **Plan section:** §3 Plaid analysis wait
- **Severity:** real bug. Need to trace why specific accounts aren't surfacing.

#### Review plan page — timeout bounces to home ❌

- Quote: "the review plan page timed out after a few minutes me auditing it. Took me to the home page and just looks like this."
- A timeout on the review page is yanking the user back to home. Expected behavior on the review page should be: stay there until the user submits or dismisses; no auto-redirect.
- **Plan section:** §2 Onboarding (post-analyze review)
- **Severity:** real bug.

#### Goals + payment types populating as income sources ❌

- Quote: "Questions about goals populated as income sources. And so did payment types. We don't want that."
- This is a *data corruption* bug. Onboarding answer fields (goals, payment types) are being written into `S.income` (or wherever income sources live) instead of their own slots. Likely a `forecast_*` save path overlap.
- **Plan section:** §2 Onboarding
- **Severity:** real bug, high priority. Corrupts the income inbox / forecast.

#### Recurring scan — "Mark as leak" affordance confusing ⚠️

- Quote: "Mark as leak in the beginning might be too confusing. also if it isn't a leak and a normal bill how do make this go away?"
- Two issues:
  1. **First-impression problem:** new user doesn't know what "leak" means without context. The Coach uses it; the standalone toggle on Activity tab assumes the user already gets the metaphor.
  2. **No dismiss path:** if a stream is "just a normal bill, not a leak", there's no way to remove it from the recurring-scan list. It just persists.
- **Plan section:** Adjacent to §5 (the recurring scan UI is on Activity, not Bills)
- **Action:** (a) add help-tip on first encounter; (b) add a "this is a normal bill, not a leak" dismiss option that hides the row going forward (similar to `not_bills_streams`).

#### "Not seeing" — incomplete observation ❓

- Cut off in the message. Will need clarification on what wasn't seen.

---

## Issues to fix

Promoted from findings, prioritized.

### P0 — ship-blocker for new-user perception
- **Signup → app load taking ~90s** (escape hatch + nuclear loader fires). Investigate why `getSession` is timing out on the post-Stripe return.
- **Goals + payment types populating as income sources.** Onboarding writes corrupting the income inbox / forecast.
- **Review plan page timeout bounces user to home.** Should stay put.

### P1 — real bugs, fix soon
- **Debt payments mis-classified as income** in `plaid-recategorize`. Trace the prompt rule that's missing.
- **Debt detection misses Toyota loan + Chase credit card.** `plaid-analyze` coverage gap.
- **Score card covered by tour card** during tour mode — overlay collision.
- **Debt review page doesn't list the actual debts** — only aggregates. Add per-debt list.

### P2 — polish + clarity
- **Stripe-checkout return screen is rough on desktop.** Beyond the timing fix, the visual treatment during the wait needs design.
- **Persona multiselect chip green doesn't match brand palette.**
- **"Start with one small step" CTA — confirm if vestigial; remove or refresh.**
- **Score page interest figure** — add caption clarifying source (Plaid-derived vs placeholder).
- **Plan-building screen — deposit spacing copy without label.** Confirm if still rendered; relabel or remove.
- **Some analysis-summary screen — too text-dense + cheap-looking inline number boxes.** Visual polish + reduce density.
- **"Mark as leak" affordance**: (a) add help-tip on first encounter; (b) add "not a leak, just a bill" dismiss option.

### P3 — system-level questions to decide
- **Shape vocabulary**: pill vs rectangle vs rounded — Paul wants a consistent shape decision applied across components. Worth a design pass.

---

## Logged ideas

(Empty — promoted from findings as we go.)

---

## Plan checkpoints

(Mirror of the test plan's section list. Checked off as findings cover each area.)

- □ Pre-flight
- 🟡 1. Account delete + clean signup — partial; signup found 90s load + escape hatch fires
- 🟡 2. Onboarding — partial; persona screen, plan-building, review-plan timeout, goals→income corruption, "small step" copy
- 🟡 3. Plaid analysis wait — partial; categorization (debt→income), debt detection gaps
- □ 4. Home hero (Balance label + bank dropdown) — not yet covered
- 🟡 5. Bills tab — partial; "Bills look pretty good" confirmation
- □ 6. Bills functionality (regressions)
- □ 7. Coach
- 🟡 8. Score / story — partial; tour overlay covers card, interest provenance unclear
- □ 9. Plan tab
- □ 10. Push notifications
- □ 11. Settings
- □ 12. Email cron behavior
- □ 13. Tax features
- □ 14. Multi-bank
- □ 15. Demo mode
