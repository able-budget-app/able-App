# Able Triage

**Single source of truth for active work.** New ideas go to `docs/ideas.md`, not here.

Last consolidated: 2026-05-03 from `pending_work.md`, `competitor-feature-audit.md` Part 4, `experiments/focus-group/SYNTHESIS.md`, `ROADMAP_DECISIONS.md`, and `tasks.md`.

---

## Now — this week (P0)

✅ **All P0 items shipped 2026-05-03 across two commits (`23a7991`, `59e6955`).** See Done section.

---

## Next — this month (P1)

✅ **All P1 items from 2026-05-03 shipped in commit `50826cc`.** See Done section.

**New from 2026-05-04 E2E test:**

- **P1-2026-05-04 #1 — Multi-card collapse in debt detection.** ✅ Shipped 2026-05-06 in PR #9 (`d02c3ca`). Built a deterministic preprocessor inside `plaid-analyze` (Option C — no new Edge Function, no new table). For each credit card / line of credit on the item: balance from `plaid_accounts.current_balance`, min_payment via mask-match to outflow streams (with 2.5% fallback + $25 floor), rate_estimate from 90-day INTEREST CHARGE sum annualized + clamped to [5%, 40%]. Output passed to LLM as `pre_built_credit_debts`; prompt updated to emit each entry verbatim. Verified on fresh signup: two Chase cards (0714 / 4766) now appear as separate debt entries with $6,797 / $8,785 balances and 19.82% / 15.58% rates instead of collapsing into one. Open question (current_balance freshness) answered by reading `plaid-sync/index.ts:261-264` — accounts are upserted inline on every `/transactions/sync` call.
- **P1-2026-05-04 #2 — Interest-charge line items still classified as bills.** ✅ Shipped 2026-05-06 in PR #9 (`d02c3ca`) as a side-effect. `stripInterestCharges()` filters `INTEREST CHARGE` / `FINANCE CHARGE` / `PURCHASE INTEREST CHARGE` from the txn pool before bills aggregation. Verified: bills count dropped from 16 to 8 on Paul's data; bills total now reconciles cleanly with coach summary ($3,156). Classifier-side fix not required; defensive filter in plaid-analyze handles it. No interest-charge entries leak into `bills[]`.
- **P1-2026-05-04 #3 — Classify is the slow step in onboarding (~7 min for 1247 transactions).** ✅ Already shipped (commit predates this triage entry being closed). `obRunPlaidPipeline` (app.html:4926-4934) calls `plaid-classify-pending` with `max_batches:10` and internal parallelism (4 concurrent batches inside the function). Comment-of-record: "Old loop did 10×50 sequential = 7min; new loop does up to 5×500 with internal parallelism = ~3-5min worst case." Decision 2026-05-06: keep 6-month classification pass (don't drop to 90 days) — the speed win isn't worth losing the second quarterly tax payment for tax % accuracy.
- **P1-2026-05-04 #4 — Income sources panel shows 9 entries when Plaid detected 5.** ✅ Shipped across two commits: `20a1a9d` (2026-05-04) added `replace_sources` flag on `analyzer-apply-plan` so onboarding auto-apply wipes defaults server-side, and PR #7 `904bfba` (2026-05-05) drops PLACEHOLDER_DEFAULTS (salary/freelance/side income/other) client-side at plan-review accept. Verified 2026-05-06 on Paul's fresh signup: `user_data.sources` returned only Plaid-detected names (Stripe payouts / Airbnb host payouts / Venmo deposits) with no generic defaults remaining.
- **P1-2026-05-05 #1 — Paid-ads tracking infrastructure (prerequisite for any spend).** Set up before any paid ad goes live so we can actually measure CPL/CAC. Three pieces:
  1. **Meta Pixel** on landing (`index.html`) + app shell. Page views auto. Custom events: `Lead` (paywall_viewed), `StartTrial` (trial_started → fire from `_onAuthStateChangeImpl` post-checkout success), `Subscribe` (subscription_activated).
  2. **Google Ads tag (gtag.js)** with conversion actions for the same three events, plus `Purchase` for one-time `lifetime` upgrades. Use the existing `Able.track` choke-point so we don't double-write.
  3. **Conversion API (server-side) via `stripe-webhook`** — POST to Meta CAPI + Google Ads Enhanced Conversions when `checkout.session.completed` / `subscription.created` lands. Browser-side pixels alone lose attribution to ad-blockers + iOS ATT; server-side recovers most of it. Hash email + use the `event_id` field so client+server events dedupe.

  Effort: M. Touches `index.html` (pixel snippets + tag), `app.html` (event firing in `_onAuthStateChangeImpl`), `stripe-webhook` (server-side conversions), Meta Events Manager + Google Ads dashboard (verify firing). Should be done before flipping the first ad live.

