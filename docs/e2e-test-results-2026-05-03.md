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

### Round 2 — Paul's user-led walkthrough with aligned screenshots (2026-05-03 evening)

Re-logged with screenshot-anchored detail. Round 1 (text-only) is superseded by this section. New finding revealed by screenshots: **the review-plan timeout is the root cause of the "no bills came through" + "no debts came through" symptoms** — the auto-detected bills and debts never persisted because the page timed out before Paul finished auditing.

#### Signup + Stripe checkout return → 90-second app load ❌ (P0)

**Screenshot:** 10:09 PM — "Confirming your subscription. Usually takes a few seconds." pill on a big white card centered on a vast empty page.

**Problem:** UI is sparse and centered (lots of whitespace), the spinner pill is the only thing visible, and the wait is ~90 seconds — eternity for a new user post-checkout. The console flow `escape-hatch fired → getSession timed out → hasSession=false → manually driving auth flow → nuclear loader removal at 6s` shows fallback after fallback firing.

**Root cause to investigate:**
1. `getSession` is timing out — Supabase auth check too slow on the post-Stripe return, likely because the session cookie is in localStorage but the app waits on a Supabase server round-trip first.
2. The "manually driving auth flow" branch should be the *fast* path, not the fallback path. If localStorage already has the session, we should detect and use it immediately, not after a 5-second timeout.

**Visual fix needed alongside:** the wait screen needs more substance — progress indicator, a calming line of copy, or skeleton of where they're going. Right now it looks like Able is broken.

**Plan section:** §1 Account delete + clean signup

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

#### Persona / "what brought you here?" multiselect ⚠️ (P2)

**Screenshot:** 10:11 PM — Step 2 of 7 "What brought you here?" with 6 options listed.

**Problem 1 — selected vs. unselected affordance:** the two selected options (*Smooth out slow months without panic*, *Dig out of debt without losing my mind*) are filled green pills. The four unselected options are *plain bold text only* — no border, no ghost-pill, no hover background. New user has no way to tell they're clickable. They look like static labels.

**Problem 2 — green tint:** the filled pill green doesn't match the brand greens used elsewhere in the hero (`#1f6038 → #3d9e78`). It reads as a slightly different, slightly washier shade.

**Problem 3 (system-level) — shape vocabulary:** Paul flagged that across the app, button/chip shapes feel inconsistent (square corners, fully rounded pills, soft 8-12px radii, all coexisting). Wants a single shape decision applied consistently — or, if differentiation is intentional, a clear hierarchy of when to use each shape.

**Plan section:** §2 Onboarding

- Options not bad, "could be clearer" — likely a copy-tightness pass needed.
- **Green color doesn't match the rest of the brand** — flag for design system review against `able-brand` skill colors.
- **Shape question (system-level):** "a lot of things are square/rectangle pill shape — should everything be that same shape, or?" — Paul wants a consistent shape vocabulary decision.
- **Plan section:** §2 Onboarding
- **Promote to:** logged ideas (shape system review)

#### "Last step. Connect your bank." — needs aesthetic pass ⚠️ (P2)

**Screenshot:** 10:13 PM — Step 7 of 7 with 6 / 12 / 24 month radio chips, big green "Connect bank" button, "Skip and enter manually" link, "Skip for now and explore" tertiary at bottom.

**Problem:** functional but not great-looking on desktop. Radios are circle-style (different vocabulary from the pill-chips on the persona step), the back/skip hierarchy is inconsistent with earlier steps. Visual treatment doesn't quite match the brand polish of the landing page.

**Plan section:** §2 Onboarding

#### "3 deposits need a label" banner during plan-building ⚠️ (P3)

**Screenshot:** 10:16 PM — banner above the May card while "Building your plan · Sorting income & bills" loader shows in bottom right.

**Banner copy:** *"3 deposits need a label / Teach Able which inflows are income, transfers, or refunds. Each label trains future syncs."* with a "Review" CTA.

**Paul's question:** "the spacing on deposits need a label. This was an old addition - not sure if it still applies." Two reads:
1. The banner spacing/visual treatment needs polish
2. He's not sure the deposit-labeling banner is still load-bearing now that classification is in place (worth verifying it does something useful, or remove)

