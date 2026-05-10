---
name: able-app-capabilities
description: Use this skill when writing or fact-checking ANY content that describes what Able actually does. Blog articles, ad copy, email, social posts, video scripts, in-app microcopy, landing copy, comparison pages. This is the canonical ground-truth reference for Able's shipped feature set, exact bucket names, surplus split mechanics, Coach behavior, trial flow, pricing, Plaid surfaces, and onboarding flow. Trigger any time content makes a claim about Able's product (mechanics, vocabulary, automation, integrations). Also trigger when reviewing existing content for false or aspirational claims.
---

# able-app-capabilities

The single source of truth for what Able the product actually does today. Sourced from a direct audit of `app.html` and the deployed Supabase Edge Functions on **2026-05-07**.

**The rule:** if a piece of marketing or content makes a claim that this skill does not confirm, the claim is wrong until the app changes or this skill is updated. Marketing follows code, not the other way around. If the marketing language is too good to give up, ship the product change first, then update this skill, then write the content.

## The mental model in one paragraph

Able is a **per-deposit allocation engine for people with inconsistent income**, with **Plaid-driven detection of bills/debts/income** at onboarding and **manual control over working balance + per-deposit logging**. Connect a bank during onboarding (or skip and add it later); Able pulls 12 months of transactions, classifies them, detects recurring bills, builds a Floor-First plan you review and accept. After that, every deposit you log gets allocated in a fixed order: bills first (reserved against actual upcoming bills in a configurable window), then four percentage-based surplus buckets (pay yourself, debt, reserve, free spending). The Coach is a chat with full state context. Plaid keeps detecting new bills/debts in the background and surfaces them for review.

## Vocabulary lock — read this first

The user-facing brand term is **reserve**. The internal code variable is `bufPct`. The database column is `reserve_pct`. Content uses "reserve" everywhere. The word "buffer" appears only in legacy app strings (rename pending) and developer-facing context.

