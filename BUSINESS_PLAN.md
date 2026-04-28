BUSINESS PLAN · V1.0 · INTERNAL + INVESTOR READY

# able.

## the business plan

### from holding your breath with bills to finally able to breathe.

confidential
do not distribute without permission

paul johnson
founder

---

## contents

> this document serves three audiences: founder/advisors (internal working doc), investors (fundraising), and mentors/partners (strategic review). financial projections are placeholders based on industry benchmarks for early-stage consumer SaaS and flagged for easy editing when real cohort data arrives.

| # | section | page |
|---|---|---|
| 01 | executive summary | 3 |
| 02 | the company | 6 |
| 03 | the opportunity | 9 |
| 04 | the product | 13 |
| 05 | go-to-market | 17 |
| 06 | operations | 21 |
| 07 | financials + funding ask | 24 |
| 08 | risk + mitigation | 29 |

> **HOW TO USE THIS PLAN**
>
> when the plan is shared with investors, lead with sections 1, 3, 5, and 7. when shared with mentors, lead with sections 2, 4, and 8. when used internally for decisions, every section matters. a companion financial model spreadsheet lives alongside this document where all numbers can be edited and updated dynamically.

---

# 01 · executive summary
*the whole plan, in one page*

## able, in brief

able is a budgeting app built for people whose income doesn't arrive on the same day every two weeks — freelancers, creators, contractors, and small-business owners. the product runs on one mechanic: every time a deposit lands, able splits it across the buckets that actually matter (taxes off the top, bills reserved by name, then pay-yourself, debt, buffer, and free spending) so the user can see — within seconds of money arriving — what is theirs to spend, what is already promised, and what is being protected for the next bill or the next slow month.

the rest of the category teaches W-2 budgeting to 1099 income. able teaches a different shape of money to its actual shape: irregular in, regular out. the brand promise is the whole story: **from unable → able**.

### THE OPPORTUNITY

over **70 million** americans do independent work in a given year (MBO Partners State of Independence, 2024). roughly **10 million** are full-time self-employed (BLS). the creator economy adds another sizable cohort with comparable income volatility. the budgeting tools they have access to — YNAB, Monarch, Copilot, Rocket Money, the long tail of spreadsheets — were built around predictable paychecks. mint sunset on march 23, 2024, leaving the largest soft user base in the category looking for a new home, almost none of which fits variable-income workflow. the intersection of variable income + envelope-style allocation + AI guidance + emotional permission is empty. able is positioned to claim it.

### THE FOUNDER

able was founded by paul johnson, a solo founder who built the product because he kept watching friends earn well and still feel poor — freezing on deposits, leaking by the 30th, and blaming themselves for a tooling mismatch. the brand rules out blame. the product rules out paralysis. paul ships, writes the marketing, runs the brand. (full bio in section 2.)

### THE PRODUCT

a web app at **becomeable.app**. core mechanics:

- **per-deposit allocation engine** with a fixed split order (bills → pay yourself → debt → buffer → free; taxes off the top)
- **plaid at launch** — auto-detect deposits, balance read, auto-mark-paid bills (base tier)
- **method finance** at the plus tier — wallets that hold reserved money separately *and* pay bills from inside the app
- **AI coach** with full state context — every bill, every reservation, last 10 deposits, history, forecast — built on the anthropic api
- **per-bill reservations** that rollover each month so set-aside money is never re-used
- **smart planning window** (7/14/21/30 days) so reservations match how the user actually pays

> **THE STRUCTURAL MOAT**
>
> no other budgeting app connects bank accounts, *holds reserved money in actual wallets for safekeeping*, and *pays bills from inside the app*. YNAB tells you what to set aside — it doesn't move money. Monarch and Copilot show your spending — they don't reserve. Rocket Money negotiates bills — it doesn't allocate. Able is the first product to close the loop end-to-end: see the deposit, allocate it, hold it, spend it on the bill, all inside one workflow.

### THE GO-TO-MARKET

content-led. paul has shipped a 175-piece social library, a 60-second cinematic reel, an active make.com cross-posting scenario across IG/FB/LinkedIn, an SEO content engine with a pillar/cluster taxonomy underway, and a behavioral email system that fires on real product signals. paid ads are gated until organic baselines are clean. the ambassador-equivalent for a SaaS like able is the referral program (already active from day 1 of trial).

### THE FINANCIAL SNAPSHOT

| CAPITAL POSTURE | YEAR 1 ARR TARGET | TARGET CONTRIBUTION MARGIN |
|---|---|---|
| **bootstrap-first** | **$240,000** | **~90%** |
| product is shipped and self-funded; open to strategic capital, not dependent on it | ~1,000 paying subs at blended ~$20/mo ARPU across three tiers | software economics with plaid + method per-sub costs absorbed |

> **PLACEHOLDER FLAG**
> all financial numbers in this plan are projections built from industry benchmarks for comparable early-stage consumer SaaS plus per-sub integration costs (plaid, method). when real funnel data, churn cohorts, tier mix, and CAC by channel arrive, these get replaced. see section 7 for full model and assumptions.

---

# 01 · executive summary (cont.)
*why now, why us, why this*

### WHY NOW

three trends collided in 2024.

1. **mint sunset.** intuit shut mint on march 23, 2024. a category-defining tool exited and its users are still resettling. the largest existing budgeting audience is in motion.
2. **the variable-income workforce is the fastest-growing labor cohort.** independent work has grown ~7% YoY since 2020 (MBO Partners). the creator economy projects past 480 million people globally by 2027 (Goldman Sachs). neither cohort is well-served by paycheck-budgeting orthodoxy.
3. **AI cost has crossed the line where a personalized coach is a feature, not a moonshot.** with claude haiku tier inference, an always-available financial coach can be served at cents per active user per month. the product wedge — "your money has an advisor that knows what's reserved for which bill" — was uneconomic two years ago.

### WHY US

paul didn't build able because he saw a market opening. he built it because the same conversation kept happening with friends who earned well and still felt broke. the brand voice — short sentences, plain language, no em dashes, no blame — comes from being inside that pattern, not studying it from the outside. able's design system, brand voice, copy library, and content engine are all internally consistent because one person owns them. the speed advantage of a single-founder, full-stack operator is real and will compound until product-market fit is locked.

### WHY THIS WILL WORK

- **no direct competitor** in the variable-income + envelope + AI-coach intersection. YNAB is the closest analogue and explicitly assumes paycheck cadence in its workflow.
- **the per-deposit allocation engine is the moat.** any tool can copy the UI. very few will rebuild around the underlying model — bills as named reservations, surplus as a deterministic waterfall, residual auto-routes to debt — because doing so requires giving up the W-2 assumption that anchors most product roadmaps.
- **the brand is honest in a category that has been performative for decades.** "the problem was never you. it was the advice you were handed." that line is the entire brand and it converts because it is true.
- **AI coach with real state.** the coach can see exact per-bill reservations, the last 10 deposits, the buffer's trajectory, and the forecast. it's not a wrapper around a chat box. it's a window into the user's own money model.
- **scalable from $0 to seven figures with minimal overhead.** SaaS economics, no inventory, no fulfillment, single-founder operator until ~$500K ARR.

### CAPITAL POSTURE

able is **not actively fundraising.** the product is shipped, the brand is built, the content engine is running, and 6 months of social content is queued and scheduled. the company is positioned to bootstrap to multimillion ARR on cash-flow economics.

the door is open for *strategic* capital — partners who can compound the GTM (creator-economy networks, podcast hosts, accounting/freelance platform leadership, fintech integration partners) or de-risk a specific bottleneck (paid acquisition stress-test, plaid/method integration cost). a clean cap table and a simple SAFE structure (see section 7) makes that path frictionless if the right partner appears, but it is not the plan.

