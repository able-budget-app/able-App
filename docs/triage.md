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

- **P1-2026-05-06 #1 — Plaid liabilities integration for true APR + min_payment.** ✅ Shipped 2026-05-06 across PR #13 (`plaid-detect-credit-debts` Edge Function + `plaid_credit_debts` table + C→A refactor extracting `buildCreditDebts` out of `plaid-analyze`) and PR #20 (treat Chase's `minimum_payment_amount = 0` as missing, fall through to 2.5% rule). Verified on Paul's two Chase cards: APRs now 0.23 / 0.26 from `/liabilities/get` (vs. 19.82% / 15.58% from the old INTEREST-CHARGE estimator). Min_payment falls through to 2.5%-of-balance ($220 / $170) when Plaid returns 0/null — conservative; refinement tracked as B7.

- **P1-2026-05-06 #2 — Add-bank-from-settings only syncs, doesn't classify or analyze.** ✅ Partially shipped 2026-05-06 via PR #19 (add_product flow + Enable APR tracking button so existing items can gain liabilities without full re-link). The credit-card detection portion now runs through the same `plaid-detect-credit-debts` function as the onboarding path. **Still open:** the bigger Option-C delta UI (scoped analyzer pass + "We found this in [bank name]" review modal + opt-in recalibration button). Promote back to active when we want to handle multi-bank deltas for bills + income sources, not just cards.

- **P1-2026-05-06 #3 — Home hero card empty until user manually adds a balance.** Fresh-signup users with Plaid connected saw a blank "Add what's in your spending accounts" CTA on home, even though `loadBankBalances` populates `S._bankBalances` async. The bank-balance line was only rendered in the populated branch of `renderHeroMoney` (when `_hasBalance()` was true), so a user who hadn't yet entered a manual balance never saw their connected accounts. Shipped 2026-05-06 in PR #12: empty-state branch now renders bank balances + per-account breakdown + "Use $X as my balance" one-tap CTA, with manual entry preserved as a secondary option. **Bigger redesign deferred** — Paul flagged interest in making live bank balance the working balance (instead of manual S.balance) per the per-deposit "every dollar gets a job" model, but that reverses the 2026-05-03 Option B decision and has the manual-double-counting wrinkle when income hits Plaid post-log. Tracked as bench item B6.

- **P1-2026-05-06 #4 — Analyzer bills accuracy: ~30% miss rate on legitimate bills.** ✅ Shipped 2026-05-06 across PR #16 (rich debug mode in `plaid-detect-recurring` with `merchant_filter` param), PR #17 (triage close-out), and PR #18 (Netflix high-confidence 2-occurrence escape). Investigation revealed the original "30% miss rate" was a **false alarm** — 8 of the 11 listed missing bills were actually detecting. Double-counted entries + naming mismatches (e.g. SQL pattern `chase.*fee` missed "MONTHLY SERVICE FEE", `smart credit` missed "Smartcredit" with no space). True miss after debug pass was Netflix (2 occurrences in 90d window, just under the 3-occurrence floor) — fixed by the high-confidence escape: identical amounts + interval-center drift ≤ 2 days unlocks 2-occurrence detection.

- **P1-2026-05-06 #5 — Income source names use rail, not work.** ✅ Shipped 2026-05-06. Two-part fix: (1) app.html was passing the raw `name_business` intake answer ("Paul Johnson, marketing consultant and Airbnb host") as both `profile.name` AND `profile.business` — split so name gets the parsed first name, business gets the full raw string as natural language; (2) analyzer prompt rule 7 rewritten to translate rail merchants into work-derived names using profile.business as the anchor (Stripe payouts for a marketing consultant → "Marketing payments"). Multi-stream users now split by work, not rail. **Deferred:** the in-app plan-review "What client is this?" rename nudge — the prompt change covers the auto-naming side, the manual-rename UX is a P3-class polish that can wait.

Caveat carried forward: the `refer_*_joined` achievement tiles still need a backend hook for "invite turned into a paid signup." Tracked as a small follow-up below.

---

## Later — this quarter (P2)

