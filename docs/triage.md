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

- **P1-2026-05-04 #1 — Multi-card collapse in debt detection.** When a user has two credit cards from the same issuer (e.g. two Chase cards), `plaid-detect-recurring` groups outflows by `(item_id | merchant_key | direction)` — both card payments leave checking with merchant "Chase" and collapse into one stream. The `(0714)` mask shown is just one of the two accounts; the second card is invisible to the user.

  **Proposed architectural fix (sketch, not yet shipped):**
  - **Source of truth shift.** Read credit-card debts from `plaid_accounts` directly, where `subtype IN ('credit card', 'line of credit')`. Each card has its own row with `mask`, `current_balance`, `name`/`official_name`. That's the canonical "what does the user owe on each card" answer Plaid already gives us.
  - **New Edge Function `plaid-detect-credit-debts`** (or fold into `plaid-detect-recurring` as a separate code path):
    1. Pull every credit account for the item.
    2. For each, derive `min_payment` from the most recent outflow on the *parent checking account* tagged as a payment to this card (match by mask suffix or ACH descriptor).
    3. Derive `rate_estimate` from the last 3-month rolling sum of `INTEREST CHARGE` / `PURCHASE INTEREST CHARGE` line items on that card's own transactions, ÷ avg balance × 12 — or null if no interest data yet.
    4. Emit one debt entry per card: `{name, mask, balance, min_payment, rate}`.
  - **plaid-analyze prompt update:** treat the credit-debts feed as the primary source for `debts[]`; outflow streams remain a fallback when no credit accounts are connected (e.g., debt-only-from-checking case like a personal loan). Currently the prompt does the inverse — outflow streams are primary.
  - **Pipeline order:** sync → classify → `plaid-detect-credit-debts` (NEW) → `plaid-detect-recurring` (existing, but skip credit-card outflows now that we have the canonical source) → analyze.
  - **Bonus side-effect:** the "Purchase Interest Charge $349 in Bills" issue (P1 #4 #2 below) gets cleaner — interest charges become *evidence for APR*, not standalone bills.
  - **Open question:** does the current `plaid_accounts.current_balance` actually update on Plaid sync, or does it require an explicit `/accounts/get` call? If the latter, we'd need to wire one balance refresh into the pipeline. Worth confirming with `select current_balance, last_balance_at from plaid_accounts where subtype='credit card'` post-sync to verify freshness before designing around it.
- **P1-2026-05-04 #2 — Interest-charge line items still classified as bills.** "Purchase Interest Charge (credit card) $350 · day 14" appears in the 16-bill list. Round 2 flagged this; classifier prompt rule needs updating so credit-card statement entries with descriptors `INTEREST CHARGE`, `PURCHASE INTEREST CHARGE`, `FINANCE CHARGE` route to debt-cost (or get suppressed entirely) rather than treated as recurring bills.
- **P1-2026-05-04 #3 — Classify is the slow step in onboarding (~7 min for 1247 transactions).** `obRunPlaidPipeline` calls `plaid-classify-pending` (1 batch of 50) sequentially up to 10×. Should switch to `plaid-classify-batch` (10 internally-parallel batches in 1 invocation, ~45s) and limit the onboarding pass to last 90 days (background-classify the rest). Plan still gets generated even with partial data, but better data → better debt detection.
- **P1-2026-05-04 #4 — Income sources panel shows 9 entries when Plaid detected 5.** Round 2's P0 #2 fix removed the goal-label / processor-label corruption, but defaults (`Client / Job 1`, `Client / Job 2`, `Side income`, `Other`) are still being merged with the Plaid-derived sources (Remote deposit, Stripe payouts, Airbnb host payouts, Venmo transfers, Eventbrite payout). Looks like analyzer-apply-plan or the `S.sources` write-back is appending instead of replacing. When Plaid returns concrete sources, the generic placeholders should be dropped — they're noise in any context that reads `income_sources` (Coach, plan summary, allocation suggestions).
- **P1-2026-05-05 #1 — Paid-ads tracking infrastructure (prerequisite for any spend).** Set up before any paid ad goes live so we can actually measure CPL/CAC. Three pieces:
  1. **Meta Pixel** on landing (`index.html`) + app shell. Page views auto. Custom events: `Lead` (paywall_viewed), `StartTrial` (trial_started → fire from `_onAuthStateChangeImpl` post-checkout success), `Subscribe` (subscription_activated).
  2. **Google Ads tag (gtag.js)** with conversion actions for the same three events, plus `Purchase` for one-time `lifetime` upgrades. Use the existing `Able.track` choke-point so we don't double-write.
  3. **Conversion API (server-side) via `stripe-webhook`** — POST to Meta CAPI + Google Ads Enhanced Conversions when `checkout.session.completed` / `subscription.created` lands. Browser-side pixels alone lose attribution to ad-blockers + iOS ATT; server-side recovers most of it. Hash email + use the `event_id` field so client+server events dedupe.

  Effort: M. Touches `index.html` (pixel snippets + tag), `app.html` (event firing in `_onAuthStateChangeImpl`), `stripe-webhook` (server-side conversions), Meta Events Manager + Google Ads dashboard (verify firing). Should be done before flipping the first ad live.

- **P1-2026-05-05 #2 — Schema drift between client and `plaid_recurring_streams` (silent 400).** ✅ Shipped 2026-05-05 in PR #2 (`3d514af`). Dropped `personal_finance_category_primary` from the client SELECT + AI match payload + `_streamCategoryToBill` and `_looksLikeBankFee` (refactored to derive primary from detailed via Plaid PFC convention). Edge Function only writes `_detailed`; primary was dead code in the client.

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
