# Competitor Feature Audit

Source material: 120 screenshots across YNAB, Monarch, Copilot, Origin, and Rocket Money. Collected 2026-05-01. Able state verified directly from `app.html` on the same date (capabilities skill is stale on Plaid; this doc supersedes it for any conflict).

The goal of this audit is not feature parity. It is to identify, for each surface area of Able, the path of least resistance for a stressed inconsistent-income user. Where Able is already ahead, we say so. Where it is behind, we name the gap and the cost of closing it.

---

## Part 1: Positioning sweet spot

The five competitors map cleanly to four wrong corners and one to aim near.

| App | What they signal | Why it's wrong for Able |
|-----|-----------------|------------------------|
| Origin | Private bank, high net worth | Excludes the freelancer making rent |
| Copilot | Friendly toy with emoji everywhere | Reads cheap, undermines trust |
| Monarch | Polished but methodless | No opinion = no product |
| Rocket Money | Marketplace + cross-sells | Calm-brand poison |
| **YNAB** | **Calm, opinionated, voice-led** | **Closest target, but more guilt-laden than Able should be** |

**Able should sit:** YNAB's calm + lean intake + voice, with Floor-First as the named method, without YNAB's "envelope every dollar before you spend it" rigidity. Closer to Floor-First as a forgiving framework than YNAB's zero-based prescription.

**Concrete style guardrails this audit confirms:**