**Action:** confirm what the "Review" CTA does and whether the labeling actually trains anything, or if it's vestigial from a pre-AI-classification era.

**Plan section:** §2 Onboarding (post-Plaid analyze step)

#### Score card covered by tour card ❌ (P1)

**Screenshot:** 10:17 PM — Tour step 2 of 12 *"Five habits, one score"* card sits visually in front of the May Habits / Score card, partially obscuring the demo data line and the score number.

**Problem:** the tour is *pointing at* the very element it's hiding. The tour bubble should anchor *adjacent* to the target, not on top of it. Likely a positioning bug — the bubble's anchor calc isn't accounting for the right-column score card.

**Plan section:** §2 Onboarding (tour mode) + §8 Score

#### Debt tab interest banner — provenance unclear ❓ (P2)

**Screenshot:** 10:17 PM — Debt sub-tab during tour step 7 of 12 ("Pay down debt"). Big red banner: *"INTEREST PAID · LAST 30 DAYS / $349.57 / That's $4,194.84 a year if nothing changes."*

**Problem:** brand-new account, just connected Plaid. Is $349.57 (a) Plaid-derived from real transaction history, or (b) a demo placeholder? Paul couldn't tell. If real, great — but the screen needs to say so ("from your last 30 days of transactions"). If demo, needs to say *that*.

**Action:** add a small source-indicator under the banner: "Calculated from your transactions" or "Demo data — replaced by your transactions once they sync."

**Plan section:** §8 Score / story (debt sub-tab)

#### Score page green outline overlapping nav 💡 (P2)

**Screenshots:** 10:18 PM (both shots) — Score page rendered with a faint **green box outline that surrounds the entire page content and bleeds upward into the top nav bar**.

**Problem:** outline isn't intentional design — looks like a stray border (probably a tour-mode highlight ring that wasn't unmounted, or a `:focus` ring on the page container). It overlaps the top navigation visually, which makes the page feel broken.

**Action:** identify which element has the green outline and remove. Likely a leftover tour highlight or an `outline:` style applied to the wrong element.

**Plan section:** §8 Score / story

#### "Start with one small step" welcome card — likely vestigial ❓ (P2)

**Screenshot:** 10:20 PM — home page *after* the tour ends. Big "Welcome to Able / Start with one small step / Log any real income below, or add your bills so Able knows what to cover. Thirty seconds either way." card at top with [Log first income] [Add first bill] buttons.

**Problem:** Paul doesn't remember keeping this. With Plaid pre-populating bills + income, this welcome card and its dual-CTA may be redundant — the user just finished onboarding *and* has a "review your detected bills" path. Worth confirming whether this is still the right home-state or if it's an older zero-state that should be removed when Plaid has done its analysis.

**Action:** grep for the welcome card; decide whether to (a) remove it when Plaid found data, (b) replace with a Plaid-aware version ("Review the 15 bills and 4 debts I found"), or (c) keep as-is if it tested well.

**Plan section:** §2 Onboarding (post-tour home state)

#### Credit-card payments classified as income ❌ (P1)

**Screenshot:** 10:21 PM — *"Review your income"* modal with four +$700, +$250, +$266, +$236 entries all labeled *"Payment Thank You-Mobile"* / *"Payment Thank You - Web"* / *"Payment - Web"*. Currently labeled "Mobile payment received" / "Web payment received" with 55-60% confidence.

**Problem:** "Payment Thank You" is what credit-card statements show when you *pay* the credit card. So these are inflows on the credit card account that are *the other side* of outflows from the user's checking. They should be classified as `transfer` (intra-user account movement), not `income`.

**Why the classifier is wrong:** the credit card is in `plaid_items`/`plaid_accounts` as a `credit` type. The "Payment Thank You" inflow on that account, with a generic merchant pattern, hits rule 4b's "bare Venmo/Cash App" tier and defaults to income with low confidence. The classifier doesn't know about the *paired* outflow on checking that would identify it as a self-transfer.

