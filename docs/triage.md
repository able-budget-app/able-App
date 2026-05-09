# Able Triage

**Single source of truth for active work.** New ideas go to `docs/ideas.md`, not here.

Last consolidated: 2026-05-03 from `pending_work.md`, `competitor-feature-audit.md` Part 4, `experiments/focus-group/SYNTHESIS.md`, `ROADMAP_DECISIONS.md`, and `tasks.md`.

---

## Now — this week (P0)

- **P1-2026-05-08 #1 — Misleading "Refresh plan" banner on home.** Surfaced 2026-05-08 evening E2E test. The banner appears when `plaid_items.recurring_status === 'fresh'` (i.e., Plaid detected new recurring patterns) and tells the user "Re-run the analyzer to merge them in." But the click handler `refreshPlanFromBanner` (`app.html:10713`) is a stub — it only marks `recurring_status='applied'` and shows a toast. **Doesn't actually re-run anything.** Worse than calling the LLM: the user thinks something happened, nothing did. Cost concern: if we ever wire it for real, it'd be a 1-click LLM cost-bomb surface. **Plan:** (a) remove the banner from home immediately, (b) when the multi-bank delta UI ships (P1-2026-05-06 #2 partial), surface a properly-gated "Recalibrate plan with [bank name]" entry in Settings only when a NEW account is connected — not on every recurring-pattern detection. Pairs with the multi-bank delta scope already in flight.

- ~~**P0-2026-05-08 #1 — Mark-as-bill from Activity / Leaks doesn't propagate to Bills page.**~~ ✅ Shipped 2026-05-08 evening across two commits. `ff87dcb` added the server-side bill upsert in `plaid-classify-override` when category='bill' and override is created (looks up matching `plaid_recurring_streams` for amount + cadence; falls back to txn amount if no stream); client refetches `user_data.bills` after the override succeeds. `aa536f0` made it symmetric — reclassifying away from 'bill' removes the matching bill row(s) using the same case-insensitive substring match. Verified end-to-end on `pauljohnsontest11@paul7.com` 2026-05-08 evening: Sparklight removed cleanly when reclassified to discretionary, Villa Sport added cleanly when reclassified to bill.

- ~~**P0-2026-05-08 #2 — Analyzer runs before plaid_recurring_streams populates.**~~ ✅ Shipped 2026-05-08 evening (commits `3ed72c6` + `ab5f521` + `bc2ce3b`). Server-side gate in `plaid-analyze` returns `status: 'not_ready'` (HTTP 200, body-level signal) when streams count is 0 AND less than 3 minutes since `last_sync_at`. Server fires `plaid-recurring-refresh` in waitUntil background while client polls. Past 3-min cap, falls through and runs with whatever data exists. Client polls every 15s with 5-min hard cap, then sends `force_run:true` as escape. Onboarding copy updated to "About 3 minutes — sometimes up to 5." Bonus fix: bounce-back race in `obRunPlaidPipeline` where late-firing `renderObStep()` callbacks were un-hiding the question area after Continue (commit `bc2ce3b`). Validated end-to-end on `pauljohnson912test@paul9.com`: 1344 txns + 28 recurring streams populated before analyzer ran, plan completed in 3min 10s, Paul confirmed plan quality "meaningfully better."

✅ **Both P0 items from 2026-05-07 closed.** See Done section.

---

## Next — this month (P1)

✅ **All P1 items from 2026-05-03 shipped in commit `50826cc`.** See Done section.

**New from 2026-05-04 E2E test:**