- **P1-2026-05-05 #2 — Schema drift between client and `plaid_recurring_streams` (silent 400).** ✅ Shipped 2026-05-05 in PR #2 (`3d514af`). Dropped `personal_finance_category_primary` from the client SELECT + AI match payload + `_streamCategoryToBill` and `_looksLikeBankFee` (refactored to derive primary from detailed via Plaid PFC convention). Edge Function only writes `_detailed`; primary was dead code in the client.

- **P1-2026-05-06 #1 — Plaid liabilities integration for true APR + min_payment.** Current credit-card APR estimator inside `buildCreditDebts` (90-day INTEREST CHARGE sum annualized) systematically undershoots when the balance is growing across the window — Paul's two Chase cards came back at 19.82% / 15.58% (actual 26.24% / 22.74%, off by ~7% on both). The math is wrong by design (uses `current_balance` as denominator instead of average daily balance, which we don't have). Plaid's `liabilities` product returns true APRs (purchase, balance transfer, cash advance), minimum payment, last statement balance, last payment date — that's the canonical source. Currently `products=['transactions']` only per `plaid_v1_decisions.md`. Lift: enable `liabilities` on Plaid items, add `/liabilities/get` call to a new Edge Function, persist APR + min_payment per card. **Scheduled: tomorrow's session (2026-05-07).** When this ships: rip out the APR estimator block in `buildCreditDebts` and source from liabilities instead. Min_payment also becomes deterministic (no more 2.5% fallback).

- **P1-2026-05-06 #2 — Add-bank-from-settings only syncs, doesn't classify or analyze.** `settingsHandlePostLink` (app.html:9777) calls `plaid-exchange-public-token` and `plaid-sync` only. No `plaid-classify-pending`, no `plaid-detect-recurring`, no `plaid-analyze`, no `analyzer-apply-plan`. Result: when a user adds a second bank, transactions land in `plaid_transactions` with `able_category: null`, no recurring streams detected, no debts/bills/sources surfaced. Reproduced 2026-05-06: Paul added a second account with a credit card; transactions imported but the card never appeared in the Debt tab.

  **Why this is bigger than just credit cards.** Multi-bank scenarios are varied: forgot a credit card, added a second checking, connected a 1099 deposit account that should change the tax %, added a business account with its own bills, started tracking a spouse's accounts. The detection layer is the easy part; the design question is *what to do with what you find* without blowing away tuning the user has already done since onboarding.

  **Locked design — Option C (deterministic-first delta with opt-in recalibration):**
  1. Detect new credit cards deterministically by calling `buildCreditDebts` against the new item's `plaid_accounts` (no LLM needed for cards).
  2. Run `plaid-classify-pending` + `plaid-detect-recurring` against the new item's transactions.
  3. Run a scoped analyzer pass on the new item only — produces proposed new bills + income sources, but does NOT touch tax_pct or surplus_split.
  4. Show a unified "We found this in [bank name]" review modal: proposed new debts (from step 1), bills, and income sources. User picks what to add. Existing rows untouched.
  5. Add a separate "Recalibrate tax % and surplus split with new data" button — opt-in. If pressed, runs full multi-item analyze (analyzer needs to be made multi-item-aware, deferred until users actually want this).

  **Connection to P1-2026-05-06 #1:** when liabilities ships tomorrow, this is also a natural moment to extract `buildCreditDebts` from inside `plaid-analyze` into its own Edge Function (`plaid-detect-credit-debts`) writing to a `plaid_credit_debts` table. That's the C → A refactor we deferred 2026-05-06; it pays off here because both the analyzer path (existing) and the add-bank-delta path (new) need credit-card detection. Avoids duplicating the logic in two places.

  **Effort: M-L.** New Edge Function for credit-card detection, refactor `settingsHandlePostLink` to chain classifier + detect-recurring + scoped-analyzer + review modal, new modal UI in app.html, plumbing for the opt-in recalibration button. **Scheduled: tomorrow's session alongside P1-2026-05-06 #1.**