**Fix paths:**
1. **Cross-account pairing:** at sync time, look for matching outflow on a checking/savings account ±1 day with the same amount. If found, mark both as `transfer`.
2. **Account-type rule in prompt:** if the inflow is on a `credit` account AND the merchant_name pattern is generic (PAYMENT, AUTOPAY, ACH, "Payment Thank You"), classify as `transfer` not `income`.

Path 1 is more robust but requires new logic. Path 2 is a one-paragraph prompt edit. Probably ship 2 first, 1 later.

**Plan section:** §3 Plaid analysis wait (categorization quality)

#### "I spotted 4 debts" — doesn't list the 4 ❌ (P1)

**Screenshot:** 10:23 PM — Step 7 of 7. Heading: *"I spotted 4 debts in your transactions. Any other debts I should know about?"* with a row of empty add-debt inputs and "+ Add another" / "Continue" / "No, none of those" buttons.

**Problem:** the page asks the user to add *more* debts the system missed — but doesn't tell them what the 4 already-detected debts are. They have no way to know if they need to add anything (or if the 4 are even the right 4). They have to click Continue blindly.

**Fix:** above the "Any other debts I should know about?" prompt, list the 4 that were detected. Same row format as the Plan summary's debt section: name + min payment. Maybe with an inline edit for each.

**Plan section:** §2 Onboarding (debt review)

#### Plan summary review — text-dense + cheap inline number chips ⚠️ (P2)

**Screenshot:** 10:24 PM — Step 7 of 7 *"Here's what I set up for you"*. Long paragraph: *"Paul, I looked at 6 months of transactions and saw income swinging from `$1,525` in December to `$8,999` in April across Stripe, Airbnb, Venmo, and Eventbrite payouts - that is a variability score of `9 out of 10`..."*

**Problem 1 — wall of text:** three dense paragraphs of prose, each with embedded numeric callouts. Reads like an essay, not a summary. Hard to scan.

**Problem 2 — inline number "boxes":** each highlighted figure (`$1,525`, `$8,999`, `9 out of 10`, `$3,247`, `22%`, etc.) sits in a faint near-white rounded rectangle. The rect color and border treatment look like a default browser input style, not a branded data chip. Reads as "cheap" / "tech-y" rather than thoughtful.

**Fix paths:**
1. Restructure into shorter sections with sub-headlines (Income variability / Floor / Debt) rather than one big block.
2. Replace the input-looking number chips with a stronger branded treatment — bold text in green, or a subtle pill like the persona chips, or strong typography weight contrast and no box at all.

**Plan section:** §2 Onboarding (plan summary review)

#### Plan summary — bills + debts + taxes section: bills good, one Chase CC missed ⚠️ (P1)

**Screenshot:** 10:27 PM — same plan summary page, scrolled down. Three sections each with [Accept] [Edit] [Skip]:

- **15 monthly bills** — Planet Home mortgage $2,601 day 15, USAA insurance $187 day 3, Verizon $86 day 20, Idaho Power $80 day 16, Sparklight internet $78 day 9, Intermountain Gas $44 day 9, Northwestern Mutual $49 day 2, SmartCredit $30 day 27, Villa Sport gym $24 day 1, Claude $100 day 29, Bank service fee $15 day 30, Apple subscriptions $10 day 17, Spotify $12 day 20, Netflix $8 day 22, Google One $2 day 27.
- **4 debts** — Toyota auto loan $537/mo min, Credit card interest charge (card 1) $177/mo min, Credit card interest charge (card 2) $178/mo min, Chase credit card payment $268/mo min.
- **Off-the-top taxes** — Reserve from every deposit 12%.

**What worked:**
- Bill list is accurate ("Bills look pretty good")
- Cadences and amounts seem right
- Mortgage, utilities, insurance, subscriptions all correctly categorized as bills
- Toyota auto loan correctly identified as debt (not bill)

**What's wrong:**
- "Bank service fee $15 day 30" probably shouldn't be a bill — it's a fee, not a recurring obligation the user controls. Should it surface as a leak instead?
- Two "Credit card interest charge" entries listed as separate $177 and $178 debts — these are *interest charges*, not minimum payments. The actual debt is the credit card *balance* at issuer X with that interest rate. The classifier is treating an interest line item as a stand-alone debt.
- **One Chase credit card was missed entirely** per Paul's note. So the 4-debt count is incomplete.
- The "Reserve from every deposit 12%" tax rate — where did 12% come from? Hardcoded default? Plaid-derived? Needs source label so user trusts it.

