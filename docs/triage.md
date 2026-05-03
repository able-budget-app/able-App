# Able Triage

**Single source of truth for active work.** New ideas go to `docs/ideas.md`, not here.

Last consolidated: 2026-05-03 from `pending_work.md`, `competitor-feature-audit.md` Part 4, `experiments/focus-group/SYNTHESIS.md`, `ROADMAP_DECISIONS.md`, and `tasks.md`.

---

## Now — this week (P0)

✅ **All P0 items shipped 2026-05-03 across two commits (`23a7991`, `59e6955`).** See Done section.

---

## Next — this month (P1)

✅ **All P1 items shipped 2026-05-03 in commit `50826cc`.** See Done section.

Caveat carried forward: the `refer_*_joined` achievement tiles still need a backend hook for "invite turned into a paid signup." Tracked as a small follow-up below.

---

## Later — this quarter (P2)

Project-sized; the small ones (#18, #19) shipped early in the P3 batch. Remaining is genuinely structural work.

| # | Item | Source | Effort |
|---|------|--------|--------|
| 14 | Web push via service worker (audit Part 4 #7). Sequenced after #8 ships its in-app version. First push: deposit-detection. Second: bill-due-tomorrow. | Audit + Focus | L |
| 15 | Demo mode toggle in More (audit Part 4 #8). Required for App Store screenshots; lowers Plaid hesitancy. | Audit | L |
| 16 | Emotional persona multi-select in intake (audit Part 4 #9). Different from intake-channel chips already shipped. Only worth it if we wire personalization downstream. | Audit | M |
| 17 | Tighter descriptor matching for daily-payout merchants (DoorDash, etc.) so confidence stays consistent across same-merchant rows | Focus (Jordan) | M |
| ~~18~~ | ~~Coach panel "thinking..." indicator~~ — shipped in `cd5c390` | Focus (Jordan) | done |
| ~~19~~ | ~~Promote What-if out of the Plan tab~~ — shipped in `cd5c390` (now position 2 in sub-nav) | Focus (Carmen, Theo) | done |
| 20 | Multi-bank support — *committed: free, default, no cap.* Real architecture work. | Paul decision 2026-05-03 + Focus (Carmen) | L |
| 21 | Recurring auto-retry — webhook handler at `plaid-webhook/index.ts:196` already routes RECURRING_TRANSACTIONS_UPDATE but is no-op'd. Wire it + bounded client poller (8 attempts / 60min cap, exp backoff) + non-intrusive "your plan can be refined" banner. Schema: add 4 columns to plaid_items. | Pending #14 | L |
| 22 | Timezone column on profiles — fixes day-shift bugs in weekly digest, monthly_wrap, bill_due_tomorrow emails for users not in MST | Pending #16 | M |
| 23 | Resend bounce/complaint webhook — hard-bounces silently keep retrying. New Edge Function `/functions/v1/resend-webhook` + `email_status` column. Plus Paul registers webhook URL in Resend dashboard. | Pending #17 | M |
| 24 | Tax C workstream: quarterly projections + due dates + dashboard line (per ROADMAP D3.1). Once shipped, the `all_quarters_stashed` achievement becomes real. | ROADMAP D3.1 | L |

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

---

## How to use this doc

- **Active work** lives here. New items move from `docs/ideas.md` into Now/Next/Later only after a triage decision.
- **Source columns** point back to the original doc in case you need context.
- **Effort: S** = hours, **M** = days, **L** = weeks.
- **Status** is implicit: items in this doc are open; when they ship, move them to Done and don't re-list.
- **The bench is for things we've decided we won't do yet, not for things we're avoiding.** Don't let Now/Next/Later items slide to Bench as a stalling tactic.