at projected year 1 performance, able crosses break-even on a per-sub contribution basis from sub #1 and reaches operational break-even on founder draw + cloud + AI + integration costs around month 9–11. year 2 projects the transition from founder-only operation to first hire. year 3 projects the scale decision point — disciplined bootstrap continuation, strategic partnership, or optional growth round.

---

# 02 · the company
*what able is*

## what able is

able is a budgeting app for people with inconsistent income. one founder, one product, one promise: **from unable → able**. the brand is built on the conviction that variable-income earners aren't bad with money — they were handed advice for a different shape of income and asked to feel ashamed when it didn't fit.

### THE MISSION

to give every freelancer, creator, and small-business owner a calm, specific, second-by-second sense of what their money is for — so they can stop holding their breath when bills land, stop leaking by the 30th, and start shipping their work without the financial fog underneath it.

### THE BELIEF

> the problem was never you. it was the advice you were handed.
> able is the system built around the actual shape of your income — irregular in, regular out — so you can see what every dollar is for the moment it arrives, and so the next bill, the next quarter, and the next slow month are already accounted for before they show up.

### VALUES

- **plain over polished.** short sentences. no em dashes. no jargon. real specifics over rounded claims.
- **calm over hype.** the brand speaks in a lower register than the category. no FOMO, no countdown timers, no "transform your finances forever" promises.
- **customer is the hero. able is the guide.** copy that puts the user in the driver's seat. the tool never narrates itself.
- **honest mechanics.** what the product does, the marketing says. what the product does not do, the marketing does not promise. an internal "app capabilities" document is the canonical reference and content gets fact-checked against it before it ships.
- **permission, not blame.** every pain frame is paired with permission. "you froze. that's a normal response to uncertainty. here is the system that makes it stop happening."

---

# 02 · the company (cont.)
*origin + structure*

### ORIGIN STORY (THE SHORT VERSION)

able started from a pattern paul kept seeing — friends earning well and still feeling broke. one was a designer who'd freeze on a deposit because she didn't know when the next one was coming, and by the time she touched it the bills had already drained it. another was a contractor leaking $500–$1,000 a month in small charges and unable to explain where any of it went. another talked about q4 like it was a tax-bill mugging that happened to him every year.

these were three different problems sharing the same root cause: budgeting tools that assume paycheck cadence, applied to income that doesn't have one. the patches each person had built — a spreadsheet, a sticky note on the bathroom mirror, a dread-spiral on the 31st — were heroic and unmaintainable.

able is the unpatched version. one workflow built around the actual shape of variable income: bills get reserved by name, taxes come off the top, surplus splits in a fixed order, the AI coach answers "what does this deposit mean for me?" with the user's real numbers in front of it. the whole product follows from that single mechanic.

### LEGAL STRUCTURE (PLANNED)

| | |
|---|---|
| entity type | LLC (Limited Liability Company) |
| state of formation | *placeholder — confirm at funding close* |
| ownership | 100% paul johnson at formation |
| tax election | default pass-through LLC; revisit S-corp election at $100K+ revenue |
| headquarters | *placeholder — confirm at funding close* |

> **PLACEHOLDER FLAG**
> LLC formation, operating agreement, and state of formation are on the master task list. expected completion within 30 days of funding close.

### THE TEAM

able launches as a single-founder operation. early contractors are limited and only on demand:

- **brand video / motion** — remotion-rendered reels are produced in-house; outsource only for stuck pipeline ($300–$800/project)
- **photography / b-roll** — minimal, mostly screen-recorded product footage via a custom playwright + ffmpeg pipeline already shipped
- **fractional bookkeeper** starting month 6 ($150–$250/mo)
- **paid ads operator** at month 9 if scale demands ($1,500–$3,000/mo retainer)

first full-time hire projected in year 2 after PMF is locked: likely a full-stack engineer or a content/community lead, depending on whichever is the binding constraint at that point.

### THE FOUNDER

paul johnson. solo founder. ships product, writes copy, designs the brand, runs the content engine, talks to users. background combines product/engineering with brand and content production — the rare combination that makes a single-founder consumer SaaS viable through pre-PMF.

### WHY SOLO, FOR NOW

a co-founder is real overhead at this stage and the work hasn't yet split cleanly along skill lines. the right co-founder for able is a quantitative growth operator or a finance-product specialist, neither of which is a near-term need. structure of the company will absorb a co-founder if the right person appears; the cap table is intentionally clean to make that easy.

---

# 03 · the opportunity
*market, customer, positioning*

## the market

### THE VARIABLE-INCOME WORKFORCE

- **70+ million** americans did independent work in 2024 (MBO Partners *State of Independence*).
- **~10 million** are full-time self-employed per BLS — the cohort with the most acute need.
- **gig workers** (rideshare, delivery, on-demand): ~16 million in the US.
- **creator economy:** ~50 million globally in 2024, projecting past 100 million by 2030 with US accounting for the largest paid cohort (Goldman Sachs, 2023).
- **growth rate:** the independent workforce has grown ~7% YoY since 2020 — meaningfully faster than total labor force growth.

### THE BUDGETING SOFTWARE MARKET

the personal finance software market is a multi-billion-dollar category. Mint shut down on march 23, 2024 with reports of 20–30M registered users, the largest user base in the category, leaving a redistribution event still in progress. paid budgeting SaaS leaders (YNAB, Monarch, Copilot, Rocket Money, EveryDollar) sit in the $5–$15/mo range and have collectively been adding subs faster than any year on record because of the mint exit.

### THE INTERSECTION IS EMPTY

every existing budgeting tool teaches W-2 budgeting to 1099 income. the workflow they prescribe — categorize last month's spending, set a category budget for next month, watch progress bars — assumes a known monthly inflow. for variable-income workers, that workflow fails on first contact with reality:

- you can't budget against a month when you don't know the month's income.
- categorizing last month's leak doesn't stop next month's leak.
- the emotional load of "i missed budget again" creates avoidance, which creates the leak.

able is the first product designed around the *moment of deposit* rather than the *categorization of spending*. when money arrives, every dollar gets a job. the difference is structural, not cosmetic.

> able is the first budgeting app built for people whose income doesn't arrive on the same day every two weeks — and whose mental model of money has to start at the deposit, not at the spend.

### ADDRESSABLE MARKET (CONSERVATIVE ESTIMATE)

- US full-time self-employed: ~10M
- US creators with $1K+/mo earnings: ~5M
- US gig + 1099 + commission earners with consistent monthly income: ~15M
- conservative target segment (full-time self-employed + serious creators + 1099 with budget urgency): ~10–12M
- TAM at ARPU of $130/yr (annual price): **$1.3B–$1.5B**
- SAM (US, addressable through digital marketing): **$400M–$600M**
- SOM (5-year realistic capture at 1–2% of SAM): **$5M–$12M ARR**

> **SOURCE NOTE**
> market sizing figures are directional estimates based on publicly available data from MBO Partners, BLS, and Goldman Sachs creator economy research. real first-party customer research will refine these in year 1.

---

# 03 · the opportunity (cont.)
*the customer + competitive landscape*

## the target customer

able's customer research has produced three working personas, each rooted in language pulled directly from real conversations and from competitive review mining. most users blend two of them.

### PRIMARY PERSONA: THE FREEZER