**Plan section:** §3 Plaid analysis wait (debt detection coverage), §2 Onboarding (plan summary)

#### Review-plan timeout = data loss ❌❌❌ (P0 ship-blocker)

**Screenshots:** 10:29 PM (home, post-timeout) → 10:30 PM (Bills sub-tab empty) → 10:33 PM (Debt sub-tab empty).

**Sequence Paul lived through:**
1. He landed on the *plan summary review* page (10:24 / 10:27 PM screenshots) — 15 bills, 4 debts, 12% tax rate all auto-detected from Plaid.
2. He spent a few minutes auditing what was there (reading every bill, checking debts, deciding what to accept/edit/skip).
3. The page **timed out and bounced him to home** without persisting any of it.
4. Result: zero bills in the Bills tab. Zero debts in the Debt tab. The "Welcome to Able / Start with one small step" zero-state shows. The 12% tax rate is gone too.

**This is a P0 ship-blocker** for the new-user journey. The plan summary is *the* moment we earn trust by showing how much we did automatically — and we punish careful users by trashing all of it if they read too long. Paul's earlier "Debts didn't auto populate with Toyota loan or credit cards" finding is actually *this same bug*: the debts WERE detected (4 of them visible on the review page) but never made it into the user's data because of the timeout.

**The fix is conceptual, not just a bigger timeout:**
1. **Persist the auto-detected bills/debts/tax-rate to the user's data immediately** (when the review page loads), with a status flag like `pending_review`.
2. The Accept/Edit/Skip buttons just confirm or modify — they don't *create*.
3. Even if the user closes the tab without clicking anything, the data is there. They can audit later.
4. Remove the timeout entirely. Or move the review to a Bills-tab banner (like the detected-bills banner I just shipped), so the user can engage with it on their own time.

**Plan section:** §2 Onboarding (plan summary review) + §3 Plaid analysis wait

#### Goals + payment types corrupting income sources ❌ (P0)

**Screenshot:** 10:30 PM — Plan tab → More → Income Sources panel:

```
× Client / Job 1
× Client / Job 2
× Side income
× Other
× Dig out of debt without losing my mind     ← onboarding GOAL leaked in
× Smooth out slow months without panic         ← onboarding GOAL leaked in
× Direct deposit                                ← payment-type leaked in
× Stripe                                        ← payment-type leaked in
× Venmo                                         ← payment-type leaked in
× Zelle                                         ← payment-type leaked in
× Marketplace (Airbnb, Etsy, etc.)              ← payment-type leaked in
```

**Problem:** the onboarding's persona-multiselect answers (the goals from screenshot 10:11 PM) and what looks like a separate payment-types question are both being written into the `income_sources` array. Income sources should be specific named sources (clients, employers), not goals or payment processors.

**Why it matters:** any income inbox / "review your income" / Coach context that reads from `income_sources` will be polluted. The Coach might say things like "Your income source 'Dig out of debt without losing my mind' deposited $700" — nonsensical.

**Root cause to investigate:** find the onboarding step save logic. The persona screen and the payment-types step are writing to the wrong field. They probably need their own slots: `S.profile.goals[]` and `S.profile.income_channels[]`, separate from `S.income_sources[]`.

**Plan section:** §2 Onboarding (data hygiene)

#### "Mark as leak" affordance — confusing + no dismiss path ⚠️ (P2)

**Screenshot:** 10:32 PM — Activity tab → recurring scan list. Each row has a "Mark as leak" button on the right. Rows include Planet Home (mortgage, $2,651), Toyota ($537), PURCHASE INTEREST CHARGE ×2, POS DEBIT USAA INSURANCE PAYMENT ($164), Verizon, Idaho Power, Sparklight, Intermountain Gas, Northwestern Mutual, Smartcredit, OpenAI.