- Sans-serif headers, never serifs (Origin)
- Category icons stay restrained line-art, not emoji (Copilot)
- The home screen earns its rent for Able's own mechanics; no partner offers, no third-party widgets (Rocket Money)
- Method-first, not feature-first; Floor-First should be visible on day one (Monarch fails this)
- One-question-per-screen onboarding with a thin top progress bar (YNAB's calm secret)

---

## Part 2: Able's current state, ground truth

Verified from `app.html` on 2026-05-01. Plaid is now integrated end-to-end into onboarding and Settings.

### Intake (6 questions, app.html:2731)

1. Welcome ("You're all set. Welcome to Able.")
2. Name + business
3. How you typically get paid (free text)
4. Goals: crush debt / build safety net / balanced
5. Pay yourself % (default 10, optional)
6. Plaid connect (skippable, lookback selector 6/12/24 months)

After Plaid: pipeline runs sync → classify → recurring → analyze → AI plan, surfaced as `obRenderPlanReview`. The user reviews bills and debts the AI extracted from history.

### Navigation (app.html:1279)

- **Allocate** (home): per-deposit allocation, the per-bill reservation engine
- **Plan**: Forecast, Bills, Debt, What-if
- **Score**: monthly grade out of 100 across 5 levers (Bills covered 30, Pay yourself 20, Extra debt 20, Buffer added 15, Living within income 15)
- **More**: Learn, Refer, Settings

### What ships today (verified)

- Plaid connect, lookback 6/12/24, AI plan generation from history
- Per-bill reservations, smart window, monthly auto-rollover
- Coach with full state context (last 10 deposits, per-bill funding map, 3 months history)
- Email reminders (5 toggles); send via `email-cron-daily` Edge Function
- Forecast with Google/Apple/Outlook calendar export of bill due dates
- What-if sandbox for testing income splits
- Score gamification with month history and rollups
- 30-day trial, card required, $14.99/mo or $129/yr

### What is NOT shipped

- Standalone transactions list view in main app
- Ongoing categorization UI (only during onboarding plan review)
- Spending charts beyond Forecast
- Push notifications (only email)
- PWA install / service worker
- Demo mode for prospects
- Subscription cancellation / bill negotiation features
- Net worth or investments tracking

### Things Able is uniquely ahead on

These do not exist in the 5 competitors I reviewed:

1. **Score**, a 100-point monthly grade across 5 levers with month-over-month rollups
2. **What-if sandbox**, type any income and see how it splits with no side effects
3. **Calendar export of bill due dates** to Google/Apple/Outlook
4. **AI Coach with per-bill funding awareness** (knows what's reserved against which bill, not just totals)
5. **AI plan review after Plaid sync** that pulls bills + debts + recurring income from history and asks the user to confirm; YNAB makes you build it manually, Monarch and Copilot don't try
6. **Floor-First as a named method** with public docs; only YNAB has a comparable identity

These should be defended in marketing and not given up to chase parity.

---

## Part 3: Category-by-category audit

Each section follows the same shape: what competitors do, what Able does, the gap, the for/against, the path-of-least-resistance recommendation.

### 1. Intake / onboarding

**Competitors:**

- **YNAB**: 18+ screens, one question per screen, thin top progress bar, illustrations, voice-led. Asks emotional questions first ("what brings you to YNAB"), then household, then debt types, then subscriptions, then "wants" with a "no shame, no guilt" line. Testimonials inserted as breathers after heavy questions.
- **Rocket Money**: 8+ screens before bank connect. Multi-select goals, life-situation, attribution survey, even legal name. Treats intake as a personalization investment.
- **Monarch**: minimal intake, dumps user on a checklist dashboard ("Getting Started 1/5"). Bad result.
- **Origin**: long, but anchored on wealthy framing (tax filing status, dependents, address) and aspirational sample data ($210K net worth).
- **Copilot**: minimal pre-account intake, all teaching happens via coachmarks on the live dashboard.

**Able today:** 6 questions. Plaid does the heavy lifting after.

**Gap recommendation:** add 2 to 3 emotional/personalization questions early, not data-gathering ones. Specifically, before "how do you typically get paid," add a one-screen multi-select: "What brought you here?" with options like "Stop the freezing-up cycle / Plug subscription leaks / Smooth out slow months / Get on top of bills before they hit / Build a real cushion." These map to the three Able personas (Freezer, Leaker, Shame Cycle) and let downstream copy mirror the user's own words.

**For:**

- Cheap to build, high perceived-fit lift
- Captures persona signal that can drive Coach prompts and dashboard headline copy
- Matches YNAB's emotional-first opening, which is the move the user reacted to most
- Fits Floor-First framing (the question maps to floor types)

**Against:**

- Every extra screen is a Plaid drop-off risk
- Rocket Money proves long intake is only worth it if it drives real personalization downstream; if the answer just sits in `profile`, it's overhead
- Adding screens contradicts our "lean intake" advantage if not done carefully

**My take:** add one emotional multi-select question, and only if we commit to mirroring the answer in the post-intake "Your plan" headline and the first Coach message. Skip if we won't wire up the personalization. Two or three more screens of attribution/demographics like YNAB has is not worth the drop-off cost for us; Plaid pulls the data they had to ask for.

**Path of least resistance:** keep one-question-per-screen with the thin top progress bar Able already has, add the multi-select before income, and place a one-line voice reassurance ("No judgment. Pick what feels true.") on the screen with the goals question.

---

### 2. First-run tour / teaching the method

**Competitors:**

- **Copilot**: stacks 5+ tooltips on the live dashboard explaining pace line, spending target, daily review. Real numbers, real screens. Pattern is good; execution stacks too many in a row, modals cover what they explain.
- **Origin**: clean spotlight coachmarks (one at a time, dim background, single highlighted control). Best execution of this pattern across the five.
- **YNAB**: no tour at all. Empty-state-as-teaching: every tab shows a mock card preview of what lives there once data exists. Loading screen is personalized ("our favorite new YNABer") to land the brand voice.
- **Monarch**: a 1/5 Getting Started checklist on the dashboard. Worst pattern, signals "the product is not done until you do work."
- **Rocket Money**: feature-tease screens between intake and bank link (subscriptions, full picture, security). Pre-sells before showing anything. Plus a 3/7 Setup checklist on dashboard.

**Able today:** post-Plaid plan review screen functions as the teaching moment ("here's what I extracted, confirm it"). No coachmarks, no dashboard checklist, no empty-state-as-teaching tour.

**Gap recommendation:** add a single-screen "your floor plan, [Name]" personalization beat immediately after Plaid sync completes, before showing the live dashboard. Then 2 to 3 Origin-style spotlight coachmarks on Allocate teaching: (1) what a deposit allocation is, (2) what reserved-vs-available means, (3) where the Coach lives.

**For:**

- Plaid dropped users onto the live dashboard with no intervention; first impression is "lots of numbers, where do I start"
- The "Building your floor plan, Paul" moment is the cheapest emotional payoff for the work the user just did
- Spotlight coachmarks are the cleanest tour pattern across the five competitors and Origin proves them
- Empty-state-as-teaching (YNAB) only works once we have tabs that are visibly empty pre-data

**Against:**

- Adding tour overhead can feel patronizing; the Plaid plan review already shows the user "we get it"
- Coachmarks always cover the data they explain, that's a real cost
- Power users will be annoyed; need a "skip tour" affordance

**My take:** ship the personalization beat (1 screen, 2 seconds, big win) first. Coachmarks are second priority and only worth building if we observe drop-off after the plan review. Don't ship a 1/5 dashboard checklist. Ever.

**Path of least resistance:** the personalization screen is one HTML template with the user's name pulled from `S.profile.name` and a 2-second auto-advance to home. Total dev cost is a few hours. It buys the same emotional lift YNAB gets from "our favorite new YNABer."

---

### 3. Bank connection

**Competitors:**

- **YNAB**: bank logo grid (popular banks shown big), search, manual fallback. Reviews linked accounts with checkboxes per account, edit per account, balance shown. Success state shows cash-vs-credit split.
- **Monarch**: sync-progress stepper with brand handshake icon (Monarch + Chase logos), checklist of "syncing accounts / transactions / net worth," then full-screen confetti celebration.
- **Copilot**: standard Plaid handoff, no custom polish.
- **Origin**: Earth-from-space metaphor with bank logos orbiting, then "Nice work" success card with ACH disclosure.
- **Rocket Money**: bank constellation hero, then per-account-type tip ("more = better"), pushes investment + brokerage + crypto accounts.

**Able today:** Plaid Link with a privacy notice, lookback selector (6/12/24 months), skip-and-enter-manually escape hatch. Pipeline progress shown via `obAnswers.plaid_pipeline.step` with statuses like "Reading recent transactions / Spotting recurring bills and income."

**Gap recommendation:** Able's pipeline messaging is already richer than competitors'. Wrap it visually. Borrow Monarch's brand-handshake icon (Able butterfly + the bank's logo, both shown during sync) for the pipeline progress card. Replace generic spinner with a 3-step checklist matching pipeline phases: Reading transactions / Spotting recurring items / Drafting your plan.

**For:**

- The pipeline is doing real, expensive work (reading 6 months of transactions and running an LLM); making the wait feel intentional reduces drop-off
- Pulls the bank's brand into the moment, which lowers perceived security risk
- Handshake metaphor makes the connection feel like a partnership, not a data grab
- Cheap to build (the pipeline state machine already exists)

**Against:**

- Don't celebrate the sync with confetti the way Monarch does; the user did not earn anything yet, save the celebration for the first allocation
- Risk of looking like Monarch if not toned down

**My take:** ship the brand-handshake + 3-step checklist, do NOT ship confetti on sync completion. Save confetti or a similar moment for the first deposit allocation, when the user actually gets a payoff.

**Path of least resistance:** the pipeline status display already exists at `app.html:2856`. Replace the text-only step labels with a checklist where completed steps get a check, current step gets a spinner, future steps stay grey. Add the bank's logo (returned by Plaid Link metadata) next to the Able butterfly above the checklist.

---

### 4. Transactions list

**Competitors:**

- **Copilot**: best-in-class. Clean list with auto-categorized pills, search, "Open your month in review" CTA inline. Auto-categorization is implicit (no "review this" friction).
- **Monarch**: emoji per merchant (taco for Tin Roof Tacos, dumbbell for Villa Sport). Scannable but no category labels, no running balance.
- **Rocket Money**: swipe-to-edit transactions (Rename / Tag / Ignore). Fast UX.
- **YNAB**: gated until accounts added; teaser only. Once data exists, table-style with manual category assignment.
- **Origin**: list with "18 LEFT" review queue gamification.

**Able today:** there is no standalone transactions list view in the main app. Transactions only surface during the onboarding plan review. Plaid pulls them, but the user can't browse them after onboarding.

**Gap recommendation:** ship a Transactions sub-tab under Plan, listing all Plaid-pulled transactions for the connected accounts, sorted reverse chronological, with category pill, merchant name, amount. Add it because the user explicitly asked for "drawing out transactions" capability and because the data is already there.

**For:**

- Data already exists in our DB from the Plaid sync; the gap is purely UI
- Required for the Coach to feel grounded in real activity (today the Coach can see deposit history, but the user can't browse the same data the Coach sees)
- Required as a precursor to category 5 (categorization) and category 6 (patterns)
- Without it, Plaid's value is invisible after the initial plan review

**Against:**

- Pure transactions browsing is not Able's job; we're a per-deposit allocation engine, not Mint
- Risk of users using Able as a generic ledger and missing the Floor-First mental model
- Might cannibalize attention from Allocate (the home tab and our differentiator)

**My take:** ship it, but frame it as "Activity," not "Transactions," and surface the Floor-First lens on each row (e.g., "this charge ate into your buffer, here's how"). Position is not "browse your transactions"; position is "see how your money is moving against your plan." Lower-priority than fixing onboarding teaching, but high-priority among missing surfaces.

**Path of least resistance:** add `page-activity` as a Plan sub-tab. List rendering reuses the same patterns as the bills list (`renderBills`). Category badges use restrained line-art icons, never emoji.

---

### 5. Transactions categorization

**Competitors:**

- **Copilot**: best-in-class auto-categorization. The strength is in what's absent (no manual review queue) but the emoji-as-icon system is what makes it read cheap.
- **Origin**: tap a transaction, get a category picker. "18 LEFT" queue gamifies cleanup. Power-user controls (Tag / Hide / Split).
- **Rocket Money**: swipe-to-edit (Rename / Tag / Ignore) is the fastest UX.
- **Monarch**: no visible categorization in the screenshots; transactions show without category labels.
- **YNAB**: manual category assignment, table-style.

**Able today:** during onboarding, the AI plan review shows extracted bills/recurring items and the user confirms or edits them. After onboarding, no ongoing categorization UI exists. The `plaid-recategorize` Edge Function exists (per recent commits) so the backend can re-classify.

**Gap recommendation:** add a one-tap re-categorize control on each Activity row. When user taps the category badge, show a sheet with: keep / move to bill / move to debt / mark as ignored. Save the override to a per-user `category_overrides` table, and feed it back into the recategorize prompt as in-context examples (light personalization).

**For:**

- The user explicitly called out that they like categorization
- Plaid auto-categorization is good but never perfect; one-tap correction is faster than swipe-to-edit
- Category overrides become training data for our recategorize prompt over time
- Required for the Activity tab to feel useful

**Against:**

- Building a categorization UI implies a stable category taxonomy; we don't have one defined yet (Plaid's categories are messy and our "bills/debts/discretionary" lens doesn't map 1:1)
- Risk of users tinkering with categories instead of using the app for its primary purpose
- Adds a back-end concern (storing overrides, applying them on reclassify)

**My take:** Able's lens is bills vs. discretionary, not 30 expense categories. Don't build a generic category picker. Build a 4-button sheet: "this is a bill / this is debt repayment / this is a deposit / this is just spending." That's the entire taxonomy Able cares about, and it maps to the buckets the user already understands.

**Path of least resistance:** the 4-button sheet is one HTML template + a Supabase update. Save user_id, plaid_transaction_id, override_type. The recategorize Edge Function already exists; thread overrides through it next time it runs.

---

### 6. Patterns / insights

**Competitors:**

- **Copilot**: pace line on dashboard (dotted ideal-spend line, solid actual line, over/under flag). Cash-flow YTD with green/red bars. Categories donut + bar list. Genuinely good UI primitive for "are you on track today."
- **Monarch**: cash-flow line chart with multi-month income/expense pills. Clean but useless when empty.
- **Rocket Money**: month-by-month bars with Income / Spend / Net, plus a "you spent 36% more" callout.
- **Origin**: month-over-month line overlay (this month vs. last month, single chart). Sharp comparison view.
- **YNAB**: Reflect tab is gated until data exists; preview shows 4 named reports.

**Able today:** Forecast page shows expected income, 30-day outlook, calendar export. No spending charts, no pace line, no month-over-month visual. Score gives a 100-point monthly grade but is a number, not a chart.

**Gap recommendation:** add Copilot's pace line concept, reframed for Floor-First. The pace line in Able is "your floor over time": daily target burn-rate, actual burn-rate, and the gap. Show it on the home tab as a single 7-day strip, expandable to the full month.

**For:**

- The user specifically asked for "patterns from transactions"
- Pace line is the single most useful visual primitive across the five apps
- Maps cleanly to Floor-First: the floor is the line, your spending is the actual, falling below the floor is the moment Coach should intervene
- No competitor has this framing; it would be a pure win for our brand

**Against:**

- Adds complexity to the home tab, which is currently calm
- Requires daily-level transaction data, which depends on Plaid sync cadence and reliability
- Visualization work always takes longer than expected
- Score is already our daily-engagement hook; a pace line might compete with it for attention

**My take:** ship a minimal version: a single sparkline on the home tab showing the last 7 days of "floor vs. actual." If Score is the lagging indicator (how did this month go), the floor pace line is the leading indicator (how is today going). They complement each other rather than compete.

**Path of least resistance:** SVG sparkline, 60px tall, dotted line for the daily floor (calculated as monthly bills / days in month + a daily discretionary budget), solid line for the actual cumulative spend from Plaid. One number callout: "$X over / under floor today." That's the whole feature.

---

### 7. Bills tracking

**Competitors:**

- **Copilot**: Recurrings tile grid sorted by due-day ordinal (1st, 2nd, 3rd…). Unpaid bills get a bordered tile treatment. Scannable.
- **Rocket Money**: due-soon list with logos and "in 4 days" copy. No mark-paid affordance visible.
- **Monarch**: Recurring is a side menu item. Not surfaced prominently.
- **YNAB**: bills are a category, not a first-class concept. User assigns to "Bills" envelope.
- **Origin**: not strongly featured.

**Able today:** Bills page (Plan > Bills) has manual table entry, mark-paid checkbox, smart window logic, per-bill reservations, frequency support (monthly/weekly/biweekly/custom), monthly auto-rollover. Plaid recurring detection populates this list during the plan review.

**Gap recommendation:** Able's Bills page is functionally ahead of the competition. The improvement is visual scannability. Borrow Copilot's tile grid sorted by due-day ordinal as an alternate view. Default stays as the current table; users can toggle to grid.

**For:**

- The data model is the most sophisticated of the five (per-bill reservations, smart window, virtual occurrences for recurring bills)
- Tile grid makes the cash-flow rhythm of the month visually obvious
- Cheap CSS-only addition

**Against:**

- Adding a view toggle is feature creep if users never use it
- Tile grid loses the "amount reserved" detail that the table shows clearly
- Risk of two views drifting apart in design polish

**My take:** Able is already ahead here. Defer the tile grid. Spend the cycle elsewhere unless user research shows table-fatigue.

**Path of least resistance:** no change. If we ever do it, it's a CSS grid layout reusing the existing bill data structure.

---

### 8. Debt tracking

**Competitors:**

- **YNAB**: asks about debt types in onboarding (multi-select: credit cards, student loans, medical, etc.). Frames debt as a category, not a payoff goal.
- **Rocket Money**: net cash includes debts as negative. No payoff progress views in screenshots.
- **Monarch**: credit cards listed with utilization bars.
- **Copilot**: debt is part of net worth on the Accounts tab.
- **Origin**: not prominently featured in screenshots; mentions equity tracking and tax planning which are HNW-coded.

**Able today:** Debt page (Plan > Debt) shows debts sorted highest-interest-first (avalanche method). Debts are extracted from Plaid history during plan review. Manual entry supported.

**Gap recommendation:** add a payoff progress visualization on the Debt page: total debt at start, current debt, projected payoff date based on extra-debt-payoff bucket percentage. Borrow Origin's Forecast cash-flow line as the visual primitive (single line, month markers, milestone dots).

**For:**

- Able is the only app with an "extra debt payoff" bucket as part of the surplus split; we should make the result of that bucket visible
- Payoff date is the most motivating debt metric and no competitor surfaces it
- Closes the loop on the surplus split for users with debt
- Reuses the same line-chart primitive as the patterns/insights pace line

**Against:**

- Requires accurate balance + interest data, which is harder than it looks
- Plaid balance is current, not historical, so we'd need to snapshot monthly
- Misleading projections (if a user pays less than projected) damage trust

**My take:** ship it, but conservatively. Show projected payoff date with a clear "based on your current pace" label and a low-opacity range, not a single line. Be transparent about assumptions.

**Path of least resistance:** start with a single number ("at this pace, debt-free by [Month YYYY]") on the Debt page, no chart. Chart is phase 2 once we have month snapshots.

---

### 9. Notifications

**Competitors:**

- **Monarch**: native push permissions primer screen with sample notification preview ("Large expense $672 at Costco"). Granular settings (expense alerts, deposits, account disconnected, budget exceeded).
- **Rocket Money**: iOS push permission primer with arrow indicating where to tap. Pre-prompts native dialog cleverly.
- **Origin**: notification permission primer with sample notifications.
- **Copilot**: present but not prominent in screenshots.
- **YNAB**: not prominent.

**Able today:** email reminders only (5 toggles). No push, no PWA install, no service worker. Daily email cron at 9am MST handles bill reminders, low buffer, monthly wrap, dormancy, weekly digest.

**Gap recommendation:** add web push via service worker + push subscription. Mirror Monarch's pattern: a primer screen during onboarding showing a sample Coach notification ("$1,200 deposit detected. Want me to allocate it?") before the native browser permission dialog fires.

**For:**

- The user explicitly called this out
- Email is dying as a notification channel, especially for younger users
- Coach + push is a natural fit (Coach already knows when to nudge, just no delivery channel beyond email)
- Required for the eventual mobile app (the existing PWA install is the bridge)
- Live notification preview during the primer is a clever JTBD demo

**Against:**

- Web push requires a service worker, which Able does not have today
- Browser support is uneven (Safari finally added it, but the experience is worse than native)
- Push notifications are hated when overdone; need restraint discipline
- Real value comes only after we have triggerable events (deposits, bill due tomorrow); we don't have a real-time event stream yet

**My take:** ship a service worker + web push as a milestone, sequenced after the in-app pace line and Activity tab so we have something worth notifying about. The first notification is the deposit-detection one (when Plaid sees a new deposit), since it's high-signal and the user opted into the bank connection. Second is bill-due-tomorrow, which Coach already knows about.

**Path of least resistance:** the service worker is a one-time setup. Web push subscription stored in `push_subscriptions` table keyed on user_id. Trigger from the existing `email-cron-daily` function (rename or duplicate as `notify-daily`) so the same logic that emails also pushes.

---

### 10. Home dashboard

**Competitors:**

- **YNAB**: 5-step checklist + bottom nav + pinned categories. After data: "Assign Your $1,208.03 / Ready to Assign" hero number with "give it a job" copy.
- **Monarch**: net worth chart hero, dashboard exists before data does, getting-started checklist on top. Worst pattern.
- **Copilot**: glanceable dense layout (Budgets, Upcoming bills, Net month, Goals). Pace-line chart up top. Heavy emoji icons.
- **Origin**: net worth + daily market brief widget + 7-day spending bars + budget/credit/investments cards stacked.
- **Rocket Money**: Net Cash + delta vs. last month + spend chart + Setup checklist + cancellable-subs prompt + partner offers.

**Able today:** Allocate page is the home. Bills covered chip, allocate-this-deposit form, recent allocations, Coach surface. Calm and focused.

**Gap recommendation:** Able's home is closer to YNAB's calm than any of the others. Don't add a checklist (Monarch / Rocket Money trap). Don't add net worth (Origin / Monarch trap). Don't add partner offers (Rocket Money trap). The one addition worth making is a 7-day pace line strip (see category 6) above the existing Allocate form, as a leading indicator companion to the Score lagging indicator.

**For:**

- Able's home is already the calmest of the six
- Pace line addition is one small visual element, no layout overhaul
- Maintains the "every dollar gets a job" mental model that YNAB also uses

**Against:**

- Any addition risks clutter
- Pace line could be misread as "spending tracker" which is not Able's positioning

**My take:** add nothing else for now. Pace line is the only candidate and it's gated on category 6 shipping.

**Path of least resistance:** no change today; sequence the pace line for after the Activity tab and categorization sheet ship.

---

### 11. Settings & account management

**Competitors:**

- **Rocket Money**: slide-out menu with refer / chat / demo mode / profile / budget / categories / accounts / log out. "Enter demo mode" is brilliant; lets prospects tour the full app without bank connect.
- **Origin**: profile / membership / AI Financial Profile. "AI Financial Profile" is gimmicky branding.
- **YNAB**: standard settings, account management.
- **Monarch**: comprehensive but ungrouped flat list.
- **Copilot**: standard.

**Able today:** Settings is one of three sub-tabs under More (Learn, Refer, Settings). Categories: Fixed allocations, Planning window, Surplus split, Income sources, Email reminders, Subscription, Account.

**Gap recommendation:** add a "Demo mode" toggle in More that swaps real data for a curated fake dataset (an inconsistent-income freelancer with bills, debts, and a partial deposit history). Worth doing because (1) we will need this for App Store screenshot review, (2) it lowers Plaid hesitancy for prospects, (3) it's a marketing asset.

**For:**

- Solves the App Store screenshot generation problem documented in marketing-footage-workflow
- Massive trust-builder for skeptics; Plaid is the biggest objection in our funnel
- Reusable as a marketing screen recorder source
- Rocket Money proves the pattern works

**Against:**

- Building a curated dataset that looks real but is clearly fake takes design work
- Risk of users mistaking demo data for their own
- Not a top-priority feature for current customers

**My take:** worth it, but it's not blocking; sequence after Plaid stabilizes. Build the dataset as a JSON fixture loaded into local-only state, with a persistent "DEMO MODE" banner across the app so it can never be confused with real data.

**Path of least resistance:** in More, add a "Try demo mode" entry that flips a session-only flag and reroutes `S` reads to the fixture. Banner across the top of every page when the flag is on. No backend involvement needed for v1.

---

### 12. Other (subscriptions, bill negotiation, demo, widget)

**Competitors:**

- **Rocket Money**: subscription cancellation as a flagship feature. Bill negotiation ("90% success rate, lower your Verizon"). Partner offers (life insurance, credit). Concierge cross-sell layer.
- **Copilot**: investments tab, net worth tracking. Goals with multi-month progress dots.
- **Monarch**: investments, equity, real estate, crypto. Net worth as the identity.
- **Origin**: equity, brokerage, will/trust, financial planner on call, tax filing. Concierge for HNW.
- **YNAB**: stays focused on budgeting; no cross-sells.

**Able today:** none of the above. Able is focused on per-deposit allocation, with Coach as the only "service" layer.

**Gap recommendation:** do not chase any of these except potentially a lightweight "subscription scan" feature. Plaid already gives us recurring-charge detection; surfacing them as "here's the streaming services you pay for, in case you forgot one" is a low-cost addition that fits Floor-First (plug leaks).

**For (subscription scan only):**

- The data is already pulled by Plaid recurring detection
- Plugs into the Leaker persona directly
- Low-effort feature with high perceived value
- Marketing hook for ad copy and SEO ("Able found my $87/month in zombie subscriptions")

**Against:**

- Not a cancellation service; we won't actually cancel for the user (Rocket Money's edge here is the concierge, which is a real moat we can't match)
- Risk of looking like a cheap Rocket Money clone
- Adds a tab/page that competes with our core flow

**My take:** ship it as a section inside the Activity tab (category 4), titled "Recurring charges Able spotted." One row per detected subscription with merchant, amount, last charged date. No "cancel for me" CTA; instead a "mark as a leak" tag that becomes a Coach prompt ("you tagged Hulu as a leak last month; cancel it and you save $171/year"). That's our angle, not their angle.

**Path of least resistance:** the recurring detection already fires during the Plaid pipeline. Surface the result on the Activity tab. No new backend, just a new view of existing data.

**Home-screen widget:** parked. Requires native app, which is parked per the App Store launch plan.

---

## Part 4: Sequenced action list

Ranked by leverage-per-day-of-work:

| # | Item | Category | Cost | Leverage |
|---|------|----------|------|----------|
| 1 | "Building your floor plan, [Name]" personalization beat post-Plaid | 2 | Hours | High (emotional payoff for the work the user just did) |
| 2 | Brand-handshake + 3-step checklist during Plaid sync | 3 | Hours | Medium (turns dead time into intentional time) |
| 3 | Activity tab listing Plaid-pulled transactions | 4 | Days | High (data exists, surface does not) |
| 4 | 4-button categorization sheet on Activity rows | 5 | Days | Medium (depends on #3) |
| 5 | Pace-line sparkline on home tab | 6 | Days | High (no competitor has Floor-First framing of this primitive) |
| 6 | Subscription-scan section in Activity tab | 12 | Days | Medium (uses existing recurring detection) |
| 7 | Web push via service worker, starting with deposit-detection | 9 | Days | High (only after #3 ships so we have something to push) |
| 8 | Demo mode toggle in More | 11 | Days | Medium (marketing leverage, App Store gating) |
| 9 | Emotional multi-select question in intake | 1 | Days | Medium (only worth it if we wire personalization downstream) |
| 10 | Debt payoff date estimate on Debt page | 8 | Days | Medium (closes the loop on the debt bucket) |

Items 1 and 2 are afternoon work; items 3 through 10 are project-sized. Items 1, 2, 3, 5, 7 are the ones I'd defend as "do these or fall behind"; the rest are conditional on bandwidth.

---

## Part 5: What we should NOT add

These appeared in competitors and tempted me; they are wrong for Able.

- **Net worth tracking** (Monarch, Origin). Wrong identity for our user; wrong frame for cash-flow decisions.
- **Investment tracking** (Copilot, Monarch, Origin). Same.
- **Bill negotiation / cancellation as a service** (Rocket Money). We don't have the concierge infrastructure and our brand is not "we'll fight your providers for you."
- **Pay-what-you-think pricing** (Rocket Money). Manipulative; Able's brand is calm/honest pricing.
- **Confetti for technical events like sync completion** (Monarch). Cheap-feeling; reserve celebration for user wins.
- **A 1/5 Getting Started checklist on the dashboard** (Monarch, Rocket Money). Signals "the product is not done."
- **Aspirational sample numbers** ($210K NW, $456K projected) (Origin). Excludes our personas.
- **Serif display headers / pure black palette** (Origin). Wrong demographic signal.
- **Emoji-as-category-icon system** (Copilot). Reads cheap.
- **Stacking 5+ coachmarks on the same screen** (Copilot). Tutorial fatigue.
- **Mid-flow paywall before any value is shown** (YNAB does this, surprisingly). Show value first.
- **Partner offers / life-insurance ads on the dashboard** (Rocket Money). Calm-brand poison.

---

## Source files

All screenshots referenced here live at `/Users/pauljohnson/Desktop/Able/Other App Screenshots /[App Name]/` (parent folder name has a trailing space). Rocket Money images are referenced from the resized subfolder; originals are also there. Each per-image observation is in the bucketing tables produced 2026-05-01 and embedded in the session transcript.