- **P1-2026-05-06 #3 — Home hero card empty until user manually adds a balance.** Fresh-signup users with Plaid connected saw a blank "Add what's in your spending accounts" CTA on home, even though `loadBankBalances` populates `S._bankBalances` async. The bank-balance line was only rendered in the populated branch of `renderHeroMoney` (when `_hasBalance()` was true), so a user who hadn't yet entered a manual balance never saw their connected accounts. Shipped 2026-05-06 in PR #12: empty-state branch now renders bank balances + per-account breakdown + "Use $X as my balance" one-tap CTA, with manual entry preserved as a secondary option. **Bigger redesign deferred** — Paul flagged interest in making live bank balance the working balance (instead of manual S.balance) per the per-deposit "every dollar gets a job" model, but that reverses the 2026-05-03 Option B decision and has the manual-double-counting wrinkle when income hits Plaid post-log. Tracked as bench item B6.

- **P1-2026-05-06 #4 — Analyzer bills accuracy: ~30% miss rate on legitimate bills.** Audit 2026-05-06 against Paul's actual bills list:
  - **Detected correctly (5):** Sparklight, Toyota (debt path), Verizon, Mortgage (off $84), Spotify.
  - **Detected with errors (4):** Intermountain Gas off ~$10, Idaho Power off ~$17, City of Nampa frequency wrong (bimonthly $102 → detected monthly $178), Cloudflare frequency wrong (annual → detected monthly because two domain renewals fell ~30 days apart).
  - **Missing (11 legit + 2 too-new):** Villa Spor $19, Life Insurance $48.50, Car Insurance $170, Chase Monthly Fee $15, Northwestern Life ~$48, Claude $100, Apple Storage $9.99, Netflix $7.99, Google Storage $1.99, Disney+ $12.99, SMART CREDIT $30. (Acceptable misses: Netlify $24.99, Supabase $25 — too new this month to prove cadence.)

  **Diagnostic SQL pending** (`SELECT * FROM plaid_recurring_streams WHERE user_id = ... AND direction = 'outflow'`) — outcome determines fix path:
  - If missing bills appear in streams as MATURE/active → LLM is dropping them when constructing `bills[]`. Prompt fix in plaid-analyze rule 5.
  - If missing → `plaid-detect-recurring` isn't catching them. Likely the per-cadence MIN_OCCURRENCES floor for small-amount streams (<$50) is too aggressive on subscription-priced items; or merchant-name normalization is splitting them across months.
  - If TOMBSTONED → aged out, surface as inactive but keep in history.

  **Scheduled: tomorrow's session alongside the analyzer pass.** Bundle with liabilities, add-bank-delta, and income-source naming changes (P1-2026-05-06 #5 below) since they all touch `plaid-analyze`.

- **P1-2026-05-06 #5 — Income source names use rail, not work.** Current names ("Stripe payouts," "Venmo deposits," "Airbnb host payouts") describe the payment rail, not what the user actually does. Paul's case: marketing consulting + Airbnb rental should produce "Marketing payments" and "Airbnb rental income," not the rail-derived names. Fix: pass `profile.business` into the analyzer prompt explicitly and update rule 7 to: "Use `profile.business` to name income sources by the work, not the rail. When in doubt, profession beats rail name." Plus a plan-review "What client is this?" rename nudge for any rail-sounding source. **Scheduled: tomorrow's session, bundled with the rest of the analyzer overhaul.**

Caveat carried forward: the `refer_*_joined` achievement tiles still need a backend hook for "invite turned into a paid signup." Tracked as a small follow-up below.

---

## Later — this quarter (P2)

✅ **All P2 items shipped 2026-05-03.** See Done section.

---

## Polish — when it's the highest-value thing left (P3)

✅ **All P3 items shipped 2026-05-03 in commits `cd5c390` and `965786e`.** See Done section.

---

## Bench — no commit yet

Strategic, structural, or genuinely far-out. Move to Now/Next/Later only after a real product call.

| # | Item | Source | Notes |
|---|------|--------|-------|
| B1 | **Pro tier (future)**: business profiles + Method Financial integration (wallet/envelope system + pay bills from app) | Paul direction 2026-05-03 | Method as the wedge — turns Able from planner to executor. Validate Method API + pricing before designing. |
| B2 | App Store launch | Memory `app_store_launch_plan` | Parked at Paul's request — wants more comfort with app first. Plan at `docs/app-store-launch.md`. |
| B3 | Household / partner shared workspace | ROADMAP D4.1 | Decided: defer to Q3. |
| B4 | Auto-mark-paid on Plaid bill detection | ROADMAP D1.6 | Decided: defer Q3 (detection-error risk). |
| B5 | Live `/balance/get` calls | ROADMAP D1.8 | Decided: cached only until Business plan. |
| B6 | Live bank balance becomes the working balance (replaces manual S.settings.balance) | Paul direction 2026-05-06 | Reverses 2026-05-03 Option B decision (working balance stays manual). Solves the "$X to allocate" framing per the per-deposit mental model, but creates a manual-double-counting wrinkle when user logs income before Plaid sync sees it. Needs a clean answer to "what does Log income mean now" before building. |

