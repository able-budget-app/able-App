# Able Roadmap — Q2 2026

**Owner:** Paul · **Drafted:** 2026-04-27 · **Trigger:** Plaid pay-as-you-go approved + Kelty competitive audit landed

---

## TL;DR

The next ~10 weeks are about **locking the product so we stop rewriting marketing**. Plaid is the trigger. Once Plaid + Analyzer + Tax + Methodology name + Tour are locked, the existing 175-piece social library, the paused 9-article blog cluster, the landing page, the email sequence, and the ads all get a single coordinated rewrite — instead of a rolling rewrite every time the product moves.

**The discipline:** product → capabilities skill → content. In that order. Anything that violates that order creates rework.

---

## Status check (where we are today)

### Product (becomeable.app)
- ✅ Core allocator, buckets (taxes/bills/smoothing/debt/free), per-bill reservations, smart window, AI Coach, Stripe billing, email cron, brand-aligned auth/dashboard, day-1 referral, tour
- 🚧 Open: Plaid integration (Phase B planned), Analyzer (newly defined this session), Tour empty-account gate, Coach SSE streaming
- 📦 Capabilities ground truth: `~/.claude/skills/able-app-capabilities/`

### Marketing
- ✅ Landing site (becomeable.app), brand system, email infrastructure (DNS verified, FROM_EMAIL = hello@becomeable.app), 175-piece social library exported + uploaded to Drive, Make scenario `4869011` ready (paused), 60s Remotion reel rendered, 10 marketing footage MP4s
- 🚧 In flight: PYF blog cluster (2/11 drafts, **paused** awaiting product decisions), business cluster (2/?), product shots library (zero stills exist — pivot 2026-04-27)
- ⛔ Not started: SEO content engine, social content engine (sustainable production cadence)

### What just changed
- **Plaid moved us to pay-as-you-go this week.** Integration is now real, not theoretical.
- **Kelty audit landed (2026-04-27).** Confirmed the wedge (inconsistent income), flagged the gaps (bank sync, tax depth, partner, methodology, mobile, pricing).
- **Paul defined the Analyzer** (this session): looks at typical income + bills, allocates a slice of every deposit toward big upcoming bills (e.g. mortgage) so they're covered when due.

---

## The dependency principle (why this doc exists)

```
Product capabilities
        ↓
Capabilities skill (single source of truth)
        ↓
Landing page + tour + in-app copy
        ↓
Long-form content (blog, video scripts)
        ↓
Short-form content (social captions, ads, emails)
        ↓
Distribution engines (SEO, social cadence)
```

**If you write at any layer before the layer above it is locked, you rewrite.** Every loop back up costs 1-3 days.

---

## Decision gates — answer these BEFORE Phase 1 starts

These six decisions cascade through everything below. Lock them this week.

| # | Decision | Recommendation | Why it matters |
|---|----------|----------------|----------------|
| **D1** | **Plaid scope for v1** — B.1 balance only / B.1+B.2 deposit detect / B.1+B.2+B.3 auto-mark-paid | **B.1 + B.2.** B.2 enables the Analyzer + the marketing wedge ("we see your real income"). B.3 is polish — defer to a later sprint. | Scope determines build time (3-4 wks vs 6-8) AND every marketing claim. Don't promise B.3 in copy if we ship B.1. |
| **D2** | **Pricing direction** — hold $14.99/$129 / drop to $9.99/$89 / go tiered (Starter/Pro) | **Hold $14.99 through Phase 1-2.** Don't whipsaw — you just reverted a price drop. Re-evaluate after Plaid + Analyzer + Tax ship. Tiered is the long-term answer. | Every ad, landing CTA, email, paywall, social caption references price. If we change after rewriting content, we rewrite again. |
| **D3** | **Tax bucket depth** — keep current shallow bucket / elevate to first-class with quarterly projections | **Elevate.** Tax is the #1 freelancer pain after cash flow. Audit flagged this. Likely 1-2 weeks of work; massive marketing payoff. | Marketing claim "tax-aware budgeting" depends on this. Without it, we lose to Origin/QBSE on the tax angle. |
| **D4** | **Household/partner access** — in scope for Q2 / defer | **Defer to Q3.** Schema change, auth complexity, not the wedge. Monarch owns this; we shouldn't fight there yet. | If we say yes, schema work has to happen NOW before everything else hits the DB and migrations get nasty. |
| **D5** | **Methodology name** — adopt named system / leave generic | **Adopt.** "The Able Method" or "The Floor Method" — pick one. 5 rules, teachable. YNAB owns "zero-based budgeting" because they named it. | Named methodology becomes the spine of every blog post, video, podcast appearance. If we name it AFTER content is written, we rewrite the content. |
| **D6** | **Analyzer scope** — rules-based v1 / LLM-suggested v1 | **Rules-based v1.** Deterministic, no API costs, ships in days not weeks. LLM layer comes later as "Coach suggests an allocation." | Affects build cost + ongoing API spend. Ship the floor first. |