**Two problems:**
1. **Jargon problem.** "Leak" is a Coach-internal term — a recurring charge the user wants to cut. New user without Coach context has no idea what it means. Every row offers them a binary action they don't understand.
2. **Missing dismiss path.** If a row is a *normal bill* (which most of these are — mortgage, utilities, etc.), there's no way to tell Able "yes this is fine, stop showing it to me." It's either Mark as leak or live with the row sitting there forever.

**Fix paths:**
1. Replace the lone "Mark as leak" button with two options per row: "Yes, it's a leak" and "Normal bill — dismiss". The dismiss action adds the stream to a `dismissed_recurring` list (parallel to `not_bills_streams` from earlier today).
2. Add a help-tip on first encounter explaining what a leak means in Able's vocabulary.
3. Filter out streams that are already in `S.bills` from this list — this list shouldn't show every recurring outflow forever, just the ones the user hasn't dispositioned.

**Plan section:** §3 Plaid analysis wait (recurring scan UX)

#### Pace sparkline shows a number with no data 💡 (P3)

**Screenshot:** Image #25 — pace sparkline component populated even though there's no transaction data yet to back it.

**Paul's note:** "might not really matter."

**Action:** confirm the pace value when no spending history exists — it should either suppress the sparkline or show a caption like "no data yet." Low priority; flagged for later cleanup.

**Plan section:** §8 Score / story (or wherever the pace sparkline lives — Plan?)

#### Mobile — bottom spacing isn't great on Bills tab ⚠️ (P2)

**Screenshot:** Image #26 — **Bills tab on mobile**. Tight/awkward vertical rhythm at the bottom (likely behind the bottom nav, or insufficient safe-area inset).

**Action:** check `padding-bottom` / `safe-area-inset-bottom` on the Bills page scroll container (`#page-bills`). Verify in iPhone width DevTools that the last bill row + funded bar isn't tucked under the bottom nav.

**Plan section:** §6 Bills functionality (mobile)

#### Forecast page — cheap-looking layout, massive circles + date/edit/x ⚠️ (P2)

**Screenshot:** Image #27 — **Forecast / Plan tab page**. Oversized circular icons/elements and a date + edit + x action row that don't read as designed.

**Paul's verbatim:** "this layout isnt clean or nice looking. looks cheap. these circles are masssive looks cheap again. also layout of date, edit and x. could be improved."