---

## Open product calls Paul hasn't locked

These are decisions, not tasks. Each unlocks downstream work once decided.

| # | Decision | Context |
|---|---------|---------|
| C1 | `totalIn()` flips to Plaid-driven income totals (currently sums manual `S.history` only) | Once dedup is trusted. Affects dashboard "this month" number. |
| C2 | Coach proactive nudge when leak count grows | Subscription-scan UX shipped; leak-tagging in; Coach prompt knows about it. Open: should Coach ping unprompted? |
| C3 | "Within your income" habit row treatment (item 13 above) | Visible-but-auto-credited vs. hidden until tracking ships |

---

## Done since last consolidation (archived for reference, do not append)

- Home + score redesign shipped as commit `bdd9dc8` on 2026-05-03 (Floor strip in hero, combined Score+Pace+habits card, achievements grid, bills funded bar, Floor-First in onboarding)
- Floor popover positioning fix shipped as `e4c872f` on 2026-05-03
- Audit Part 4 items #1, #2, #3, #4, #5, #6, #10 shipped through 2026-05-02
- All ROADMAP_DECISIONS D1–D7 are locked
- **P0 batch shipped 2026-05-03 (`23a7991`, `59e6955`, `cabc2a1`, `6708672`):** paywall fine-print transparency, Floor popover dedup, Tax Export promoted (then made seasonal), plan-review gap-acknowledgement, bulk reclassify (now in-modal with Save changes), achievements compact view with closest-to-unlocking sort
- **P1 batch shipped 2026-05-03 (`50826cc`, `ae8e314`):** landing-page audience widening, "Within your income" honest label, tour-mode pace placeholder, glossary tooltips on Floor + habit rings, fresh-deposit "Sorting this..." badge, due-today home card, achievement state wired to existing lcCompleted + S.referrals_sent. Follow-ups: hero north-star copy restored, eyebrow space, bulk reclassify visibility (loose match + optimistic show + token-guarded resolution).
- **P3 batch shipped 2026-05-03 (`cd5c390`, `965786e`):** "Allocate" nav → "Home" with house icon, Coach three-dot typing animation, What-if promoted to position 2 in Plan sub-nav, achievement distance text standardized to "X to go", Coach panel scroll-to-top affordance, income channels promoted to top-level Coach state, marketing per-deposit framing in How-it-works section. P3 #30 + #31 verified as no-fix-needed.
- **Add Income popup fix (`fca8bbc`):** chip now opens a quick-capture modal instead of navigating, mirroring Add bill.
- **P2 #22 (`598de3d`):** Per-user timezone — saveUserData auto-detects via Intl, email-cron-daily computes day windows per-user instead of UTC.
- **P2 #23 (`7bf5a09`):** Resend bounce/complaint webhook + email_status flagging in cron.
- **P2 #16 + #17 (`6a99caa`):** "What brought you here?" multiselect in intake; loose merchant override matching in plaid-classify-batch.
- **P2 #21 (`c607e68`):** Recurring auto-retry — webhook → refresh → home banner.
- **P2 #15 (`45f92dd`):** Demo mode toggle in Settings + persistent banner.
- **P2 #24 (`f22d7ad`):** Quarterly tax projection card on home.
- **P2 #20 (`57461af`):** Multi-bank — copy + button-label updates to surface the support that already existed.
- **P2 #14 (`15131c4`):** Web push foundation — service worker, push_subscriptions table, send-push Edge Function with VAPID + RFC 8291 encryption, Settings opt-in card, bill_due_tomorrow trigger from cron.

---

## How to use this doc

- **Active work** lives here. New items move from `docs/ideas.md` into Now/Next/Later only after a triage decision.
- **Source columns** point back to the original doc in case you need context.
- **Effort: S** = hours, **M** = days, **L** = weeks.
- **Status** is implicit: items in this doc are open; when they ship, move them to Done and don't re-list.
- **The bench is for things we've decided we won't do yet, not for things we're avoiding.** Don't let Now/Next/Later items slide to Bench as a stalling tactic.