a graphic designer or developer earning $80K–$160K through 4–8 monthly invoices. when a deposit lands, she doesn't allocate it. she leaves it in checking and tells herself it's "safer untouched" because she doesn't know when the next one is coming. her core driver is paralysis under uncertainty. her pattern: bills come due, the frozen money has to thaw at the wrong time, the buffer she meant to build never materialized. her quote: *"when a deposit hits, i don't know when the next one is coming, so i just don't touch it."* she's the highest-LTV able customer because the product solves her exact failure mode on first use.

### SECONDARY PERSONA: THE LEAKER

a creator or contractor earning $4K–$15K/mo who knows roughly what's coming in but has zero visibility on where it goes. she's tried mint, ynab, copilot. categorizing felt like homework; she gave up. her quote: *"by the 30th, $500 to $1,000 is gone and i genuinely don't know where."* she converts on the *forecast* — seeing what every dollar is *for* before it leaks.

### TERTIARY PERSONA: THE SHAME CYCLE

aware of the problem. promises herself "next month." doesn't change the system. her quote: *"i just need to be more disciplined."* she converts on permission framing in able's brand and on the small wins the product engineers in the first session — the moment a deposit becomes a clean allocation is the moment her system changes.

## the competitive landscape

| competitor | category | why they're not able |
|---|---|---|
| **YNAB** | envelope budgeting, $14.99/mo | nearest analogue. assumes paycheck cadence. heavy upfront setup. learning curve famously steep. workflow centers on "give every dollar a job" but applied to a fixed monthly inflow. |
| **Monarch** | dashboard budgeting, $14.99/mo | beautiful dashboards, plaid-first. positioned as Mint successor. workflow is "see your spend, categorize it." not built for variable income, no allocation engine, no AI advisor with real state. |
| **Copilot** | Apple-first dashboard, $13/mo | strong design, AI categorization. spending-side, not income-side. assumes paycheck cadence in its monthly views. |
| **Rocket Money** | bill-tracker + budget, freemium | bill negotiation is the headline feature. budgeting is secondary. doesn't address variable income. |
| **EveryDollar** | Ramsey-flavored zero-based, freemium | simple zero-based budget. religious tone is a feature for some, a turn-off for others. assumes a single monthly income. |
| **Mint (sunset)** | free dashboard | shut down march 23, 2024. its 20–30M users are still resettling. |
| **Excel / Google Sheets** | DIY | the largest "competitor" by user count. heroic but unmaintainable. fails the moment income volatility spikes. |
| **financial advisors / accountants** | service | high quality, low frequency. doesn't replace daily allocation decisions. |

### ABLE'S DEFENSIBLE POSITION

the moat is not the UI. it's the model.

1. **the per-deposit allocation engine.** any product can copy the screens. very few will rebuild the underlying data model — bills as named reservations, taxes off the top, deterministic surplus waterfall, residual auto-routes to debt — because doing so requires abandoning the categorize-spending paradigm. competitors are anchored to a different mental model and changing it would invalidate years of UX investment.
2. **AI coach with real state.** the coach reads the user's exact reservation map, last 10 deposits with per-bill funding breakdown, last 3 months of history, and forecast. it's not a chatbot bolted to a budget. it's a financial advisor that knows where every dollar is at this exact moment. as inference cost continues to fall, the gap between "coach with real state" and "coach as wrapper" widens.
3. **brand voice.** the category has been performative for decades — hype, fear, gamification, blame. able's brand discipline (short, plain, no em dashes, no blame, customer-as-hero) is documented in an internal brand skill and applied uniformly across product, ads, social, email, video, and SEO. it is hard to copy in spirit even when it's easy to copy in font choice.
4. **content compounding.** by the time a competitor identifies the variable-income wedge as worth pursuing, able will have shipped 6–12 months of pillar/cluster SEO content, a 175+ piece social library (already shipped), and a behavioral email system tuned to product signals. the SEO/content moat is slow but real.

---

# 04 · the product
*what we make, how it's different, roadmap*

## the product

able is a web app at **becomeable.app**. (PWA-installable; native apps planned for year 2.) the product is built around a single mechanic — the per-deposit allocation engine — surrounded by the smallest set of features needed to make that mechanic load-bearing.

### THE PER-DEPOSIT ALLOCATION ENGINE (FLAGSHIP)

every time the user logs a deposit, able runs a deterministic split:

1. **fixed allocations (off the top)** — taxes, contractor pay, owner draws as percentage rules
2. **bills (reserved by name)** — every upcoming bill in the planning window gets its required reservation
3. **surplus split** — whatever remains is divided across four buckets in fixed order:
   - **pay yourself** (`ownerPct`) — the most-skipped step in self-employment, made automatic
   - **extra debt payoff** (`debtPct`)
   - **savings / buffer** (`bufPct`)
   - **yours to spend freely** (`freePct`)
4. **residual** — anything unallocated rolls to debt by default

defaults: 20% debt, 15% buffer, 5% free, 0% owner pay (user is prompted to set this during onboarding). sum must be ≤ 100. the sliders are the only piece of the system the user adjusts day-to-day.

### KEY MECHANICS

- **per-bill reservations** — every bill has a stable id, and reserved money is tagged to that id. when the bill is paid, the reservation releases. unpaid bills hold their reservation through month-end.
- **smart planning window** — user-configurable window of 7/14/21/30 days controls which bills the next deposit reserves against. matches the cadence of how the user actually pays.
- **monthly auto-rollover** — paid flags clear at the start of a new calendar month, but reservations preserve so set-aside money rolls forward.
- **forecast** — user enters expected income with a date; the dashboard shows projected coverage and shortfall at the granular bill level.
- **timeline modal** — every deposit and every bill on a single chronological view; tap a row to mark paid, edit, or open allocation history.
- **score** — five habit metrics tracked monthly: bills coverage, debt progress, buffer growth, paid-yourself, within-income. a single composite score makes "am i actually getting better?" a daily-readable answer.

### THE AI COACH

a chat surface. every conversation starts with full state injected as context — bills, debts, settings, sources, obligations, dashboard headline numbers, per-bill reservations, the latest 10 deposits with funding breakdown, last 3 months of history, forecast. the user can ask anything from "is it safe to spend $400 this week?" to "what should i do with this $5K commission?" and the coach answers using their real numbers.

three proactive nudges fire on real signals:
1. owner pay percentage is 0 but income is being logged
2. buffer low and a bill is due soon
3. no income logged in 14+ days

dismissed nudges hide for 12 hours. the coach is advisory — it does not move money. the user is always the actor.

### TRIAL + SUBSCRIPTION

- **7 days free.** card required. no charge until day 8.
- trial users get full app access from day 1, including the active referral state
- billing handled through stripe; subscription portal for self-serve upgrade/downgrade/cancel
- pricing structured as three tiers (see next page)

### WHAT IS NOT (YET) IN ABLE — DELIBERATELY

- **spending tracking.** income-side first. spending-side will be a separate product surface, not a feature retrofit, when it ships.
- **multi-user / household budgets.** single-user product through year 1.
- **tax filing.** able tells you what to set aside. it doesn't file. integration with a tax product is on the year-2 partnership list.

restraint here is intentional. each of those features adds drag to the per-deposit mechanic. shipping them prematurely is how budgeting tools become the tools they're supposed to replace.

---

# 04 · the product (cont.)
*pricing + roadmap*

## pricing strategy

three tiers. each tier is a real capability jump, not a feature gate. the user upgrades when they want the next layer of automation, not because we paywalled an old feature.

### LAUNCH PRICING (THREE TIERS)