**Action:** in `renderForecast` / forecast-card render path: scale the circle icons down (target 22-28px max, not whatever oversized value they're at), tighten the date+edit+x affordances into a single right-aligned action cluster with proper hit targets, apply consistent shape vocabulary (ties into P3 #22 — pill vs square decision still pending).

**Plan section:** §9 Plan tab (forecast surface)

#### Empty Debt tab still shows $349.57 interest banner ⚠️ (P2)

**Screenshot:** 10:33 PM — Plan → Debt sub-tab. Shows the same red *"INTEREST PAID · LAST 30 DAYS / $349.57"* banner as the tour, but the debts list is empty (zero debts due to the timeout-loss bug above).

**Problem:** the interest banner says $349.57 was paid, but the user has *no debts in the system* to attribute it to. Either:
- The interest banner queries Plaid transactions directly (independent of `S.debts`), so it shows real numbers even when debts are unloaded — confusing because there's no debt list backing it.
- Or it's pulling from somewhere stale and shouldn't show when debts are empty.

**Action:** when `S.debts` is empty, suppress the interest banner *or* add a caption that says "from your transaction history — add your debts below to track payoff." Without that bridge, the banner just looks broken.

**Plan section:** §3 Plaid analysis wait (debt tab empty state)


---

## Issues to fix

Promoted from findings, prioritized.

### P0 — ship-blockers
1. **Review-plan timeout = total data loss.** The 15 auto-detected bills, 4 debts, and 12% tax rate all evaporate if the user audits for >N minutes. Persist on page-load with `pending_review` flag; Accept/Edit/Skip just confirm. Remove timeout entirely, or move to a Bills-tab banner.
2. **Goals + payment-types corrupting `income_sources[]`.** Persona multiselect answers and payment-type answers are being written to the wrong field. Income sources must be specific named clients/employers — not goals or processors. Separate slots needed.
3. **Signup → 90s app load with bare "Confirming subscription" pill.** `getSession` timing out + escape hatch / nuclear loader sequence. Investigate session pickup logic (localStorage path should be fast, not fallback). Visual treatment of the wait screen also needs work.

### P1 — real bugs, fix soon
4. **Credit-card payments classified as income.** "Payment Thank You" inflows on credit accounts default to income via rule 4b. Need either cross-account pairing logic or an account-type rule in the classifier prompt.
5. **One Chase credit card missed in debt detection.** The 4-debt count is incomplete. `plaid-analyze` coverage gap. (Also: the two "Credit card interest charge" entries are interest line items, not separate debts — fix categorization there too.)
6. **Score card covered by tour card** during tour step 2 of 12. Tour bubble's anchor calc isn't accounting for the right-column score card.
7. **"I spotted 4 debts" page doesn't list the 4** — user can't audit. Show the detected debts inline above the "any others?" prompt.
8. **Score page green outline overlapping nav.** Likely a leftover tour highlight ring or a misplaced `outline:` style. Remove.

### P2 — polish + clarity
9. **Persona unselected chips look like plain text** — no border/ghost-pill state. Add an unselected affordance.
10. **Persona chip green doesn't match brand palette.**
11. **Plan summary review screen** — wall of text + cheap input-style number chips. Restructure into shorter sections; replace number chips with branded treatment.
12. **"Start with one small step" welcome card** — likely vestigial when Plaid found data. Replace with Plaid-aware copy or remove.
13. **Debt tab interest banner provenance unclear** — add "from your transactions" source label.
14. **Empty-debts state still shows interest banner** — suppress when `S.debts` is empty, or add bridging caption.
15. **"Mark as leak" affordance** — add jargon explainer + a "Normal bill — dismiss" option that hides the row.
16. **"3 deposits need a label" banner** — confirm load-bearing or remove (vestigial pre-AI-classification).
17. **"Connect bank" step visual pass** — circle radios feel off vs. earlier pill chips; back/skip hierarchy inconsistent.
18. **"Bank service fee $15" surfaced as a bill** — probably should be a leak candidate or dismissed entirely.
19. **12% tax rate provenance** — add source label so user trusts the number.
20. **Mobile bottom spacing on Bills tab** — `#page-bills` cramped on iPhone width; add safe-area inset / extra padding above the bottom nav.
21. **Forecast page cheap-looking layout** — massive circle icons + awkward date/edit/x row in forecast cards. Scale circles down (22-28px), tighten action cluster, ties into shape vocabulary (#22).

### P3 — system-level questions to decide
22. **Shape vocabulary** (pill vs rectangle vs rounded): Paul wants a consistent shape decision applied across components. Design-system pass needed.
23. **Pace sparkline shows a number with no data** — suppress or caption when no transaction history. Paul: "might not really matter."

---

## Logged ideas

(Empty — promoted from findings as we go.)

---

## Plan checkpoints

(Mirror of the test plan's section list. Checked off as findings cover each area.)

- □ Pre-flight
- 🟡 1. Account delete + clean signup — partial; 90s load + escape hatch + nuclear loader fires
- 🟡 2. Onboarding — heavy coverage; persona screen, plan-building, review-plan **timeout = data loss (P0)**, goals→income corruption, "small step" copy, debt review missing list
- 🟡 3. Plaid analysis wait — partial; categorization (CC payment→income), debt detection (Chase CC missed), recurring scan UX
- □ 4. Home hero (Balance label + bank dropdown) — not yet covered (no balance set)
- 🟡 5. Bills tab — partial; "Bills look pretty good" on review page (but never persisted due to timeout)
- □ 6. Bills functionality (regressions)
- □ 7. Coach
- 🟡 8. Score / story — partial; tour overlay covers card, green outline bleeds into nav, interest banner provenance unclear
- 🟡 9. Plan tab — partial; debt tab empty state shows interest banner with no data
- □ 10. Push notifications
- □ 11. Settings
- □ 12. Email cron behavior
- □ 13. Tax features
- □ 14. Multi-bank
- □ 15. Demo mode