- **P1-2026-05-04 #1 — Multi-card collapse in debt detection.** ✅ Shipped 2026-05-06 in PR #9 (`d02c3ca`). Built a deterministic preprocessor inside `plaid-analyze` (Option C — no new Edge Function, no new table). For each credit card / line of credit on the item: balance from `plaid_accounts.current_balance`, min_payment via mask-match to outflow streams (with 2.5% fallback + $25 floor), rate_estimate from 90-day INTEREST CHARGE sum annualized + clamped to [5%, 40%]. Output passed to LLM as `pre_built_credit_debts`; prompt updated to emit each entry verbatim. Verified on fresh signup: two Chase cards (0714 / 4766) now appear as separate debt entries with $6,797 / $8,785 balances and 19.82% / 15.58% rates instead of collapsing into one. Open question (current_balance freshness) answered by reading `plaid-sync/index.ts:261-264` — accounts are upserted inline on every `/transactions/sync` call.
- **P1-2026-05-04 #2 — Interest-charge line items still classified as bills.** ✅ Shipped 2026-05-06 in PR #9 (`d02c3ca`) as a side-effect. `stripInterestCharges()` filters `INTEREST CHARGE` / `FINANCE CHARGE` / `PURCHASE INTEREST CHARGE` from the txn pool before bills aggregation. Verified: bills count dropped from 16 to 8 on Paul's data; bills total now reconciles cleanly with coach summary ($3,156). Classifier-side fix not required; defensive filter in plaid-analyze handles it. No interest-charge entries leak into `bills[]`.
- **P1-2026-05-04 #3 — Classify is the slow step in onboarding (~7 min for 1247 transactions).** ✅ Already shipped (commit predates this triage entry being closed). `obRunPlaidPipeline` (app.html:4926-4934) calls `plaid-classify-pending` with `max_batches:10` and internal parallelism (4 concurrent batches inside the function). Comment-of-record: "Old loop did 10×50 sequential = 7min; new loop does up to 5×500 with internal parallelism = ~3-5min worst case." Decision 2026-05-06: keep 6-month classification pass (don't drop to 90 days) — the speed win isn't worth losing the second quarterly tax payment for tax % accuracy.
- **P1-2026-05-04 #4 — Income sources panel shows 9 entries when Plaid detected 5.** ✅ Shipped across two commits: `20a1a9d` (2026-05-04) added `replace_sources` flag on `analyzer-apply-plan` so onboarding auto-apply wipes defaults server-side, and PR #7 `904bfba` (2026-05-05) drops PLACEHOLDER_DEFAULTS (salary/freelance/side income/other) client-side at plan-review accept. Verified 2026-05-06 on Paul's fresh signup: `user_data.sources` returned only Plaid-detected names (Stripe payouts / Airbnb host payouts / Venmo deposits) with no generic defaults remaining.
- **P1-2026-05-05 #1 — Paid-ads tracking infrastructure.** ✅ Largely shipped 2026-05-07. See Done section. Server-side Google Ads Enhanced Conversions deferred until we're actually spending.

- **P1-2026-05-07 #1 — In-app monthly→annual upgrade (no Stripe Checkout redirect).** ✅ Shipped 2026-05-07. See Done section.

- **P1-2026-05-07 #2 — Onboarding tax calibration by state.** Two round-2 personas hit this: Marcus (Michigan rideshare) — Able suggested 22%, real federal-SE + Michigan state is closer to 25-27%, *"22% is going to leave me short next April"*; Lena (Florida self-employed) — 22% was correct (FL has no state income tax) but the lack of confirmation left her unsure. Synthesis recommends three questions (state, filing status, gross-vs-take-home); shipping **state only** for v1 since it's 80% of the value with one extra question. Touches: new `tax_state` question in `OB_QUESTIONS` (between pay_self and plaid_connect, optional); pass `state` through `profile_hint` to `plaid-analyze`; update Rule 4 of analyzer prompt to factor state into suggested_pct (no-state-income-tax states add 0; CA/NY/NJ/OR/HI add 5-7; most others 2-4). | Source: focus-group SYNTHESIS-round2 #B (lines 73-83) + priority-recommendation #4 (line 159).

- **P1-2026-05-05 #2 — Schema drift between client and `plaid_recurring_streams` (silent 400).** ✅ Shipped 2026-05-05 in PR #2 (`3d514af`). Dropped `personal_finance_category_primary` from the client SELECT + AI match payload + `_streamCategoryToBill` and `_looksLikeBankFee` (refactored to derive primary from detailed via Plaid PFC convention). Edge Function only writes `_detailed`; primary was dead code in the client.