| tier | price | what's included | gross margin (est.) |
|---|---|---|---|
| **Essential** | **$14.99/mo** or **$129/yr** | per-deposit allocation engine · AI coach with full state · per-bill reservations · smart window · forecast · score · **plaid: auto-detect deposits, balance read, auto-mark-paid** | ~93% |
| **Plus** | **$29.99/mo** or **$299/yr** | everything in Essential · **method finance: wallets that hold reserved money separately · pay bills from inside the app · ACH transfers between buckets** | ~87% |
| **Pro** *(future)* | **$49.99/mo** or **$499/yr** | everything in Plus · **array: credit dispute + monitoring · identity protection · annual financial health report** *(roadmap; ships year 2)* | ~84% |

trial: 7 days free at any tier. card required. no charge until day 8.

> **PRICING RATIONALE**
>
> Essential is priced at YNAB parity ($14.99/mo) — strategic alignment with the closest analogue's price perception, and the price the variable-income cohort has been conditioned to accept for budgeting software. Plus at $29.99/mo is priced against the value of the workflow it replaces (the user no longer logs into their bank to pay bills, no longer wonders if reserved money is truly separate, no longer needs a second checking account "for taxes"). Pro at $49.99/mo positions Able as a complete financial-health stack — comparable to what users currently pay for a budgeting app + credit-monitoring service + identity protection bundled. annual prices encode "two months free" framing across all tiers.

### THE STRUCTURAL DIFFERENTIATOR (RESTATED)

> no other budgeting app does all three: connect bank accounts, hold reserved money in actual wallets, and pay bills from inside the app.

- YNAB: tells you what to set aside. doesn't move money.
- Monarch / Copilot: dashboards on top of plaid data. don't allocate, don't reserve in wallets, don't pay bills.
- Rocket Money: bill negotiation + auto-pay tracking. doesn't allocate or reserve.
- Mercury / Relay (business banking): wallets, but not budgeting tools.
- **able: closes the loop.** see the deposit → allocate it → hold reserved money in a wallet → pay the bill from the wallet. one workflow, one app.

method finance is the integration that unlocks this. it's a real fintech infrastructure layer (not a screen-scrape), and it's what lets able's "every dollar gets a job" promise become "every dollar gets a job *and goes to the right place*."

### PRODUCT ROADMAP

able's roadmap is gated by what compounds the existing engine, not what diversifies away from it.

- **LAUNCH (Essential tier) · plaid integration.** balance read, auto-detect deposits, auto-mark-paid bills. ships at launch. base tier.
- **LAUNCH (Plus tier) · method finance integration.** wallets for reserved money. bill pay from inside the app. ACH transfers between buckets. plus tier.
- **YEAR 2 (Pro tier) · array integration.** credit dispute + monitoring, identity protection, annual financial health report. pro tier.
- **YEAR 2 · native mobile.** iOS and android. PWA shipped first; native ships when mobile install rate justifies the build.
- **YEAR 2 · tax season module.** quarterly estimated tax workflow with export-ready packets. partnerships with tax-filing products evaluated at this stage.
- **YEAR 3 · multi-user / household.** spouse/partner shared allocations. requires meaningful permission-model rework.

### IDEAS FOR FUTURE (UNCOMMITTED)

surfaced from customer research and competitive whitespace; would be evaluated against the per-deposit mechanic before any commitment:

- **business entity layer** — separate "business able" + "personal able" workspaces with internal transfers (high-leverage for the freelancer-LLC cohort)
- **invoicing integration** — pull from stripe / wave / harvest so deposits arrive with their source attached
- **tax filing partner** — keeper, collective, or similar; revenue share, not a build
- **debt payoff strategy module** — avalanche/snowball calculator with payoff projections fed by allocation data
- **savings goals as named wallets** — "house down payment," "q4 estimated tax," each with a target and trajectory
- **emergency override** — a one-tap "this is a slow month" mode that auto-rebalances reservations from buffer with the user's approval
- **collaborative coach** — share a one-time coach session with an accountant or financial advisor

### THE REFERRAL SYSTEM

every trial user gets an active referral code from day 1 (shipped 2026-04-26). a successful referral grants the inviter a billing credit and the invitee a 7-day extended trial. structure rewards the user's natural sharing impulse without paying a percentage of subscription revenue. mechanics will be tuned against real referral cohort data in year 1.

### MISSION TIE-IN (PROPOSED)

a percentage of every subscription (proposed: 1%) routes to financial-literacy education partners — ideally one that serves first-generation freelancers and immigrant entrepreneurs, the cohort with the highest variable-income exposure and the lowest access to professional advice. this is not a marketing add-on; it's part of why the brand exists. structure to be formalized in year 1.

---

# 05 · go-to-market
*how we launch and grow*

## go-to-market strategy

### POSITIONING PRINCIPLE

able's customer doesn't search for "budgeting app for inconsistent income" until she's already aware that her income is the reason every other budgeting app failed her. the work is to *name* the felt experience first — the freeze, the leak, the day-31 shame — so that when she searches, she searches for *us*. that shifts the marketing philosophy: **content leads, product follows.** we don't sell. we name what's been happening and let the product be the answer.

### THE LAUNCH PLAN (BUILT, IN-MARKET)

able is not pre-launch. the product is live at becomeable.app, the brand is shipped, **6 months of social content is queued and scheduled**, the email program is wired, and the content engine is running. the GTM section therefore reads less as a launch plan and more as a *scale plan* — the channels are open and the question is throughput.

**PHASE 1 — FOUNDATION (SHIPPED 2026-Q1)**
landing page with the bookend pattern (breath → unable→able). app at becomeable.app. brand voice + design system documented. domain verified (DKIM, SPF, MX, DMARC all green). transactional + behavioral email infrastructure live (resend → email-cron-daily edge function).

**PHASE 2 — CONTENT FACTORY (SHIPPED)**
SEO pillar/cluster taxonomy underway. 9 pay-yourself-first articles drafted; 2 published. business cluster underway. 175-piece social media library exported and uploaded. **6 months of daily posts scheduled across IG / FB / LinkedIn via make.com scenario.** 60-second cinematic reel rendered (remotion). master sheet imported. 477 captions written.

**PHASE 3 — DISTRIBUTION (LIVE)**
make.com cross-posting scenario (`4869011`) live across instagram, facebook, linkedin (tiktok manual). daily posting cadence enabled. behavioral email triggers wired (welcome, bill_due_tomorrow, low_buffer, monthly_wrap, dormancy, weekly).

**PHASE 4 — PODCASTS + INFLUENCERS (MONTH 1–6)**
the highest-leverage channel for a brand-led founder-pov product is voice — long-form founder appearances on shows whose audiences are the exact ICP. (detail in the next page.)

**PHASE 5 — PAID LAYER (MONTH 4–9)**
once organic conversion rate and CAC by channel are baselined cleanly, paid acquisition layers in. starting budget: $2,000/mo, scaling to $5,000/mo as paybacks confirm. channels in priority order: Meta (interest targeting on freelancer/creator/SMB owner), Google Search (intent-keyword on "budget app for self-employed" and the YNAB comparison search), YouTube pre-roll on personal-finance creator content. (see paid-ads skill for execution detail.)

**PHASE 6 — REFERRAL AMPLIFICATION (CONTINUOUS)**
referral program already active from day 1 of trial. focus is on tuning the reward structure and the in-product moments where the share prompt fires. referral targets covered in section 5 milestones below.

### CHANNELS

