# Meta Ads Manager — pre-launch build spec

**Status:** v1.0, 2026-05-15
**Goal:** Build the full Meta Ads Manager structure (Business Manager → Events Manager → Audiences → Campaigns → Ad Sets → Ads) so the moment Apple approves and creative is rendered, Paul flips campaigns ON without scrambling.
**Scope:** Web subscription acquisition (Stripe checkout). Native app campaigns (App Promotion objective) are out of scope until iOS is approved + App Store listing is live.

**Pre-existing state (verified 2026-05-15):**
- Pixel ID: `940091778831653` — fires on homepage + 3 persona LPs + app
- CAPI: wired through `Able.track()` wrapper with deterministic `eventID` for browser/server dedupe
- Domain verification token: `20idscuzcg232wntazb23qqohcahjl` (homepage only — needs to be confirmed in BM)
- LPs live: `/`, `/scared-to-spend/`, `/money-leaks/`, `/done-feeling-behind/`
- 12 ad hook copy variants already written (paid_ads_infrastructure memory)
- 12 ad creative concepts already written (`docs/ad-creative-brief.md`)

---

## 0. Build order (do these in sequence)

1. Business Manager hygiene check (5 min)
2. Events Manager: verify pixel events + create Custom Conversions + set AEM priorities (20 min)
3. Audiences: build 6 (customer list seed, 3 retargeting, 1 lookalike, 1 exclusion) (30 min)
4. Campaign 1 (Cold Prospecting): 3 ad sets × 3 ads = 9 ads (30 min, ads filled placeholder until creative renders)
5. Campaign 2 (Retargeting): 3 ad sets × 2 ads = 6 ads (20 min)
6. Campaign 3 (Brand search defense, optional): 1 ad set × 2 ads = 2 ads (10 min)
7. Pre-launch checklist run-through (15 min)
8. Pause everything. Wait for iOS approval + creative renders. Flip Cold campaign ON first.

Total build time: ~2 hours of Ads Manager clicking, with ads in placeholder state until production sends finished creative.

---

## 1. Business Manager hygiene

**In Business Manager → Business Settings:**

- **Confirm domain ownership.** Go to Business Settings → Brand Safety → Domains → `becomeable.app`. Should show "Verified" with the meta-tag method. If not, the token `20idscuzcg232wntazb23qqohcahjl` is already in homepage `<meta name="facebook-domain-verification">`. Click Verify.
  - **If it fails:** the LPs (`/scared-to-spend/`, etc.) don't have the meta tag — only the homepage does. Domain verification only needs the apex, so this should still pass. But confirm in the UI.
- **Pixel attribution.** Business Settings → Data Sources → Pixels → Able pixel → Connected Assets. Confirm the ad account is connected. If not, connect it.
- **Conversions API token.** Confirm there's a CAPI access token issued from this pixel (it should be — it's in Edge Function env as `META_CAPI_TOKEN` or similar). If you've rotated tokens, re-check the Edge Function secret matches.
- **Aggregated Event Measurement (AEM).** Business Settings → Data Sources → Pixels → Able pixel → Aggregated Event Measurement. Domain `becomeable.app` should appear once verified. Set the priority order in step 2.

---

## 2. Events Manager setup

**In Events Manager → Pixel `940091778831653` → Overview tab:**

### 2a. Verify the events are firing

Open homepage + each persona LP in incognito and click the CTA. Within 2 minutes the Test Events tab should show:
- `PageView` on every load
- `ViewContent` on every load (with `content_name` = path)
- `Lead` on every CTA click (this is `landing_cta_clicked` mapped to Meta-standard `Lead`)
- Custom event `landing_scrolled` at 50% and 90% scroll depth

Then create a fake account in app and test:
- `CompleteRegistration` after signup
- `InitiateCheckout` after clicking Subscribe in paywall
- `StartTrial` after Stripe redirect-back (deterministic eventID = `capi_<userId>_StartTrial`, fired browser-side and server-side via stripe-webhook)
- `Subscribe` after subscription becomes `active` (eventID = `capi_<userId>_Subscribe`)