- **P1-2026-05-06 #1 — Plaid liabilities integration for true APR + min_payment.** ✅ Shipped 2026-05-06 across PR #13 (`plaid-detect-credit-debts` Edge Function + `plaid_credit_debts` table + C→A refactor extracting `buildCreditDebts` out of `plaid-analyze`) and PR #20 (treat Chase's `minimum_payment_amount = 0` as missing, fall through to 2.5% rule). Verified on Paul's two Chase cards: APRs now 0.23 / 0.26 from `/liabilities/get` (vs. 19.82% / 15.58% from the old INTEREST-CHARGE estimator). Min_payment falls through to 2.5%-of-balance ($220 / $170) when Plaid returns 0/null — conservative; refinement tracked as B7.

- **P1-2026-05-06 #2 — Add-bank-from-settings only syncs, doesn't classify or analyze.** ✅ Partially shipped 2026-05-06 via PR #19 (add_product flow + Enable APR tracking button so existing items can gain liabilities without full re-link). The credit-card detection portion now runs through the same `plaid-detect-credit-debts` function as the onboarding path. **Still open:** the bigger Option-C delta UI (scoped analyzer pass + "We found this in [bank name]" review modal + opt-in recalibration button). Promote back to active when we want to handle multi-bank deltas for bills + income sources, not just cards.

- **P1-2026-05-06 #3 — Home hero card empty until user manually adds a balance.** Fresh-signup users with Plaid connected saw a blank "Add what's in your spending accounts" CTA on home, even though `loadBankBalances` populates `S._bankBalances` async. The bank-balance line was only rendered in the populated branch of `renderHeroMoney` (when `_hasBalance()` was true), so a user who hadn't yet entered a manual balance never saw their connected accounts. Shipped 2026-05-06 in PR #12: empty-state branch now renders bank balances + per-account breakdown + "Use $X as my balance" one-tap CTA, with manual entry preserved as a secondary option. **Bigger redesign deferred** — Paul flagged interest in making live bank balance the working balance (instead of manual S.balance) per the per-deposit "every dollar gets a job" model, but that reverses the 2026-05-03 Option B decision and has the manual-double-counting wrinkle when income hits Plaid post-log. Tracked as bench item B6.

- **P1-2026-05-06 #4 — Analyzer bills accuracy: ~30% miss rate on legitimate bills.** ✅ Shipped 2026-05-06 across PR #16 (rich debug mode in `plaid-detect-recurring` with `merchant_filter` param), PR #17 (triage close-out), and PR #18 (Netflix high-confidence 2-occurrence escape). Investigation revealed the original "30% miss rate" was a **false alarm** — 8 of the 11 listed missing bills were actually detecting. Double-counted entries + naming mismatches (e.g. SQL pattern `chase.*fee` missed "MONTHLY SERVICE FEE", `smart credit` missed "Smartcredit" with no space). True miss after debug pass was Netflix (2 occurrences in 90d window, just under the 3-occurrence floor) — fixed by the high-confidence escape: identical amounts + interval-center drift ≤ 2 days unlocks 2-occurrence detection.

- **P1-2026-05-06 #5 — Income source names use rail, not work.** ✅ Shipped 2026-05-06. Two-part fix: (1) app.html was passing the raw `name_business` intake answer ("Paul Johnson, marketing consultant and Airbnb host") as both `profile.name` AND `profile.business` — split so name gets the parsed first name, business gets the full raw string as natural language; (2) analyzer prompt rule 7 rewritten to translate rail merchants into work-derived names using profile.business as the anchor (Stripe payouts for a marketing consultant → "Marketing payments"). Multi-stream users now split by work, not rail. **Deferred:** the in-app plan-review "What client is this?" rename nudge — the prompt change covers the auto-naming side, the manual-rename UX is a P3-class polish that can wait.

Caveat carried forward: the `refer_*_joined` achievement tiles still need a backend hook for "invite turned into a paid signup." Tracked as a small follow-up below.

---

## Later — this quarter (P2)