- **social (organic)** — IG, TikTok, LinkedIn, X. **6 months of content scheduled.** signature hook patterns: freezing metaphor, day 1–31 escalation, leak visualization. content pillars: moments / problem-frame / brand / product. cross-post scenario is live.
- **podcasts** — paul as guest on freelance / creator / SMB / variable-income personal-finance shows. paid sponsorships on top-tier shows (founder-pov ad reads, not generic spots). 50-podcast target list built; outreach is founder-led with personalized pitch. (detail next page.)
- **influencer partnerships** — selected creator-economy and freelance-economy voices (10K–200K engaged audiences) who already talk about money. extended trial + revenue-share comp. *not* mass-market influencer marketing. ~30 priority targets. (detail next page.)
- **in-app referral** — primary low-CAC growth engine. live from day 1 of trial. inviter gets billing credit, invitee gets extended trial.
- **SEO + content** — primary long-term moat. pillar/cluster strategy. budgeting / business / learn / taxes are the four cluster spines. founder writes; copy is fact-checked against the able-app-capabilities skill before publish.
- **email** — highest-leverage retention channel. behavioral triggers fire on real product signals. weekly newsletter post-launch. sender domain verified.
- **community** — reddit (r/freelance, r/Entrepreneur, r/personalfinance, r/digitalnomad — careful to follow each sub's self-promo rules), creator-economy discord servers, indie hackers. founder-led, never astroturfed.
- **comparison content + post-mint SEO** — "best budgeting app for self-employed," "after Mint for freelancers," "YNAB vs Able for variable income." captures the high-intent decision-stage searches.
- **paid ads** — strategic, gated until baselines clean. (see phase 5.)
- **partnerships (year 2+)** — tax-prep services (keeper, collective), accounting platforms (bonsai, found, lili), freelance marketplaces (contra, upwork, fiverr), creator-economy newsletters, fintech infra partners (plaid, method).

### TECH STACK BEHIND THE GO-TO-MARKET

| function | tool | status |
|---|---|---|
| website / landing | netlify auto-deploys from main | shipped |
| social cross-post | make.com scenario `4869011` | live |
| email (transactional + behavioral) | resend + supabase edge function `email-cron-daily` (16:00 UTC daily) | shipped |
| video render | remotion (`~/Desktop/able-reel/`) | v1 shipped |
| screen capture / b-roll | playwright + ffmpeg pipeline (`scripts/record-clips.py`) | shipped |
| seo content pipeline | local markdown → site, with frontmatter taxonomy | shipped |
| analytics | supabase event tracking (custom) + standard web analytics | shipped |

content is produced in-house using the able skills suite (brand, copy, SEO, social, email, ads, video, customer research) — eight documented skills that act as a brand operating system. consistency across every surface is the byproduct.

---

# 05 · go-to-market (cont.)
*podcasts, influencers, content, email, milestones*

## podcasts

founder-pov on the right podcast is the highest-leverage acquisition event available to a brand-led consumer SaaS. one 60-minute appearance in front of a high-fit audience produces more qualified trial sign-ups than a month of paid ads at this price point.

### TARGET LIST (50 PODCASTS)

three tiers, organized by audience fit, not download count.

- **TIER 1 · paid sponsorship + guest combo (top 15).** founder ad-read at the start of episode + 30–45 min interview. comp range: $500–$3,000/episode + revenue share on attributed conversions via dedicated landing page. examples: *Indie Hackers*, *The Futur*, *Side Hustle Show*, *Hustle Smarter*, *Solopreneur Hour*, *The Freelance Friday Podcast*, *Profit First Podcast*, plus 8 more.
- **TIER 2 · guest only, no fee (next 20).** mid-tier shows where the founder gets booked through pitch-driven outreach. ad-reads optional. comp: $0 (the appearance is the value).
- **TIER 3 · niche / community shows (next 15).** small but high-fit audiences in micro-niches (creator-economy specific shows, freelance-developer communities, etsy/shopify operator shows). low effort, high signal-to-noise on conversion.

### CADENCE

- **month 1–3:** pitch + book. target 4 confirmed appearances/mo by month 3.
- **month 4–9:** sustain 4–6 appearances/mo across the three tiers. start measuring per-show CAC via dedicated landing pages (e.g., `becomeable.app/futur`).
- **month 10+:** double down on the 5 best-performing shows; recur quarterly.

### THE PITCH (FOUNDER-LED, NOT AGENCY)

paul pitches each show with a personalized email referencing the most recent 1–2 episodes and tying the appearance to a specific topic the host has already explored. no PR firms, no podcast booking agencies. the founder voice is the product; outsourcing the pitch dilutes the signal.

## influencer partnerships

able is not buying influencer spots. able is partnering with the small number of creator-economy and freelance-economy voices whose audiences already trust them on money topics.

### WHO

- creator-economy operators with 10K–200K engaged followers (not vanity metrics — engagement rate above 3%)
- freelance-economy voices: developers, designers, writers, agency owners
- finance-for-self-employed creators (rare and high-value)
- *not:* mass lifestyle influencers, generic personal-finance #fintok creators, anyone who's already worked with three competitors this year

### THE OFFER

- 30-day extended free trial code for their audience (vs the standard 7-day)
- 25% revenue share on first 12 months for organic referrals via their unique link, OR a flat per-conversion fee for top-tier voices
- creator-only quarterly briefing on product roadmap (signal that they're not just an affiliate)
- first-look on new tier launches and beta access to roadmap features

### THE RAILS

- founder-led outreach with personalized pitch (no agencies)
- contracts kept simple: one-page agreement covering use of likeness, posting cadence, and disclosure requirements (FTC compliance is non-negotiable)
- no exclusivity. no "you must mention us X times per quarter" clauses.
- track per-creator CAC monthly via dedicated link attribution

### TARGETS

- **month 1–3:** 5 founding creators activated
- **month 6:** 12 active creators
- **month 12:** 25 active creators, with the top 5 producing 70% of attributed conversions

## the content engine

### CONTENT PILLARS (WEIGHTED)

- **the moments** — calm, specific, second-person scenes about variable income (the deposit, the freeze, the 31st). 35% of content.
- **the problem-frame** — day 1–31 escalation, the leak metaphor, "the problem was never you." 25%.
- **the founder-pov** — paul, in voice, explaining what he's seen and why able exists. 20%.
- **the product** — actual screens and mechanics shown in motion. 15%.
- **the comparison / decision** — "is YNAB right for variable income?" / "what to use after Mint." 5%.

### VOLUME (CURRENT STATE + TARGETS)

- **instagram + facebook + linkedin:** **6 months of daily posts already scheduled** via the live make.com cross-posting scenario. founder produces incremental "in-the-moment" posts on top of the queued library.
- **tiktok:** 4 videos/week (manual cadence; same library, repurposed)
- **youtube:** 1 long-form/month, 4 shorts/week (60s reel already produced; repurpose pipeline live)
- **blog:** 2 long-form articles/week (pillar/cluster)
- **email:** 1 newsletter/week post-launch, plus behavioral triggers continuous

## the email program

able has shipped behavioral email infrastructure end-to-end. the daily cron evaluates user state at 16:00 UTC and fires the highest-priority eligible email per user.

| trigger | eligibility | purpose |
|---|---|---|
| **welcome series** | new user | manifesto + first-allocation walkthrough (5-email sequence) |
| **bill_due_tomorrow** | bill due, not paid, not reserved | reduce missed-bill anxiety |
| **low_buffer** | buffer < 14 days operating | flag the cushion before it's a problem |
| **monthly_wrap** | first day of new month | last month's score + this month's setup |
| **dormancy** | no app activity 7+ days | gentle re-engagement |
| **weekly newsletter** | weekly | post-launch broadcast |
| **cart 24h / 3d / 7d** | trial-to-paid flow | incentive ladder |

sender domain is verified. open rate baseline is being established now. unsubscribe is per-type (granular preferences, not all-or-nothing) and shipped in the 2026-04-26 release.

## year 1 marketing milestones

| month | milestone | target |
|---|---|---|
| month 1 | trial sign-ups | 200 |
| month 1 | content library | already shipped (6 months scheduled) |
| month 3 | paying subs | 100 |
| month 3 | podcast appearances confirmed | 4/mo cadence |
| month 3 | seo cluster live (4 pillars) | 30 articles indexed |
| month 6 | paying subs | 350 |
| month 6 | active influencer partners | 12 |
| month 6 | first profitable paid channel | CAC < 4-month payback |
| month 6 | plus tier mix | 15%+ of paid base |
| month 9 | paying subs | 700 |
| month 12 | paying subs | 1,000+ |
| month 12 | ARR | **$240,000** |
| month 12 | referral attribution | 15% of new subs |
| month 12 | podcast / influencer attribution | 25% of new subs combined |

> **PLACEHOLDER FLAG**
> milestone targets are confident-but-defensible projections built from comparable consumer SaaS launch curves at this price point. real cohort data will replace these by month 3.

---

# 06 · operations
*how we actually do the work*

## operations

### TECHNOLOGY STACK

| function | tool | monthly cost (current scale) |
|---|---|---|
| hosting (web) | netlify | $0–$19 |
| backend / db / auth | supabase (postgres + auth + edge functions) | $25 |
| payments | stripe | 2.9% + $0.30 per txn |
| email | resend (sending domain verified) | $0–$20 |
| AI inference | anthropic api (claude haiku for coach) | scales with usage; ~$0.05–$0.20 per active sub/mo at current usage |
| automation | make.com | $9 |
| video render | remotion (open source) | $0 |
| analytics | supabase events + standard web analytics | $0 |
| domain | becomeable.app | ~$1/mo |
| **subtotal at current scale** | | **~$60–$80/mo + AI variable** |

infrastructure is intentionally light. the cost curve up to ~1,000 paying subs is mostly AI inference and stripe processing. neither is fixed-cost-heavy.

### EDGE FUNCTIONS (DEPLOYED)

all functions deployed with "Verify JWT" toggled OFF at the gateway (per supabase config requirement). source-controlled where applicable.

- `coach-chat` — coach API, anthropic-backed
- `email-cron-daily` — behavioral + transactional email; runs daily at 16:00 UTC
- `unsubscribe` — per-type unsub link handler
- `create-checkout` — stripe checkout session
- `create-portal-session` — stripe customer portal
- `stripe-webhook` — subscription lifecycle (with extended polling window after 2026-04-26 fix)
- `send-referral-invite` — referral email
- `ai-onboard` — onboarding parser

### DEPLOYMENT WORKFLOW

netlify auto-deploys HTML from `main`. supabase edge functions are dashboard-paste deployed. domain DNS is managed in cloudflare. email infrastructure routes through resend (Amazon SES infra) with DKIM, SPF, MX, and DMARC all verified. workflow is documented in an internal "deployment workflow" memo so a future engineer can pick up without ramp time.

### KPIS WE WATCH WEEKLY

- **growth:** trial sign-ups, trial-to-paid conversion, MRR, net new MRR
- **retention:** logo churn, revenue churn, cohort retention by month-of-signup
- **engagement:** DAU/MAU, deposits logged per active user, coach messages per active user, in-app referral-share rate
- **unit economics:** CAC by channel, blended CAC, LTV (estimated), payback period, contribution margin per sub
- **product health:** error rates, edge function error rates, AI cost per active user, coach rate-limit hit rate

monthly review: cohort retention curves, channel attribution sanity check, content engine throughput vs target, email open/click trend.

### CUSTOMER SUPPORT

founder-handled today. support email routes to a single inbox. response SLA: same business day. as scale grows, support transitions to a part-time community-and-support hire (year 2 likely first hire candidate).

---

# 06 · operations (cont.)
*partnerships + legal*

## partnerships + legal

### PARTNERSHIPS (PLANNED)

able's partnership strategy is gated by whether the partner adds load to the core mechanic or distracts from it.

- **plaid** — vendor, not partner. integration in phase B. account team call active.
- **method** (or similar) — bill pay + wallet APIs. phase C dependency.
- **freelance platforms** (e.g., upwork, fiverr, contra) — content + co-marketing. low priority year 1; co-marketing test in year 2.
- **creator-economy newsletters** — sponsored placement during paid-ads phase. lower CAC than meta in early tests is the bet.
- **tax-filing partners** (keeper, collective, FICA-aware tax SaaS) — referral or integration partnerships. year 2 once trust is established.
- **financial-literacy nonprofit** — mission tie-in (1% of subscription revenue, proposed). formalized in year 1.

### REFERRAL PROGRAM (LIVE)

active for all trial + paid users from day 1. structure: inviter gets a billing credit on successful conversion. invitee gets an extended trial. mechanics will be tuned monthly against cohort data.

### TRADEMARK + IP

trademark search in progress. "able" as a standalone word is unprotectable in class 9 (software) — too generic. strategy: file "**Able.**" (with stylized period) and "**becomeable.app**" wordmark + the underlined-able lockup in classes 9 (downloadable software) and 36 (financial services / fintech) immediately after LLC formation. estimated cost: ~$1,500 across both marks in both classes.

> **PLACEHOLDER FLAG**
> trademark filings are on the master task list. recommended within 60 days of funding close. legal counsel review of mark strategy advised before submission.

### BUSINESS LICENSES

- LLC (state registration)
- EIN from IRS (free)
- local business license (varies)
- state seller's permit / sales tax registration (SaaS taxability varies by state)
- business bank account
- general liability insurance ($300–600/yr)
- E&O / cyber insurance with sub-limit for incident response (recommended at $1K+ paying subs)

### DATA + PRIVACY

able publishes standard SaaS privacy policy, terms of service, refund policy. supabase row-level security enforces user data isolation. customer financial data is opt-in only — the user manually enters every bill, deposit, and balance today (plaid will be opt-in when shipped). data is never sold. CCPA + GDPR compliance shipped via standard SaaS posture; SOC 2 readiness evaluated at $500K ARR.

### INSURANCE

general liability through hiscox or next at launch. cyber + E&O within 90 days of crossing $1K paying subs. founder health insurance is separate and not a business expense.

---

# 07 · financials + funding ask
*the numbers*

## financials

> **HOW TO READ THIS SECTION**
>
> all numbers below are projections built from industry benchmarks for comparable early-stage consumer SaaS. a separate companion spreadsheet holds the live financial model where any assumption can be changed and the totals will recalculate automatically. when real funnel data, churn cohorts, and CAC by channel arrive, these numbers get replaced.

### STARTUP COSTS (ALREADY DEPLOYED, SELF-FUNDED)

these costs are sunk. paul self-funded the build through 2026 Q2. **the company is shipping with no debt and no prior outside capital.**

| line item | cost | notes |
|---|---|---|
| product build (12+ months) | self-funded labor | full-stack development, brand, content engine |
| domain + DNS + email infra | $300 | becomeable.app + cloudflare + resend setup |
| design system + brand build | self-funded labor | tokens, components, copy library |
| content engine (175-piece social library, 60s reel, blog cluster underway, **6 months scheduled**) | self-funded labor | including remotion, playwright capture, captions |
| supabase + netlify + stripe setup | $0 | within free tiers initially |
| tooling (anthropic api, make.com, etc.) | ~$200/mo | running cost, not setup |
| plaid + method finance integration build | in progress at writing | launching with Essential and Plus tiers |
| **total cash deployed pre-launch** | **~$3,000–$5,000** | rest is founder labor; clean cap table |

### TIER MIX ASSUMPTIONS

| year | Essential | Plus | Pro | blended monthly ARPU |
|---|---|---|---|---|
| year 1 | 85% | 15% | 0% (not yet shipped) | ~$17.24 |
| year 2 | 70% | 25% | 5% | ~$22.49 |
| year 3 | 60% | 30% | 10% | ~$25.49 |

annual mix assumed at 30% within each tier; the math above is computed monthly-equivalent.

### UNIT ECONOMICS (PER PAYING SUB, BLENDED, YEAR 1)

| line | Essential | Plus | blended (year 1) |
|---|---|---|---|
| ARPU/mo | $14.99 | $29.99 | $17.24 |
| stripe processing (2.9% + $0.30) | ($0.73) | ($1.17) | ($0.80) |
| plaid (per active connected user) | ($0.50) | ($0.50) | ($0.50) |
| method finance (per active user) | $0 | ($2.00) | ($0.30) |
| AI inference (claude haiku) | ($0.10) | ($0.10) | ($0.10) |
| infra (supabase, netlify, resend) | ($0.05) | ($0.05) | ($0.05) |
| **contribution margin per sub / mo** | **$13.61** | **$26.17** | **$15.49** |
| **contribution margin %** | ~91% | ~87% | **~90%** |

| LTV inputs | value |
|---|---|
| assumed monthly logo churn | 6.0% |
| assumed average sub lifetime | 16.7 months |
| **LTV (contribution-margin-adjusted, blended year 1)** | **~$259** |

> **PLACEHOLDER FLAG**
>
> per-sub plaid and method costs are estimates based on published vendor pricing tiers; final per-active rates will be confirmed at integration. 6% monthly churn is a benchmark for early-stage consumer SaaS — real cohort data will replace by month 6. annual subs and Plus-tier subs are expected to churn materially lower; mix shift will improve LTV.

### CAC TARGET

target blended CAC: **<$60** (4-month payback or better).
target paid CAC at scale: **<$100** (8-month gross-margin payback).

### YEAR 1–3 PROJECTION (BOOTSTRAP MODE)

| line | year 1 | year 2 | year 3 |
|---|---|---|---|
| paying subs (end of year) | 1,000 | 5,000 | 15,000 |
| blended ARPU/mo | $17.24 | $22.49 | $25.49 |
| **ARR (end of year)** | **$207,000** | **$1,349,000** | **$4,588,000** |
| revenue (full year, ramp) | $115,000 | $750,000 | $2,800,000 |
| COGS (stripe + plaid + method + AI + infra) | ($11,500) | ($97,500) | ($420,000) |
| gross profit | $103,500 | $652,500 | $2,380,000 |
| paid acquisition | ($24,000) | ($180,000) | ($510,000) |
| content + tooling | ($6,000) | ($24,000) | ($60,000) |
| podcast sponsorships + influencer comp | ($12,000) | ($60,000) | ($150,000) |
| founder draw / salaries | ($60,000) | ($120,000) | ($240,000) |
| first hire (year 2) | $0 | ($90,000) | ($110,000) |
| support + ops contractors | $0 | ($24,000) | ($60,000) |
| legal + insurance + admin | ($6,000) | ($12,000) | ($24,000) |
| AI + integration cost reserve | ($6,000) | ($24,000) | ($72,000) |
| **net (pre-tax)** | **($10,500)** | **$118,500** | **$1,154,000** |

> **MODEL ASSUMPTIONS**
>
> year 1 assumes 1,000 paying subs end-of-year, ramped from 0 with monthly net adds growing. tier mix starts heavily Essential and shifts toward Plus as users experience the bill-pay value. year 2 assumes paid acquisition layer is profitable and the first hire (likely growth or content) is made mid-year. year 3 assumes cohort retention has stabilized, Pro tier has shipped, and the team has expanded to 3–4 people. founder draw begins month 1 at $5K/mo through year 1, escalating to $10K/mo in year 2 and $20K/mo in year 3. plaid + method per-sub costs are absorbed in the COGS line. these projections are confident-but-realistic for a single-founder consumer SaaS at this price point. context: YNAB reportedly crossed $20M ARR before any external capital, and Monarch crossed nine-figure valuation within ~3 years with venture backing. able's path lies in that range — bootstrap by default, optional strategic capital.

---

# 07 · financials (cont.)
*capital posture + optional strategic round*

## capital posture

> able is **bootstrap-first.** the product is shipped, the brand is built, the content engine is running, 6 months of social posts are scheduled, the email program is live, and per-sub contribution margin is healthy from day one. cash flow funds the next quarter's marketing. the company is not actively fundraising.

### WHY BOOTSTRAP

- **the build cost is sunk.** the product, brand, content library, and infrastructure exist. there is no large pre-launch capital ask to justify.
- **per-sub contribution is positive from sub #1** at every tier. adding 100 subs adds ~$1,500/mo in cash flow at year-1 mix.
- **integration costs (plaid, method) are per-active and absorbed in COGS** — they scale with revenue, not as a fixed pre-revenue burn.
- **the founder has continued income optionality** outside able. operational runway extends as long as needed.
- **the category rewards patience.** YNAB bootstrapped to $20M+ ARR. category-leading consumer SaaS is built on cohort retention curves that take 18–36 months to confirm; raising before they confirm is paying premium for unknown information.

### WHEN ABLE WOULD ACCEPT EXTERNAL CAPITAL

three triggers, in priority order:

1. **a strategic partner** who compounds GTM (creator-economy network, podcast host who is also a check-writer, accounting/freelance platform leadership, fintech infra partner with portfolio synergy). the check is secondary; the relationship is the point.
2. **a paid acquisition stress-test.** if month 6–9 data shows clean per-channel CAC payback inside 4 months and the binding constraint becomes capital to scale paid spend, a small growth round (~$150–$300K) accelerates without dilution risk.
3. **an integration acceleration.** if method finance or array partner pricing requires meaningful upfront commitment (six-figure annual minimum), an integration-aligned investor de-risks the timeline.

absent one of these triggers, able does not raise.

### IF EXTERNAL CAPITAL APPEALS — TERMS

a clean SAFE keeps the path frictionless. proposed reference terms for a strategic partner conversation:

- **structure:** post-money SAFE (standard YC).
- **target check size:** $50K–$250K (smaller is fine; this is not a "round").
- **valuation cap:** $3.0M post-money.
- **discount:** none (cap is the protection).
- **MFN:** standard.

direct equity and convertible notes are also acceptable structures depending on partner preference; the SAFE is the default because it preserves option value on both sides.

### USE OF ANY CAPITAL RAISED

| category | typical allocation |
|---|---|
| paid acquisition acceleration (proven channels only) | 50% |
| integration costs (method finance, array, plaid scaling) | 25% |
| first hire (growth or content) ahead of bootstrap timeline | 20% |
| working capital reserve | 5% |

zero of any raised capital goes to founder runway. the founder is committed to able regardless.

### RETURN TIMELINE (PROJECTED, BOOTSTRAP CASE)

- **month 1–3:** plaid + method ship at launch tiers. content engine sustains 6-month queue. podcast pitching begins.
- **month 4–6:** first profitable paid channel locked (gated to clean baseline). trial-to-paid conversion baselined. 12 active influencer partners.
- **month 7–9:** referral attribution >10% of new subs. plus-tier mix >15% of paid base. operational break-even (covering all costs including founder draw).
- **month 10–12:** 1,000+ paying subs. **~$240K ARR** run rate. monthly net positive cash flow.
- **year 2:** rapid growth on cash-flow-funded marketing, **~$1.35M ARR** projected, first hire made.
- **year 3:** **~$4.5M ARR**. scale decision point — disciplined bootstrap continuation, optional growth round, or strategic acquisition conversation.

> **THE HONEST FRAMING**
>
> able is a brand-led consumer SaaS in a category with proven willingness-to-pay and a structural moat (no competitor closes the connect → reserve → pay loop). it isn't a venture-grade hyperscale bet on its own — the addressable market caps the unconstrained outcome — but it is exactly the category where bootstrap-to-multimillion is normal and category-leading outcomes are real (YNAB, Calendly, Notion in their early years). the projections in this plan are confident-but-defensible — not hockey-stick, not sandbagged. the company runs lean, ships fast, and treats outside capital as an option, not a requirement.

---

# 08 · risk + mitigation
*what could go wrong*

## risk + mitigation

every business plan needs this section, and most phone it in. here are the real risks able faces and what we will do about each one.

### RISK 1: TRIAL-TO-PAID CONVERSION UNDERPERFORMS

**the risk:** users sign up, get a sense of the product, and don't convert at day 8 — either because the product hasn't shown enough value yet or because the price is wrong for the cohort.

**mitigation:** the day-1 referral state and the day-1 onboarding moment-of-allocation are designed for early value. behavioral emails fire on real signals during the trial. if conversion is below 5% at day 8 by month 3, options ladder: lengthen the trial to 14 days, introduce a $7.99 starter tier, or pivot the onboarding flow to the lowest-friction first allocation. price sensitivity is testable; we don't lock into a wrong answer.

### RISK 2: ABANDONED MINT USERS GO TO MONARCH OR COPILOT INSTEAD

**the risk:** the largest available displaced cohort migrates to better-funded competitors with more polished dashboards before able is in their consideration set.

**mitigation:** able is not competing for the dashboard-budgeter — it's competing for the variable-income earner. the framing in our SEO and ads ("budget app for self-employed," "after Mint for freelancers") routes the right user to us specifically. monarch and copilot don't address variable income at all in their workflow; that's a category-wedge advantage, not a feature gap we can lose. the brand voice does the rest.

### RISK 3: AI COST CURVE SHIFTS

**the risk:** anthropic raises pricing or rate-limits change in a way that breaks the unit economics of the AI coach.

**mitigation:** the coach is built against the anthropic api with a clean abstraction; switching to a different model (or running a lower-cost model for most queries and reserving the larger model for complex ones) is a 1-week refactor. AI inference is currently $0.05–$0.20/active sub/mo — even a 5x cost increase keeps the coach profitable. the feature is high-value enough to absorb modest pricing shifts.

### RISK 4: PLAID OR METHOD INTEGRATION COST SHIFTS

**the risk:** plaid or method finance per-active-user pricing rises in a way that compresses margin at scale, or a vendor relationship is terminated.

**mitigation:** plaid is the industry standard for bank connection; vendor risk is low. method finance is the more exposed dependency — if their pricing tier or roadmap shifts, the Plus tier economics need re-underwriting. mitigation: (1) plus-tier price is set high enough to absorb 2–3x cost increases without becoming unprofitable; (2) the manual workflow that launched the product still works as a fallback; (3) alternative wallet/bill-pay infrastructure providers exist (synapse, dwolla, increase, treasury prime) and a migration is a 4–8 week build, not a multi-quarter rebuild. integration cost reserve is built into year 1 OPEX.

### RISK 5: A WELL-FUNDED COMPETITOR (YNAB, MONARCH) ADDS A "VARIABLE INCOME MODE"

**the risk:** an incumbent recognizes the wedge and bolts on a workflow for variable-income earners.

**mitigation:** the moat is the mental model, not the surface. an incumbent retrofitting "variable mode" onto a categorize-spending paradigm produces a worse experience than a native build, and the incumbent's existing user base anchors them away from changing the foundational model. by the time any incumbent ships a real variable-income mode, able will have 6–12 months of compounding SEO content and a brand that speaks to the cohort with felt-truth that retrofits can't fake.

### RISK 6: SOLO FOUNDER BANDWIDTH

**the risk:** a single-founder operator has bandwidth caps; product velocity, marketing throughput, and customer support eventually compete for the same hours.

**mitigation:** the first hire is funded in year 2 specifically for this. the work has been deliberately structured so high-leverage activity (product, content, brand) is the founder's domain and lower-leverage activity (support response, contractor coordination, ad operations) can transition to fractional or part-time roles as scale demands. an internal "skills suite" (8 documented brand operating skills) lets contractors plug in without ramp time. a co-founder will be welcomed if the right person appears, but the company is not waiting on one to ship.

### RISK 7: TRUST + FINANCIAL DATA SENSITIVITY

**the risk:** users hesitate to enter their financial data into a new tool from a single founder; or, post-plaid, a security incident damages trust in a category where trust is everything.

**mitigation:** the manual-entry workflow is itself a trust feature — no bank credentials touch the product today. supabase RLS isolates user data. SOC 2 readiness is on the year 2 roadmap pre-plaid full rollout. cyber insurance with incident-response sub-limit is procured before scaling past 1,000 subs. the brand voice is honest and consistent; trust is built one shipped quarter at a time, not claimed up front.

### RISK 8: CONTENT ENGINE SLOWS BEFORE PMF IS LOCKED

**the risk:** the content engine is currently sustained by founder labor. if founder time is consumed by support or product fires, content output slows, which eventually slows organic acquisition.

**mitigation:** the 175-piece social library is a buffer (~6 months of material). the SEO cluster is tooled to publish in batches. the email program is fully automated. when content output is the binding constraint, the next contractor hire is a content lead (instead of growth or support), and the budget for that is in year 2.

---

## plan b (if year 1 underperforms targets)

if year 1 ends with materially fewer than 1,000 paying subs or a CAC payback longer than 6 months, here's the fallback plan:

- **slow burn, founder runway extends.** because able is bootstrap-funded, there's no investor clock. founder draw scales down before any other line. operational runway extends 12–24 months as needed.
- **niche before general.** the product narrows to a single sub-persona (the freezer, most likely) and the marketing follows. wider targeting waits.
- **partnership-first GTM.** instead of paid acquisition, a content or tooling partnership with a freelance platform / accounting SaaS / creator newsletter becomes the primary acquisition channel.
- **price tested.** if conversion is the binding issue, the Essential tier price is tested at $9.99 to lower the friction. if churn is the binding issue, an annual-only push with a sharper discount tests willingness-to-pay at the lower-CAC tier.
- **drop the Plus tier temporarily.** if method integration cost or complexity becomes a drag without commensurate Plus conversion, the Plus tier is paused and engineering refocuses on the Essential experience.
- **strategic capital optionality.** if execution is right but capital is the binding constraint, the door opens to a small strategic round (~$150–$300K) under the SAFE structure outlined in section 7.

---

## the honest final word

able is a patient-growth bet on a felt-truth thesis: variable-income earners have been sold the wrong shape of advice for two decades, and a calm, plain, AI-accompanied product that meets them at the moment of deposit will earn their trust faster than any tool that has come before. the financial projections in this plan are honest attempts at realistic targets, not manufactured hockey-stick curves. the risks in this section are the ones that actually keep the founder up at night, not the template-driven ones most plans include. if an investor reads this plan and feels that the absence of breathless optimism is a liability, we're probably not the right fit. if an investor reads this plan and feels that *honesty* is what's been missing from the other consumer SaaS pitches they've been shown, we'd love to talk.

> the problem was never you. it was the advice you were handed. able is the system built around the actual shape of your income — irregular in, regular out — so you can finally able to breathe.
>
> **from unable → able.**

---

*end of plan v1.0*