**If any event isn't firing browser-side AND server-side:** dedup is broken. Check `Able.track()` wrapper at `app.html:3106-3136`. Each event should appear in Events Manager with **"Browser & Server"** as the source.

### 2b. Create Custom Conversions

Events Manager → Custom Conversions → Create:

| Custom Conversion name | Source event | Rule | Use for |
|---|---|---|---|
| `Trial_Started_All` | StartTrial | URL contains anything | Optimization event for cold ads |
| `Lead_LP_Click` | Lead | URL contains `becomeable.app` | Mid-funnel signal |
| `LP_Scrolled_50_Freezer` | landing_scrolled (depth=50) | URL contains `/scared-to-spend/` | Retargeting source |
| `LP_Scrolled_50_Leaker` | landing_scrolled (depth=50) | URL contains `/money-leaks/` | Retargeting source |
| `LP_Scrolled_50_Shame` | landing_scrolled (depth=50) | URL contains `/done-feeling-behind/` | Retargeting source |
| `Subscribe_Web` | Subscribe | URL contains `becomeable.app` | Long-tail value optimization |

### 2c. Set Aggregated Event Measurement priorities

Events Manager → Pixel → Aggregated Event Measurement → `becomeable.app` → Manage:

Priority 1-8 (most → least valuable):
1. `Subscribe`
2. `StartTrial`
3. `InitiateCheckout`
4. `CompleteRegistration`
5. `Lead`
6. `ViewContent`
7. `PageView`
8. (custom) `landing_scrolled`

Why: iOS 14.5+ caps you at 8 events per domain. Meta only attributes the *highest-priority* event when a user converts via iOS. So the most valuable conversion (Subscribe) needs to be #1, otherwise iOS attribution undercounts.

### 2d. Conversion event for ads

The cold campaign optimizes on **`StartTrial`**. Reasoning:
- It's the actual money-event for Able's funnel (trial means card captured).
- Subscribe fires 30 days later — too long a feedback loop for Meta's ML.
- Lead fires on every CTA click — high volume but low intent, Meta will optimize for click-happy users.
- Once we see ≥50 StartTrials/week per ad set, this is the right grain.

**Bootstrap fallback:** if the first 7 days show <30 StartTrials across all ad sets, temporarily switch optimization to `InitiateCheckout` to give Meta more signal. Document the switch.

---

## 3. Audiences

**In Ads Manager → Audiences → Create:**

### 3a. Customer list (seed for lookalike)

- Source: export current paid customers from Supabase (`profiles where subscription_status in ('active', 'lifetime')`). Hash emails before upload (Meta hashes anyway, but explicit is fine).
- Name: `CL_Customers_Active_2026Q2`
- Use: source for Lookalike. Need ≥100 customers for a usable LAL. If under 100, skip lookalike for now.

### 3b. Retargeting audiences (Custom Audiences from website)

| Name | Source | Rule | Window | Purpose |
|---|---|---|---|---|
| `RT_LP_Viewers_All_30d` | Pixel | URL contains any of `/scared-to-spend/`, `/money-leaks/`, `/done-feeling-behind/` | 30d | Top-funnel retarget |
| `RT_LP_Engaged_30d` | Pixel | Custom event `landing_scrolled` (depth ≥ 50) | 30d | Mid-funnel — interested but didn't click |
| `RT_LP_Intent_14d` | Pixel | `Lead` event | 14d | Bottom-funnel — clicked CTA but didn't trial |
| `RT_Cart_Abandon_7d` | Pixel | `InitiateCheckout` AND NOT `StartTrial` | 7d | Cart abandoners — highest value retarget |

### 3c. Lookalike (only if customer list ≥ 100)

- Name: `LAL_1pct_Customers_US`
- Source: `CL_Customers_Active_2026Q2`
- Country: US
- Size: 1% (tightest match)