| Brand-facing (use in content) | Code-internal (don't use in content) |
|---|---|
| Reserve | `bufPct`, "buffer" |
| Floor (= bills + tax) | n/a — methodology term |
| Pay yourself | `ownerPct` |
| Extra debt payoff | `debtPct` |
| Yours to spend freely | `freePct` |
| Connected bank | "Plaid item" |

The word "smoothing" / "smoothing reserve" does **not** appear in content. Methodology rule 3 is "Build your reserve before you spend." The mechanic IS the reserve.

## The surplus split: exact buckets, exact order

The buckets are NOT taxes/bills/smoothing/debt/free. The actual order is:

1. **Off-the-top: tax allocation** (`tax_pct` from the analyzer plan, configurable in Settings). Comes off every deposit BEFORE the surplus split. Recommended pct sourced from your historical estimated-tax payments, capped at 35%.
2. **Bills.** Reserved against specific upcoming bills in the planning window (7/14/21/30 days, user-configurable). Per-bill reservations under `S._reservations: { [billId]: amount }`.
3. **Pay yourself** (`ownerPct`). Owner draw, percentage of remaining surplus.
4. **Extra debt payoff** (`debtPct`). Above-minimum debt payments.
5. **Reserve** (`bufPct` in code). The cushion that covers slow months.
6. **Yours to spend freely** (`freePct`).
7. **Residual.** Anything unallocated rolls to debt.

Defaults at `app.html:2846`: `debtPct: 20, bufPct: 15, freePct: 5, ownerPct: 0`. The four percentages must be multiples of 5 and sum to ≤ 100. The analyzer enforces this; the Settings sliders enforce this.

## The reserve: what it is and is NOT

The reserve is a percentage-based accumulation bucket. Money flows in via the surplus split. It sits.

**The reserve does NOT:**
- Automatically release money to cover bills in slow months
- Have any cash-flow logic at all beyond accumulation
- Get described as a "smoothing reserve" anywhere

**What the user does:** when a slow month hits, they manually transfer from reserve to operating to cover bills. The Coach can advise them to. The app does not do it for them.

**Marketing implication:** any content that says "the reserve fires automatically" or "Able auto-routes from reserve to bills" is **false**. Acceptable framings:

- "The reserve is where you build the cushion that covers slow months." (true, neutral)
- "Set a reserve percentage. It accumulates on every deposit." (true, mechanical)
- "When a slow month hits, you pull from the reserve. The Coach reminds you." (true)
- ❌ "The reserve fires when bills go uncovered." (false)
- ❌ "Able auto-routes from your reserve to your bills when you have a slow month." (false)

## Taxes are off-the-top, NOT in the surplus split

The four surplus percentages are pay-yourself, debt, reserve, free. **Taxes is not one of them.**

Tax is a separate first-pass: a single `tax_pct` (0-35) that comes off every deposit before bills, debts, or any surplus split. The analyzer recommends a number based on your historical estimated-tax payments visible in Plaid history; you can override it.

**Marketing implication:** content that lists "taxes" inside the surplus split is wrong. Acceptable framings:

- "Tax set-aside comes off the top before anything else gets allocated." (true)
- "Taxes are a fixed allocation. The remaining surplus splits across pay-yourself, debt, reserve, and free spending." (true)
- ❌ "Able splits every deposit across taxes, bills, smoothing, debt, and free spending." (wrong order, wrong vocab)

## Plaid — fully shipped (onboarding spine)

Plaid is the primary detection engine for bills, debts, income, and APR. It runs in production (not sandbox).

**Plaid Link entry points:**
- **Onboarding step 7** (final step) — `app.html:3876-3881`
- **Settings → Connected accounts → "Connect a bank"** — `app.html:9754`. Multi-bank: "Connect another bank" appears once one is connected.
- **Update mode** when an item expires — triggered by `status === 'error' / 'pending_expiration' / 'pending_disconnect'`. UI: "Reconnect" button calls `settingsRunUpdateMode()`.

**Edge Functions in the Plaid pipeline (in run order on a fresh connect):**

1. `plaid-link-token` — issues a Link token for the browser
2. `plaid-exchange-public-token` — swaps Link's public_token for a server-side access_token
3. `plaid-sync` — pulls 12 months of transactions via `/transactions/sync`, also writes `plaid_accounts`
4. `plaid-classify-pending` (loops `plaid-classify-batch` with internal parallelism) — LLM-classifies each txn (bill / debt_payment / income / transfer / refund / etc.) and writes `able_category`, `able_label`, `able_confidence`
5. `plaid-detect-recurring` — local recurring detector (per-cadence floor + amount-trust escape + true median); writes `plaid_recurring_streams`
6. `plaid-detect-credit-debts` — pulls `/liabilities/get` and writes one row per credit card / line of credit to `plaid_credit_debts` (true purchase APR + min_payment + statement balance when liabilities is supported)
7. `plaid-analyze` — Claude Sonnet 4.6 builds a Floor-First plan from streams + classified txns + pre-built credit debts. **Temperature 0** (since 2026-05-07) for determinism. Plan goes into `analyzer_plans` for user review.
8. After user accepts the plan: `analyzer-apply-plan` — writes bills, debts, income sources, tax pct, and surplus split into `user_data`, with `pending_review:true` flags so user can confirm/edit each row.
9. `plaid-deep-dive` — fires-and-forgets after the plan applies. Drains the classify queue, finds **additional** bills/debts/sources visible in 12 months that the initial plan missed, plus flags dormant bills (stream stale or tombstoned). Writes new items with `review_reason: 'new'` or `'dormant'` + `pending_review:true`.

**Background pipeline (after onboarding):**
- `plaid-webhook` (Plaid → Supabase) drives `plaid-sync` on `SYNC_UPDATES_AVAILABLE`
- `plaid-recurring-refresh` re-runs detection on schedule
- `plaid-sync-sweep` scheduled re-sync for stale items

**Multi-bank:** fully supported. No cap. Free for all tiers.

## Bills

- **Sources:**
  1. **Plaid auto-detection** via `plaid-detect-recurring` + analyzer (primary)
  2. **Manual entry** via "Add a bill" modal (still available; columns: name, amount, due date, frequency)
  3. **Deep-dive add-ons** (24-72h post-onboarding): more bills found in 12 months of history
- **Frequencies:** monthly (default), weekly, biweekly, custom (every N days)
- **Mark paid:** manual checkbox per bill (no auto-mark-paid yet — B4 in the bench)
- **Per-bill reservations:** Yes. `_billReserved(billId)` tracks per-bill set-aside amounts. Reservations key off stable bill IDs.
- **Smart window:** `billsInWindow(days)`. Paid monthly bills with a fresh next occurrence in the window are shown as virtual unpaid entries so the next deposit reserves for them. Paid weekly/biweekly bills release reservations on a separate cadence.
- **Auto rollover:** monthly. `autoRolloverIfNewMonth()` clears paid flags when the calendar month changes, but **preserves reservations** so set-aside money rolls forward.
- **REVIEW chip:** Plaid-detected bills land with `pending_review:true` and show a "REVIEW" badge until the user confirms or edits. Deep-dive additions show the same badge.

**What is NOT shipped:** auto-mark-paid (Plaid txn → check the box). Tracked as bench B4.

## Debts

- **Credit cards & lines of credit:**
  - Detected by `plaid-detect-credit-debts` from Plaid's `/liabilities/get`
  - **True purchase APR** when the institution supports liabilities (e.g., Chase, Amex)
  - **min_payment** sourced from Plaid; falls back to autopay-stream match; falls back to formula (1% of statement balance + monthly interest at purchase APR, $25 floor) when both missing — refined 2026-05-07
  - One row per card per item; multi-card detection works (collapsed-into-one bug fixed in PR #9)
- **Auto loans, student loans, personal loans:**
  - Detected from outflow streams classified as LOAN_PAYMENTS_*, plus deterministic name-match against a known-issuer list (Toyota Financial, Honda Financial, Ford Credit, Nelnet, Navient, MOHELA, Sallie Mae, etc.) added 2026-05-07 to cut variance
- **Mortgages are bills, not debts.** Always.
- **Manual entry:** still available via "Add a debt" form
- **REVIEW chip:** auto-detected debts land with `pending_review:true`

**Settings → "Enable APR tracking":** for items connected before liabilities was a Plaid product on the account, this button runs `plaid-update-mode` with `add_product: ['liabilities']` and re-runs `plaid-detect-credit-debts`.

## Income / deposits

- **Working balance:** still **manual** — `S.settings.balance`. User types a starting number; bills paid + deposits logged adjust it. (Plaid balance does NOT drive the working balance yet. B6 is parked: blocked on Log-income semantics + Plaid lag UX.)
- **Manual log income:** still the primary action. Text input for amount and source. Calls `allocate()` to run the surplus split.
- **`totalIn()` (monthly income total):** sums `S.history` (manual entries). Plaid deposits are visible alongside but don't yet drive this number.
- **`dedupPlaidWithHistory()`:** matches Plaid inflows to manual `S.history` entries (±7 days, ±10% amount). When matched, updates the manual entry with the actual net deposited and clears Plaid's row so it doesn't re-show. Prevents double-counting in the deposit list.
- **Income sources list:** `S.sources`. Seeded from onboarding intake_channels + analyzer-detected income sources (rail-translated to work-derived names per Rule 7 of the analyzer prompt — e.g., "Stripe payouts" for a marketing consultant becomes "Marketing payments"). Editable in Settings.
- **Forecast:** users can enter expected income with a date.
- **Income inbox banner:** surfaces low-confidence inflows (`able_confidence < 0.7` or transfer-classified inflows < 0.85) so users can label them. Each label trains future syncs via `user_classification_overrides`.

**Marketing implication:** the per-deposit framing is real — every logged deposit gets reserved against bills and split. But "Plaid auto-imports your income totals" is **not** true today. Plaid detects, classifies, and surfaces; the user logs.

## AI Coach

- **Surface:** chat interface, daily cap enforced server-side via `coach-chat` Edge Function
- **Model:** Claude Sonnet 4.6 (since 2026-05-04 — "right model + caching" per Anthropic-cost memory)
- **State the Coach can see (`buildCoachState()`):**
  - All bills, debts, settings, sources, obligations, profile
  - Dashboard headline numbers: balance, reserved_total, available_to_spend
  - Per-bill reservation map
  - Latest 10 deposits with full per-bill funding breakdown
  - Last 3 months of history
  - Forecast data
  - Past-due bills list
  - Recurring outflows + income channels
- **Proactive nudges:** 3 triggers
  1. Owner pay percentage = 0 but income has been logged
  2. Reserve low + bills due soon
  3. No income logged in 14+ days
- **Cooldowns:** 24h localStorage per nudge type; sessionStorage prevents same-session re-show
- **Backend:** rate-limited (429/503). System prompt teaches the model the field names from `buildCoachState`.

**Marketing implication:** the Coach is a real chat with rich state. Claims like "the Coach can see exactly what's reserved for which bill" or "the Coach knows your last 10 deposits" are TRUE. Claims like "the Coach makes transfers for you" are FALSE. It advises, the user acts.

## Onboarding

- **Trigger:** runs if user has no bills AND has not skipped (`profile.skipped !== true`)
- **7 questions** (`OB_QUESTIONS`, app.html:3804-3882):
  1. Welcome
  2. What brought you here (multi-select persona)
  3. Name + business
  4. Intake channels (which payment processors you use)
  5. Goals — crush debt / build safety / balanced
  6. Pay yourself % (default 10%)
  7. **Plaid Link** (final step; skippable)
- **After Plaid succeeds:** background pipeline (sync → classify → detect-recurring → detect-credit-debts → analyze) runs, then a personalization beat, then the **plan-review screen**
- **Plan-review screen:** shows detected bills, debts, income sources, tax allocation, surplus split, and Floor-First plan summary. User can edit any row or Apply. Apply writes everything to `user_data` with `pending_review:true` flags.
- **Skip:** yes (`skipOnboarding`). Falls back to manual-entry flow.
- **Lookback:** 12 months (silent default, picker removed 2026-05-06)

## Trial + subscription

- **Trial length:** 30 days. Verbatim: "30 days free. Card required, no charge until day 31. Cancel anytime."
- **Card requirement:** **CARD IS REQUIRED.**
- **`subscription_status` values:** `trialing`, `active`, `past_due`, `inactive`, `lifetime` (lifetime is grandfathered only — see Pricing)
- **Access gate:** `hasAccess = ['active', 'trialing', 'lifetime'].includes(status)`
- **Stripe checkout flow:** `startCheckout()` redirects to Stripe Checkout. Post-redirect, `verify-checkout-session` Edge Function (newly hardened 2026-05-07 against client wedges) confirms the session and updates `profiles.subscription_status` without waiting for the webhook.
- **In-app monthly→annual upgrade:** "Switch to annual · Save $50" button in Settings → Subscription. Calls `switch-plan` Edge Function which uses `stripe.subscriptions.update` against the saved card — **no Stripe Checkout redirect**. Trial-aware (during trial: `proration_behavior: 'none'`; active: prorated charge + fresh 12-month anchor). Shipped 2026-05-07.

**Marketing implication:** any content saying "no card required" is wrong. Standard trial framing: "30 days free. Card required, no charge until day 31."

## Pricing

- **Monthly:** $14.99/mo (`PRICE_MONTHLY = price_1TUT0rDBmPAhrdxktHAb3SzX`)
- **Annual:** $129/yr (`PRICE_ANNUAL = price_1TPyPZDBmPAhrdxkAwiyRC6U`)
- **Annual savings framing:** "Save $50" or "Two months free" (14.99 × 12 − 129 = $50.88)
- **Lifetime:** **retired** for new sign-ups (2026-05-07). Existing `lifetime` users grandfathered; webhook keeps a defensive `mode === 'payment'` branch for them.

## MFA

- **Type:** TOTP (Google Authenticator / Authy / 1Password compatible)
- **Enrollment:** Settings → Two-factor authentication. `mfa.enroll({ issuer: 'Able' })` is required (no issuer = no app name in authenticator app).
- **Required for:** Plaid Link enrollment (a Plaid security requirement; the bank diligence check that landed Able's production approval).
- **Recovery codes:** generated at enroll, downloadable text file.
- **Daily lock:** the post-Stripe wedge fix path (`window._wedgedJwt`) skips MFA gate gracefully when the auth client is wedged.

## Settings categories (user-visible)

1. **Surplus split** — debt, reserve, free, owner sliders + planning window (7/14/21/30 days)
2. **Connected accounts** — Plaid bank list, connect new, update mode, disconnect, "Enable APR tracking"
3. **Subscription plan** — current status, "Switch to annual" button, manage in Stripe portal
4. **Two-factor authentication** — TOTP enroll/disable
5. **Email reminders** — 5 toggles: bill_reminder, low_buffer, monthly_wrap, dormancy, weekly
6. **Web push notifications** — service worker enable/disable
7. **Demo mode** — toggle (loads fixture data, preserves real data; persistent banner indicates demo)
8. **Account** — email, replay tour, contact support, close month, clear data, sign out

No feature flags or A/B toggles surfaced to users.

## Home screen surfaces

- **Greeting** — time-of-day + weekday-month-day
- **Income inbox banner** — N inflows need a label
- **Past-due banner** — bills past due that haven't been marked paid
- **Plan-refresh banner** — Plaid recurring detection arrived after the plan was drafted; "Refresh plan" CTA
- **Deep-dive banner** (shipped 2026-05-07) — N items found in 12mo; Review CTA routes to bills/debts
- **Due-today card** — louder than chip, morning-of for unpaid bills due today
- **Hero grid** — money snapshot (balance / reserved_total / available_to_spend) + Floor coverage line + Score card
- **Quarterly tax projection card** — next estimated-tax deadline + projected amount (hidden when no tax % configured)
- **Achievement tiles** — referrals + habit + spending + debt + goals categories
- **History** — last N deposits with per-bill funding breakdown

## Notifications + emails

**Email triggers (`email-cron-daily` Edge Function, 16:00 UTC = 9a MST / 10a MDT):**
- Onboarding sequence
- Behavioral: dormancy, weekly, bill_due_tomorrow, low_buffer, monthly_wrap
- Cart-abandon: 24h / 3d / 7d
- achievement_unlocked
- deep_dive_summary (in-flight as of 2026-05-07, parallel session)

**FROM_EMAIL:** `Able <hello@becomeable.app>` (locked 2026-05-07)

**Web push:** service worker + VAPID + RFC 8291 encryption. `bill_due_tomorrow` push trigger fires from the daily cron.

**Resend webhook:** `resend-webhook` Edge Function flags bounce/complaint into `email_status` so the cron skips bad addresses.

## Edge Functions deployed (Verify JWT OFF on each — required for the gateway)

**Auth + subscription:**
- `create-checkout` — Stripe checkout session
- `verify-checkout-session` — direct Stripe verification, bypasses webhook race
- `create-portal-session` — Stripe customer portal
- `switch-plan` — in-app monthly→annual upgrade (no Checkout redirect)
- `stripe-webhook` — subscription lifecycle source of truth

**Plaid:**
- `plaid-link-token`, `plaid-exchange-public-token`, `plaid-sync`, `plaid-sync-sweep`, `plaid-webhook`
- `plaid-classify-pending`, `plaid-classify-batch`, `plaid-classify-override`, `plaid-recategorize`
- `plaid-detect-recurring`, `plaid-recurring-refresh`
- `plaid-detect-credit-debts`
- `plaid-analyze`, `plaid-deep-dive`
- `analyzer-apply-plan`, `match-detected-bills`
- `plaid-item-remove`

**Coach + comms:**
- `coach-chat` — Coach API
- `email-cron-daily` — daily transactional + behavioral emails
- `send-push` — web push delivery
- `send-referral-invite` — referral email
- `unsubscribe` — email unsub link handler
- `resend-webhook` — bounce/complaint flagging

## Things commonly assumed but NOT shipped (yet)

| Feature | Status |
|---------|--------|
| Plaid auto-mark-paid bills | NOT shipped (manual checkbox; bench B4) |
| Reserve auto-release into bills | NOT shipped (one-way accumulation) |
| Plaid as source of truth for working balance | NOT shipped (still manual; bench B6 — parked) |
| `totalIn()` summing Plaid txns instead of `S.history` | NOT shipped (still manual sum; bench B6) |
| The Coach moving money | NOT shipped (advisory only) |
| Live `/balance/get` calls | NOT shipped (cached only; bench B5) |
| Pay bills from app | NOT shipped (Pro-tier wedge with Method Financial; bench B1) |
| Household/partner shared workspace | NOT shipped (Q3 deferral) |
| App store launch | NOT shipped (parked) |
| "Smoothing reserve" as a named feature | NOT a named feature (called "reserve") |
| No-card trial | NOT — card is required |
| Lifetime tier | RETIRED for new sign-ups (grandfathered only) |

## Vocabulary cheat sheet

| Don't say | Say instead | Why |
|-----------|-------------|-----|
| "Smoothing reserve" / "buffer" (in content) | "Reserve" | Brand term locked 2026-04-28 |
| "Auto-routes from reserve to bills" | "You move from reserve to operating when bills get tight" | False automation |
| "Plaid does it all" | "Plaid detects your bills, debts, and APR. You confirm, log deposits, allocate per-deposit." | Mixing detection vs. execution |
| "Free trial, no card" | "30 days free. Card required, no charge until day 31" | Card is required |
| "Taxes, bills, smoothing, debt, free" | "Tax off the top. Bills first. Then pay-yourself, debt, reserve, free spending." | Wrong vocab + wrong order |
| "$9.99/mo" | "$14.99/mo or $129/yr" | Old price |
| "Lifetime access for $X" | (don't mention; retired) | Tier retired for new sign-ups |
| "Owner pay is automatic" | "Set the percentage. Every deposit honors it." | True. Just need precise framing. |
| "Connect your bank and walk away" | "Connect your bank. Able detects, you confirm, every deposit gets a job." | Plaid does detection, not execution |
| "Auto-categorizes your spending" | (don't claim) | Spending tracking isn't shipped — Plaid classifies for income/bill detection only |

## When to update this skill

Update this file whenever:

1. A bucket changes (name, default, order)
2. A new Plaid surface ships (live balance, auto-mark-paid, etc.)
3. The reserve gains automated cash-flow behavior (would close B6 partially)
4. Trial mechanics change (length, card requirement)
5. Pricing changes
6. New Coach capabilities ship
7. Settings categories change
8. `subscription_status` enum changes
9. A new Edge Function deploys or one is renamed
10. A bench item (B1-B9) ships and changes user-facing behavior

Always cite the `app.html` line number or Edge Function name for the change in the commit message so future audits can verify.

## When invoked: process

1. **Writing new content:** consult this skill before describing any product mechanic. If the claim isn't here, it isn't true. Find the right framing in the vocabulary cheat sheet.
2. **Reviewing existing content:** scan for the rows in the cheat sheet table, plus any claim about automation, integrations, pricing, the reserve, or the working-balance source. Flag mismatches.
3. **Disagreement with marketing language:** if marketing wants to say something the app doesn't do, that's a product roadmap conversation, not a content edit. Surface it as a recommendation, don't just write the content as if the feature exists.