- ~~**Bump GitHub Actions runner deps before Node 20 sunset**~~ ✅ Already shipped — `functions-check.yml` is on `actions/checkout@v5` + `denoland/setup-deno@v2`.
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
| B6 | **Plaid-driven money in/out** (live bank balance becomes the working balance + `totalIn()` flips to Plaid txn totals) | Paul direction 2026-05-06 | Two surfaces of the same call (was split as B6 + C1, merged 2026-05-06): the **balance** number switches from manual `S.settings.balance` to the live bank balance; the **monthly income total** switches from summing manual `S.history` to summing Plaid deposits. Together they make Plaid the source of truth for money in/out. Reverses 2026-05-03 Option B (working balance stays manual). Solves the "$X to allocate" framing per the per-deposit model. Wrinkle: manual `Log income` would now race Plaid sync — needs a clean answer to "what does Log income mean now" before building. **Parked 2026-05-07** — Paul wants more think-time on the Log income semantics + Plaid lag/outage handling; revisit after live customer feedback informs the call. Open design questions captured: (1) what Log income means post-B6 (remove / stage-and-merge / cash+off-bank only), (2) Plaid lag UX (last-synced indicator? fallback?), (3) migration plan for existing S.history. |
| ~~B7~~ | ~~Refine credit-card min_payment fallback when Plaid returns 0/null~~ | ~~PR #20 follow-up 2026-05-06~~ | ✅ Shipped 2026-05-07 (commit `5b8fa60`). New `estimateMinPayment` helper uses `last_statement_balance` (falls back to current_balance) × 1% + interest at `purchase_apr` (defaults 22% when missing), $25 floor. Replaces the 2.5%-of-current_balance rule at both fall-through sites. |
| ~~B8~~ | ~~**Mass email design redesign**~~ | ~~Paul direction 2026-05-06~~ | ✅ Shipped 2026-05-07 (commit `01d79c7`). Refactored `email-cron-daily/index.ts` into design tokens + component primitives (`header` / `hero` / `heroNumber` / `stats` / `bars` / `callout` / `paragraph` / `cta` / `footer` / `layout`). Three tones (green / amber / terra) drive stripe + eyebrow + CTA color so calm vs. heads-up vs. Coach-stress emails read distinct. All 11 existing templates rebuilt: dormancy, weekly, bill_due_tomorrow, low_buffer, monthly_wrap, cart_24h/3d/7d, trial_day_5_nudge, trial_day_7_last_call, trial_ended_no_convert. Stale 7-day-trial copy fixed across cart and trial templates (cron timing was already correct). Two new templates added: `achievement_unlocked` (gold-tier only — halfway_to_able, one_month_ahead, debt_free, streak_12, score_100, refer_ten_joined; sourced from `user_data.settings.ach_dates`, deduped per achievement_id) and `deep_dive_summary` (per `plaid_items.deep_dive_completed_at` + non-zero summary, deduped per item so multi-bank users get one email per bank). Decision: dropped post-onboarding plan summary email — plan-review modal in app already shows it; would have duplicated content. New `--preview` mode renders all 14 templates to `scripts/email-preview.html` for visual review. FROM_EMAIL flipped to `Able <hello@becomeable.app>` 2026-05-07 (Resend domain verified). |
| ~~B9~~ | ~~**Plan output variance between identical-data signups**~~ | ~~Paul observation 2026-05-06 evening~~ | ✅ Shipped 2026-05-07 (commit `d24dad8`). (a) `temperature: 0` on the analyzer messages.create call. (b) Always-bill list named in Rule 5 — ~40 well-known consumer subs (Netflix, Spotify, Apple Music, iCloud, ChatGPT, Adobe, Amazon Prime, Peloton, etc.). (c) Always-debt list named in Rule 6 — ~30 auto + student loan issuers (Toyota Financial, Honda Financial, Ford Credit, Chase Auto, Nelnet, Navient, MOHELA, Sallie Mae, etc.). Substring matches force classification regardless of LLM judgment. SoFi / Marcus deliberately excluded (dual-purpose deposit accounts). Real deterministic preprocessor as follow-up only if temp=0 + named lists isn't enough. |
| B10 | **In-app "regenerate plan" as failure-only fail-safe** | Paul direction 2026-05-08 | NOT a freely-clickable button — would burn LLM tokens if users keep retrying for a "better" plan. Constraint: only surface when the analyzer actually failed (timeout, 5xx, network error mid-flight) OR the user closed the plan-review modal before accepting. Probably a one-shot recovery CTA on home with explicit "Try again" framing, not a permanent settings option. Don't build until we see real users hit the failure case in support. Unrelated to today's Plaid auth fix — just surfaced because that bug masked the fact that users don't currently have a recovery path. |

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
- **P0-2026-05-07 #1 — Stripe price IDs fix (`41799d2`):** PRICE_MONTHLY was a one-time $14.99/yr price misconfigured in Stripe, so `create-checkout` derived `mode=payment` and produced Customers without Subscriptions. Created new recurring monthly product `price_1TUT0rDBmPAhrdxktHAb3SzX`, updated `app.html:2758`. Verified 2026-05-07 — fresh signups now produce real Subscriptions. Lifetime tier retired in same session; PRICE_LIFETIME removed from app.html, but `mode === 'payment'` branch in stripe-webhook kept as defensive no-op for grandfathered users.
- **P0-2026-05-07 #2 — Stape CAPI Gateway disconnect (Meta dashboard):** Disconnected from Events Manager → Pixel → Settings/Integrations on 2026-05-07. No code change.
- **P1-2026-05-05 #1 — Paid-ads tracking infrastructure:** Largely shipped. Browser-side: Meta Pixel + Google Ads gtag.js on `index.html` + `app.html`; events fire through `Able.track`/`Able.trackOnce` choke-point with `eventID` for browser/CAPI dedup. Conversion actions verified firing 2026-05-07 by URL-label match in Network panel (`BlSFCK2dkqkcEKqnk8tD` paywall_viewed, `2mjgCMCXkqkcEKqnk8tD` trial_started, `fhxUCOvRkakcEKqnk8tD` subscription_activated). Server-side: `stripe-webhook` posts Meta CAPI `StartTrial` + `Subscribe` with userId-keyed event_ids matching the browser side. **Deferred:** server-side Google Ads Enhanced Conversions (needs separate OAuth + developer token + refresh tokens — too big for the session, parked until we're actually spending). **Outstanding micro-task:** to verify browser/CAPI dedup end-to-end, set `META_CAPI_TEST_EVENT_CODE=TEST91865` in Supabase env temporarily and watch Meta Test Events tab — leave for the day we go live with paid spend.
- **P1-2026-05-07 #1 — In-app monthly→annual upgrade (commits `20d8978` + `192b2a1`):** New `switch-plan` Edge Function uses `stripe.subscriptions.update` with `proration_behavior=always_invoice` + `billing_cycle_anchor=now` for active subs (prorated charge to saved card, fresh anchor) and `proration_behavior=none` during trial (Stripe rejects prorate/anchor mid-trial — patched same-day). Settings card in `app.html` shows "Switch to annual · Save $50" button only when current_interval=='month' && status in ['trialing','active'] && !cancel_at_period_end (preview call gates visibility). Verified end-to-end 2026-05-07 on a trialing account.
- **Post-checkout 45s timeout fix (commits `135801f` + `8ae3dea`):** Surfaced during P1-2026-05-07 #1 testing. After Stripe redirect, `supabase.auth.getSession()` wedges on the cleaned-URL client; the 3s escape-hatch handled getSession itself by reading the session from localStorage, but `functions.invoke('verify-checkout-session')` re-entered `getSession()` internally and hung forever, falling through to the 45s safety-net "still confirming your payment" page. Fix: stash `access_token` from localStorage on `window._wedgedJwt` at page load (when `?checkout=success` is present) and add `verifyCheckoutSession()` helper that prefers raw `fetch()` to the Edge Function URL with that token over `functions.invoke` when wedged. Healthy-client path unchanged. Verified: 45s timeout → 1.4s success.

---

## How to use this doc

- **Active work** lives here. New items move from `docs/ideas.md` into Now/Next/Later only after a triage decision.
- **Source columns** point back to the original doc in case you need context.
- **Effort: S** = hours, **M** = days, **L** = weeks.
- **Status** is implicit: items in this doc are open; when they ship, move them to Done and don't re-list.
- **The bench is for things we've decided we won't do yet, not for things we're avoiding.** Don't let Now/Next/Later items slide to Bench as a stalling tactic.