### 3d. Exclusion audience (always exclude from cold)

- Name: `EX_Existing_Customers_AllTime`
- Source: Customer list (active + trialing + lifetime + cancelled)
- Purpose: never serve cold ads to anyone who's already touched the funnel.

---

## 4. Campaign 1: Cold Prospecting

**Campaign-level settings:**

- Name: `Cold_Sales_Web_2026Q2`
- Objective: **Sales** (formerly Conversions)
- Buying type: Auction
- **Campaign budget optimization (CBO): ON**
- Daily budget: **$50** (start). Scaling rules in §8.
- Bid strategy: Lowest cost (no cap) — set cost-cap after week 2 once CAC baseline emerges
- A/B test: OFF (single-treatment for first 14 days)
- Special ad category: NONE (this is consumer finance, not credit/employment/housing — confirm with Meta if their classifier triggers; Able is budgeting software, not credit)
- Advantage campaign budget: ON

**Why CBO not ABO:** lets Meta shift budget toward whichever ad set wins. We're not running a strict A/B — we want money to flow to the persona that converts.

### Ad Set 1A — Freezer / Advantage+ Audience

**Ad Set settings:**
- Name: `Freezer_Adv+_AllPlacements`
- Conversion location: Website
- Pixel: Able pixel
- Conversion event: **`StartTrial`**
- Optimization: Conversions
- Cost per result goal: leave blank (lowest cost)
- Budget: inherits from CBO
- Schedule: starts when manually unpaused; no end date
- **Audience controls (Advantage+ Audience):**
  - Suggestions (these guide Meta but don't restrict):
    - Age: 25-55
    - Gender: All
    - Detailed targeting suggestions: Freelancer, Self-employed, Small business owner, Entrepreneur, Content creator, Etsy sellers, Substack, Upwork, Fiverr, Patreon
    - Languages: English (US)
  - Locations: United States only (start)
  - **Exclusions:** `EX_Existing_Customers_AllTime`
- Placements: **Advantage+ Placements (auto)** — let Meta deliver across Reels, Feed, Stories, etc.
- Optimization & delivery:
  - Conversion window: 7-day click + 1-day view (default)
- **Attribution setting:** 7-day click

**Ads in this set (3 total — 1 video + 1 static + 1 carousel):**

| Ad name | Concept (from brief) | Hook (from infra memo) | LP |
|---|---|---|---|
| `F1_15sVideo_WhatsSafe` | F1 — "What's safe to spend?" 15s video | Hook 2A: "You're not bad with money. You're flying blind on income that doesn't follow a schedule." | `/scared-to-spend/` |
| `F2_Static_MoneySitsLeaks` | F2 — "Money that sits, leaks." static | Headline: "Money that sits, leaks." Body: "Built for the paycheck that does not come every two weeks." | `/scared-to-spend/` |
| `F4_15sVideo_ThreeDays` | F4 — "Three days." 15s narrative video | Hook 2C: "The problem was never you. It was the advice you were handed." | `/scared-to-spend/` |

### Ad Set 1B — Leaker / Advantage+ Audience

**Ad Set settings:** identical to 1A except:
- Name: `Leaker_Adv+_AllPlacements`
- Detailed targeting suggestions: same as 1A but emphasize side-income earners and payment-platform users (Stripe, PayPal Business, Square sellers)

**Ads (3):**

| Ad name | Concept | Hook | LP |
|---|---|---|---|
| `L1_15sVideo_Where1000Went` | L1 — "Where did $1,000 go?" 15s video | Hook 3A: "$500 to $1,000 leaks out every month." | `/money-leaks/` |
| `L2_Static_ByThe30th` | L2 — "By the 30th, $500 to $1,000 is gone." static | Headline: "By the 30th, $500 to $1,000 is gone." Body: "A little here. A little there." | `/money-leaks/` |
| `L4_Carousel_LeakHides` | L4 — "Where the leak hides" 5-slide carousel | Cover slide: "Where does $1,000 a month actually go?" | `/money-leaks/` |

### Ad Set 1C — Shame Cycle / Advantage+ Audience

**Ad Set settings:** identical to 1A except:
- Name: `Shame_Adv+_AllPlacements`

**Ads (3):**

| Ad name | Concept | Hook | LP |
|---|---|---|---|
| `S1_15sVideo_NotBadWithMoney` | S1 — "You're not bad with money." 15s video | Hook 4A: "You promise yourself next month will be different. But nothing changes if nothing changes." | `/done-feeling-behind/` |
| `S2_Static_IAmAble` | S2 — "I am able." type-only static (3 rotating variants) | Headline: "I am able to predict what is coming." | `/done-feeling-behind/` |
| `S3_15sVideo_Same31Days` | S3 — "Same 31 days, over and over." 15s video | Hook 4B: "Day 31. Shame. Guilt. Avoidance. Sound familiar?" | `/done-feeling-behind/` |

### (Optional) Ad Set 1D — Lookalike / 1% US

Only spin up if `CL_Customers_Active_2026Q2` has ≥100 seeds.

- Name: `LAL_1pct_AllPersonas_US`
- Custom audience: `LAL_1pct_Customers_US`
- Exclusions: `EX_Existing_Customers_AllTime` + `RT_LP_Viewers_All_30d` (avoid double-serving with retarget)
- Ads: best-performing 3 from 1A/1B/1C after week 1 (don't seed with all 9 — too noisy)

---

## 5. Campaign 2: Retargeting

**Campaign-level settings:**

- Name: `RT_Sales_Web_2026Q2`
- Objective: **Sales**
- Buying type: Auction
- **CBO: OFF** (use ABO — retarget audiences are small and need fixed budget)
- Total daily budget: **$15** (start)

### Ad Set 2A — LP Engaged (mid-funnel)

- Name: `RT_LPEngaged_30d`
- Audience: `RT_LP_Engaged_30d`
- Exclusions: `RT_LP_Intent_14d`, `RT_Cart_Abandon_7d`, `EX_Existing_Customers_AllTime`
- Conversion event: `StartTrial`
- Daily budget: $5
- Placements: Advantage+
- Ads (2):
  - `RT_S1_15sVideo_NotBadWithMoney` — same creative as cold, lets the watcher who got 50%+ of the LP get a re-touch with empathy hook
  - `RT_F2_Static_MoneySitsLeaks` — re-touch with phrase metaphor

### Ad Set 2B — LP Intent (clicked CTA, didn't trial)

- Name: `RT_LPIntent_14d`
- Audience: `RT_LP_Intent_14d`
- Exclusions: `RT_Cart_Abandon_7d`, `EX_Existing_Customers_AllTime`
- Conversion event: `StartTrial`
- Daily budget: $5
- Placements: Reels + Feed only (this segment is high-intent, skip Audience Network)
- Ads (2):
  - `RT_StakeReminder_Static` — new creative: headline "The cost of waiting is $1,000 a month." Body: "30 days free. Card required. Cancel anytime." (NEW asset, add to production list)
  - `RT_S4_Carousel_FiveRules` — Floor-First 5-rules carousel (gives them the methodology to commit)

### Ad Set 2C — Cart Abandon (initiated checkout, didn't trial)

- Name: `RT_CartAbandon_7d`
- Audience: `RT_Cart_Abandon_7d`
- Exclusions: `EX_Existing_Customers_AllTime`
- Conversion event: `StartTrial`
- Daily budget: $5
- Placements: Reels + Feed + Stories
- Ads (2):
  - `RT_CardReassurance_Static` — new creative: headline "30 days free. Card required. No charge until day 31." Body: "You can cancel anytime in Settings." (NEW asset — addresses the most common drop-off reason: card hesitation)
  - `RT_TestimonialPlaceholder` — placeholder for first real customer testimonial when one lands. Until then, use F2 static.

---

## 6. Campaign 3 (optional): Brand search defense

Only spin up if competitors start running ads against "Able app" or "Able budgeting" search.

- Campaign: `Brand_Defense_Search_2026Q2` (Note: Meta has limited search; this is more relevant for Google. Mention in this doc only as a reminder to mirror to Google Ads later.)
- Skip in v1 of the build.

---

## 7. Naming convention (lock this)

So reporting stays clean as the account scales:

- **Campaign:** `[Stage]_[Objective]_[Surface]_[Period]`
  - Examples: `Cold_Sales_Web_2026Q2`, `RT_Sales_Web_2026Q2`
- **Ad set:** `[Persona-or-Audience]_[Targeting]_[Placement]`
  - Examples: `Freezer_Adv+_AllPlacements`, `RT_CartAbandon_7d`
- **Ad:** `[ConceptID]_[Format]_[CopyVariant]`
  - Examples: `F1_15sVideo_WhatsSafe`, `RT_F2_Static_MoneySitsLeaks`

ConceptID maps directly to `docs/ad-creative-brief.md`. Anyone reading the report can trace ad → concept → brief without context.

---

## 8. Budget plan + scaling rules

**Week 0 (build week, this week):**
- All campaigns built, all ads PAUSED. Awaiting iOS approval + creative renders.

**Week 1 (launch):**
- Cold: $50/day CBO across 3 ad sets (Meta distributes)
- Retargeting: $15/day ABO across 3 ad sets ($5 each)
- Total: $65/day = ~$2,000/mo run rate
- Expect: 30-60 trials in first 7 days if cold CPL lands at $30-60

**Week 2 (data-informed adjustments):**
- Pause any ad set with CAC > $80 after 200+ link clicks
- Pause any ad inside an ad set with CTR < 0.6% after 5,000 impressions
- If ANY ad set is delivering trials at <$40 CAC: bump budget +50% (NOT 2x — Meta hates step-changes)
- If overall CAC < $50: scale Cold to $100/day, Retargeting to $25/day

**Week 3+:**
- Set cost-cap bid = current CAC × 1.2 to lock in efficient delivery
- Spin up Lookalike ad set (1D) once customer list ≥100
- Add new creative variants every 2 weeks (Meta fatigues fast on stable creative)

**Hard stops:**
- Pause ALL campaigns if CAC > $150 for 3 consecutive days
- Pause ANY ad set with negative ROAS over 30 days (annual price $129; cost > $129 per Subscribe = bleeding)

---

## 9. Pre-launch checklist (run before unpausing anything)

- [ ] Domain `becomeable.app` shows "Verified" in Business Settings
- [ ] All 8 events showing in Events Manager with "Browser & Server" source
- [ ] AEM priority list set, Subscribe at #1
- [ ] All 6 Custom Conversions saved
- [ ] All 4 retargeting audiences populated (sometimes takes 24h to populate)
- [ ] Customer list `CL_Customers_Active_2026Q2` uploaded; check size
- [ ] Exclusion audience `EX_Existing_Customers_AllTime` uploaded and applied to every cold ad set
- [ ] All 9 cold ads + 6 retargeting ads have final creative attached (NOT placeholder images)
- [ ] All ads point to correct LP URL with UTM tags (`?utm_source=meta&utm_medium=cpc&utm_campaign=Cold_Sales_Web_2026Q2&utm_content=[ad name]`)
- [ ] Ad copy passes brand-script.md sweep: no em dashes, no YNAB phrase, no "first" except floor, no tax/credit overclaim
- [ ] CTA text on every ad is one of: "Start your free trial," "Start free," "Try free for 30 days." Not "Become Able."
- [ ] Trial fineprint visible somewhere on every ad: "30-day free trial. Card required. Cancel anytime."
- [ ] Test Events tab shows 0 errors when you click each ad's preview through to LP and CTA
- [ ] Stripe checkout still works (test in incognito with a test card)
- [ ] App is in App Store OR campaign is web-only (no App Promotion ads if app isn't approved yet)

---

## 10. Launch day → week 1 monitoring plan

**Day 0 (launch):**
- Unpause Cold campaign in the morning, your time
- Check Events Manager every 2 hours for the first 8 hours: confirm events firing on real ad traffic
- Watch Ads Manager: any ad with "Limited Delivery" status by hour 6 = check audience overlap or budget cap

**Day 1-3:**
- Daily check: total spend, CPM, CTR, CPC, CPL, # trials, CAC
- Don't touch anything for 72 hours unless it's catastrophically off (CPM > $50, CTR < 0.3%)

**Day 4-7:**
- Compare ad sets: which persona is winning?
- Compare ads within the winning ad set: which format (video vs static vs carousel)?
- Note: Meta needs ~50 conversions per week per ad set to exit "Learning" phase. If we're not there, the data isn't statistically meaningful yet.

**Day 7 review:**
- Cut bottom-quartile ads (lowest CTR or highest CPL)
- Brief production on next-cycle creative based on what won
- Add 2-3 new ad variants to keep ad set fresh

---

## 11. What NOT to do (common cold-traffic mistakes)

- ❌ Don't run multiple campaigns with overlapping audiences — they cannibalize each other in the auction. Use exclusions liberally.
- ❌ Don't use Engagement, Reach, or Traffic objectives. Sales objective with conversion event is the only path to qualified buyers.
- ❌ Don't optimize for `Lead` (CTA click) for more than 2 weeks. The model trains on click-happy users, not buyers. Migrate to `StartTrial` ASAP.
- ❌ Don't pause campaigns to "let the data settle" — Meta restarts learning every time you unpause. Edits to ad sets restart learning. Be patient or be permanent.
- ❌ Don't manually pick interests in 2026 — Advantage+ Audience consistently beats hand-stacked interest sets. Use the suggestion field, not the strict-targeting field.
- ❌ Don't write ads with "we" or "our team" — locked brand rule. Customer is the hero.
- ❌ Don't use the brand-search/competitor-name targeting on Meta — Meta isn't a search engine. Save that for Google.
- ❌ Don't run iOS-app-install ads until App Store listing is live. The conversion event won't fire and budget bleeds into nothing.

---

## 12. Open items to resolve before unpause

1. **GA4 measurement ID** still placeholder. Paste `G-XXXXXXXXXX` into all 4 LP files when issued.
2. **Google Ads conversion label** still placeholder. Paste into `GTAG_CONVERSIONS.landing_cta_clicked`.
3. **Two new retargeting creatives needed:** `RT_StakeReminder_Static` and `RT_CardReassurance_Static`. Add to production handoff list.
4. **First customer testimonial** — `RT_TestimonialPlaceholder` is reserved. Source from first 25 paying customers.
5. **Confirm consumer-finance ad classification.** When the first ad goes through Meta review, watch for "Special Ad Category" prompts. Able is software, not credit, so it should clear — but document if it gets flagged.

---

## 13. Quick map: brief concepts → ads in this build

| Brief ID | Format | Ad slot in this build |
|---|---|---|
| F1 | 15s video | Cold 1A primary |
| F2 | static | Cold 1A + Retarget 2A |
| F3 | static (comparison) | Held — add as fresh creative cycle 2 |
| F4 | 15s video | Cold 1A |
| L1 | 15s video | Cold 1B primary |
| L2 | static | Cold 1B |
| L3 | 15s video | Held — add as fresh creative cycle 2 |
| L4 | carousel | Cold 1B |
| S1 | 15s video | Cold 1C primary + Retarget 2A |
| S2 | static (3 rotators) | Cold 1C |
| S3 | 15s video | Cold 1C |
| S4 | carousel | Retarget 2B |

---

**Closing reminder:** every ad's last frame is the brand stripe + "Become Able." seal. CTA button text is always action-clear ("Start your free trial"). Never put "Become Able" on a button.