- **Bump GitHub Actions runner deps before Node 20 sunset** | `.github/workflows/edge-functions-check.yml` uses `actions/checkout@v4` + `denoland/setup-deno@v1`, both Node-20-based. GitHub forces Node 24 on **2026-06-02** and removes Node 20 from runners on **2026-09-16**. Bump to `actions/checkout@v5` (Node 24) and check for a newer `setup-deno` major; verify CI stays green. Trivial change but has a hard external deadline. | Source: deprecation annotation on run `25498393122` (2026-05-07).
- **Landing page updates pass** | Walk through `index.html` together; specifics TBD. Placeholder so it doesn't fall through. | Source: Paul direction 2026-05-07.

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
| B6 | **Plaid-driven money in/out** (live bank balance becomes the working balance + `totalIn()` flips to Plaid txn totals) | Paul direction 2026-05-06 | Two surfaces of the same call (was split as B6 + C1, merged 2026-05-06): the **balance** number switches from manual `S.settings.balance` to the live bank balance; the **monthly income total** switches from summing manual `S.history` to summing Plaid deposits. Together they make Plaid the source of truth for money in/out. Reverses 2026-05-03 Option B (working balance stays manual). Solves the "$X to allocate" framing per the per-deposit model. Wrinkle: manual `Log income` would now race Plaid sync — needs a clean answer to "what does Log income mean now" before building. |
| B7 | Refine credit-card min_payment fallback when Plaid returns 0/null | PR #20 follow-up 2026-05-06 | Current 2.5%-of-balance rule is conservative — produces $220 on Paul's $8,785 Chase balance vs. real Chase minimum closer to $40-150 (1% of balance + interest + fees, with $25-40 floor). Errs safe (better than the $1 we were producing pre-PR #20) but worth tightening: try 1% + estimated monthly interest (`balance × purchase_apr/12`) with a $25 floor before falling to 2.5%. Verify against real-card statements. |
| B8 | **Mass email design redesign** | Paul direction 2026-05-06 | Current `email-cron-daily/index.ts` `layout()` is functional but flat — single template, label/value rows, no imagery beyond an underline asset, doesn't match marketing-site/app polish. When tackled: redesign as one pass across all email types (dormancy, weekly, bill-due, low-buffer, monthly wrap, cart-abandon, plus new ones from the deep-dive flow + post-onboarding plan summary). Decisions to make at design time: visual richness (minimalist vs. editorial), data viz (rows vs. sparklines/bars), voice (transactional vs. Coach), and component decomposition (`header` / `hero` / `stats` / `callout` / `cta` / `footer` partials). Park until other in-flight work is complete. |
| B9 | **Plan output variance between identical-data signups** | Paul observation 2026-05-06 evening | Same Plaid data, two signups produced different plans: one detected Toyota as a debt, the other as a plain bill; one had Spotify + Netflix, the other didn't; surplus splits differed; coach summary copy differed. Some variance is inherent to the LLM analyzer (Sonnet temperature + non-determinism on free-form selection). Worth tightening: (a) drop temperature on plaid-analyze, (b) add a deterministic "always-bill" pass for high-confidence streams (Spotify, Netflix, etc. — well-known subscription merchants) so they don't depend on LLM judgment, (c) make debt-vs-bill classification deterministic when the merchant is in a known-loan-issuer list (Toyota Financial → debt, regardless of LLM read). Worth doing before paid acquisition since "different plan from the same data" reads as random to the user. |

---

## Open product calls Paul hasn't locked

These are decisions, not tasks. Each unlocks downstream work once decided.

| # | Decision | Context |
|---|---------|---------|
| C1 | (merged into B6 on 2026-05-06 — "Plaid-driven money in/out" is one decision) | — |
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
- **P1-2026-05-06 #1 (PRs #13 + #20, 2026-05-06):** Plaid liabilities integration. New `plaid-detect-credit-debts` Edge Function + `plaid_credit_debts` table; C→A refactor extracting `buildCreditDebts` from `plaid-analyze`. PR #20 added the `minimum_payment_amount = 0` → fall-through fix (Chase returns 0 in autopay/pre-statement cases). True APRs now sourced from Plaid; min_payment falls through to 2.5% rule when Plaid returns 0/null (refinement tracked as B7).
- **P1-2026-05-06 #2 partial (PR #19, 2026-05-06):** add_product flow — existing items can gain liabilities + APR tracking without full re-link. Open: bigger Option-C delta UI (scoped analyzer + "We found this in [bank name]" review modal).
- **P1-2026-05-06 #4 (PRs #16 + #17 + #18, 2026-05-06):** Bills detector debug pass + Netflix high-confidence escape. Investigation revealed the original "30% miss rate" was a false alarm (naming mismatches in the SQL audit); true miss was Netflix (2 occurrences in 90d window). Escape: identical amounts + interval-center drift ≤ 2 days unlocks 2-occurrence detection.
- **PR #20 second wave (2026-05-06 evening end-to-end testing):** post-checkout speed fix (verify-retry vs. webhook-poll, ~22-44s → ~11s budget); home page card cleanup (welcome card removed, "Add income" chip → "Add expected income"); three UX polish items (Plaid lookback fine print breathing room, tour spotlight border-radius now matches target's --ds-r3 hero, debt-review extra-debts row 2x2 grid on mobile).

---

## How to use this doc

- **Active work** lives here. New items move from `docs/ideas.md` into Now/Next/Later only after a triage decision.
- **Source columns** point back to the original doc in case you need context.
- **Effort: S** = hours, **M** = days, **L** = weeks.
- **Status** is implicit: items in this doc are open; when they ship, move them to Done and don't re-list.
- **The bench is for things we've decided we won't do yet, not for things we're avoiding.** Don't let Now/Next/Later items slide to Bench as a stalling tactic.