### Bonus deferred decisions (not blocking — answer when ready)
- **Native mobile (iOS/Android):** PWA holds for Q2. Real native is a Q4 conversation.
- **Community (Discord/Circle):** Light Discord in Q3 once user count justifies moderation.
- **Net worth / investment tracking:** Not the wedge. Permanent defer unless data shows demand.
- **Subscription detection:** Comes free with Plaid B.2. Don't build separately.

---

## Phases (dependency-ordered)

### PHASE 0 — Decision lock (this week, ~2 days)

**Owner:** Paul

- [ ] Answer D1–D6 (above)
- [ ] Read relevant Plaid docs sections for chosen scope:
  - Link Token / Item flow (onboarding UX)
  - Auth + Identity (account + holder name)
  - Transactions endpoint (deposit detection — for D1=B.2)
  - Pricing breakdown for chosen products (since we're now metered)
- [ ] Pick methodology name (D5)
- [ ] Sketch the 5 rules of the methodology

**Exit criteria:** all six decisions written into this file under "Locked decisions" below. No work begins on Phase 1 until this is done.

---

### PHASE 1 — Product capability lock (3-6 weeks)

**Goal:** Ship every capability we'll be marketing in Q2. Nothing else gets to start until this exits.

**Workstream A: Plaid integration** (3-4 wks)
- Link Token + Item creation flow
- Account + balance read (B.1)
- Transactions sync + deposit detection rules (B.2 — if locked in D1)
- Plaid pricing meter dashboard (track per-user cost vs subscription revenue)
- Auth-OFF Edge Function `plaid-link` + `plaid-webhook`
- Schema: `plaid_items`, `plaid_accounts`, `plaid_transactions` tables
- Onboarding: choose "connect bank" OR "manual entry" — both must work

**Workstream B: Analyzer** (1 wk, depends on B.2 if Plaid-driven; otherwise standalone)
- Rules-based v1 (per D6):
  - Looks at last N deposits (or manually entered income history)
  - Looks at upcoming bills in next 30/60/90 days
  - For each big bill, suggests % of each deposit to reserve
  - User accepts/edits the suggested split
- Surface in deposit allocation modal as "Analyzer suggests…"

**Workstream C: Tax elevation** (1-2 wks, if D3 = elevate)
- Tax bucket gets quarterly projection (estimated annual income → quarterly owed)
- Q1/Q2/Q3/Q4 due dates surfaced in Next 14
- "Tax owed" line on dashboard
- Tax-specific copy in onboarding

**Workstream D: Methodology in-product** (2-3 days, depends on D5)
- Named in onboarding ("Welcome to The Able Method")
- 5 rules surfaced somewhere (Score tab? Settings? Tour step?)
- Footer or About link to "The [name] Method" explainer page

**Workstream E: Tour redo** (3-4 days, MUST be last in Phase 1)
- Rewrite tour against final capabilities (Plaid, Analyzer, Tax, Methodology)
- Empty-account gate (per pending work item #2)
- New tour step for bank connection
- New tour step for Analyzer

**Exit criteria:**
- All Phase 1 features in production
- Capabilities skill (`~/.claude/skills/able-app-capabilities/`) **fully updated** to match what Able now does — this is the **lock event** that unblocks Phase 3
- DESIGN.md updated if any UI patterns changed
- Pricing decision (D2) re-confirmed before Phase 4

---

### PHASE 2 — Design + UX polish (1-2 weeks, can overlap end of Phase 1)

**Goal:** App feels premium enough to justify the price (audit point: "execution underdelivers on the depth that justifies $14.99").

- Empty states for every screen (especially Plan/Score/Coach for new users)
- Plaid connection flow polish (this is the new first impression)
- Mobile PWA polish — install prompt, splash screen, status bar color
- Tour empty-account gate
- Microcopy pass on any new strings (use `able-product-copy` skill)
- Hit `simplify` skill on any code touched

**Exit criteria:** New-user walkthrough on a fresh account feels good end-to-end. Capture this as the screenshot baseline (see Phase 3).

---

### PHASE 3 — Capabilities skill + product shots (3-5 days)

**Goal:** Single source of truth refreshed, then frozen long enough to do content rewrites against.

- [ ] Update `~/.claude/skills/able-app-capabilities/` with everything from Phase 1
- [ ] Capture **product screenshots** (not video — stills) of every key screen post-Plaid:
  - Connect bank flow
  - Dashboard with real bank data
  - Analyzer suggestion modal
  - Tax projection view
  - Methodology page
- [ ] Build phone-frame product-shot library (the gap from 2026-04-27 pivot memo)
- [ ] Re-record marketing footage clips against new UI (`scripts/record-clips.py`)

**Exit criteria:** A folder of crisp, on-brand stills + clips that match shipped product 1:1. This is the asset library every content piece below will pull from.

---

### PHASE 4 — Content rewrite (coordinated, 2-3 weeks)

**Goal:** Every piece of marketing now references the real, current product. Done as a single sprint, NOT incrementally, so messaging is coordinated.

**Order matters within this phase too:**

1. **Landing page** (becomeable.app) — sets the tone everything else inherits
2. **Methodology explainer page** (new) — "The [name] Method" — landing + footer link
3. **Pricing page** (re-confirm or update per D2 outcome)
4. **PYF blog cluster** (resume from 2/11 — rewrite the 2 if capabilities changed, draft 9 more)
5. **Business cluster** (continue)
6. **Email sequence** — onboarding + behavioral triggers updated for Plaid mention + new bucket vocab
7. **Social caption library** (175 pieces) — sweep for any false claims; rewrite ones that referenced manual-only entry
8. **Ad copy** (Meta, Google, YouTube, TikTok) — use `able-paid-ads` skill, keyed to new capabilities
9. **Video scripts** — refresh "Day 1-31" and any product-demo scripts to reference Plaid

**Exit criteria:** Every public surface says the same thing about what Able is. No stale claims.

---

### PHASE 5 — Distribution engines (ongoing, kicks off after Phase 4)

**Goal:** Sustainable cadence, not one-time bursts.

- **Social engine** — activate Make scenario `4869011` (per `make_scenario_state` memo); set posting cadence; refill caption library on a monthly cycle
- **SEO engine** — pillar/cluster expansion plan; weekly publish cadence; backlink + technical SEO baseline (use `able-seo` skill)
- **Email cadence** — broadcast schedule beyond triggers (newsletter? methodology drip?)
- **Video cadence** — short-form (Reels/TikTok/Shorts) + long-form (YouTube) cadence
- **Repurposing flow** — blog → NotebookLM → YouTube (per existing `social_roadmap` plan)

---

## What this protects against (the "no backtrack" rule)

| ❌ DON'T do this | ✅ Do this instead |
|---|---|
| Rewrite blog posts before capabilities skill is updated | Lock capabilities first; rewrite once |
| Run ads on $14.99/$129 then change pricing | Re-confirm D2 before Phase 4 starts |
| Shoot product video against current UI before Phase 2 polish | Capture stills/clips in Phase 3, after polish |
| Promise "auto-pays your bills" if shipping B.2 only | Match copy to actual D1 scope |
| Name methodology AFTER writing content that uses generic terms | Lock D5 in Phase 0 |
| Build household/partner schema mid-Plaid sprint | Defer per D4 — revisit Q3 |
| Activate social posting engine on stale captions | Wait for Phase 4 caption sweep |

---

## Kelty audit — what we accept, defer, reject

| Audit recommendation | Verdict | Where it lives in this plan |
|---|---|---|
| Add bank sync | ✅ Accept | Phase 1 Workstream A (Plaid) |
| Add tax planning | ✅ Accept | Phase 1 Workstream C |
| Name the methodology | ✅ Accept | D5 → Phase 1 Workstream D |
| Build community | 🕓 Defer to Q3 | Light Discord post-launch |
| Native mobile app | 🕓 Defer to Q4 | PWA holds for now |
| Add household/partner | 🕓 Defer to Q3 | D4 |
| Add subscription detection | ✅ Free w/ Plaid | Falls out of Phase 1 Workstream A B.2 |
| Add net worth tracking | ❌ Reject for now | Not the wedge |
| Add investment tracking | ❌ Reject for now | Not the wedge |
| Lower price to undercut YNAB | 🕓 Re-evaluate post-Phase 2 | D2 |
| Lean harder on freezing/leak narrative | ✅ Accept | Phase 4 — copy direction |
| Add "Office Hours" workshops | 💡 Maybe Q3 | After Phase 5 cadence is steady |
| Refund tracking (from Simplifi) | ❌ Reject for now | Low signal |
| AI auto-categorization (from Copilot) | 🕓 Maybe Q3 | Layer onto Plaid Phase 2 |
| Long-term planning view (from Origin) | 🕓 Maybe Q3 | Could pair with tax projections |

---

## Open questions for Paul (clarify before Phase 0 closes)

These will sharpen the plan. Numbered so you can answer "Q1: …" rapidly.

1. **Plaid scope** — comfortable with B.1 + B.2 only for v1? Or do you want B.3 (auto-mark-paid) in v1 too? B.3 adds ~2 weeks + UX complexity around "did the user actually pay it or did Plaid mis-detect."
2. **Plaid pricing** — what's the per-user cost ceiling at which Plaid stops being economic at $14.99/mo? We need a guardrail (e.g. "if a user costs >$3/mo in Plaid fees, throttle their refresh rate").
3. **Manual entry path** — keep it? Two paths complicates UX but preserves the privacy-first crowd. My rec: keep, default to "connect bank" but make manual a visible option.
4. **Tax elevation** — is the existing `taxes` bucket already doing quarterly projections, or just acting as a savings bucket? If it's already capable, this is a UI surfacing job not a build job.
5. **Methodology name** — your call. Options to seed thinking: "The Able Method," "The Floor Method," "The Five-Bucket Rule," "The Reservation Method." Or something brand-new.
6. **Methodology rules** — sketch them now? My straw man (steal/rewrite freely):
   - **Know your floor** (bills + tax = the unmissable amount)
   - **Reserve before you decide** (every deposit fills the floor first)
   - **Pay yourself before extras** (smoothing/buffer come before free spending)
   - **Build the buffer before the splurge** (one month of floor in reserve before discretionary)
   - **Score what you did, not what you planned** (monthly score = what actually happened)
7. **Pricing tiered model** (D2 long-term) — open to Starter ($7.99 manual-only) / Pro ($14.99 Plaid+Analyzer+Tax+Coach) / Founder ($99 lifetime grandfather)? This is Phase 5+ but needs early thinking because tiering changes paywall code.
8. **Marketing freeze window** — should we PAUSE all paid ads + new content from Phase 1 start until Phase 4 ships? My rec: yes, except for retention emails and existing organic social. Don't spend acquisition dollars on stale claims.
9. **Other terminal's content cluster work** — keep going during freeze? My rec: pause new content drafts until capabilities skill is updated; existing 2 PYF + 2 business drafts are fine to keep but don't publish.
10. **Make scenario `4869011`** — leave paused per pivot memo? My rec: yes, until Phase 4 caption sweep is done, then activate.
11. **Audit rejections** — anything in my "reject" or "defer" column above that you actually want to fight for?

---

## Locked decisions (filled in as Phase 0 closes)

> Update this section as decisions get made. Once filled, this becomes the contract for Phase 1.

- D1 Plaid scope: _TBD_
- D2 Pricing: _TBD_
- D3 Tax depth: _TBD_
- D4 Household/partner: _TBD_
- D5 Methodology name: _TBD_
- D6 Analyzer scope: _TBD_

---

## How to use this doc

- **Daily:** Open this file at session start. Find current phase. Pick next undone item.
- **Weekly:** Update status check at top. Move items between phases if scope shifts.
- **When tempted to start something out of order:** Re-read "What this protects against." If it violates dependency order, don't start.
- **When scope creeps:** Add to "Bonus deferred decisions" or "Audit rejections" — don't bolt onto current phase.

The plan is a living doc. Edit it. But don't skip the phases.
