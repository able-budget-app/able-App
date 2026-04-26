# Social pipeline — sourcing from existing SEO/content/free-course

This is the master mapping for new social content sourced from the existing article corpus. The autonomous 2:30am run reads this + `_audit.md` and writes all the copy. **No design work** — pure copy drafting.

Existing system (don't touch):
- `social/posts/data.js` — 45 singles + 15 carousels already built and locked
- `social/posts/template.html`, `carousel.html`, `cover.html`, `_render.js`, `_styles.css` — design system
- `social/index.html` — gallery
- Voice rules locked in `data.js` and the able-social-media + able-product-copy skills

---

## Theme & template reference (so the run uses them consistently)

Themes available (from `_styles.css`):
- `page` — soft page-green `#f0f7f2`. Calm, default, founder/warm content.
- `white` — clinical, structural, list/comparison content.
- `green` — brand `#2a7a4a`. Hero declarative, mental models.
- `glass` — frosted on green gradient. Premium, contemplative, identity.
- `black` — cloud-black `#0e1a14 → #050b08`. Bold reframes, money math, dark drama.
- `glass-dark` — frosted on cloud-black. Most premium / flagship.

Templates:
- `A` = muted lead-in + punch reframe ("You're not X. You're Y.")
- `B` = single statement (no muted)

Eyebrows (always one of these unless using a custom string like "Day 7" or "Step 1"):
- `'fcb'` → "For freelancers, creators & business owners"
- `'ent'` → "For entrepreneurs"
- Or any custom string for carousel slides (e.g. "Bucket 1", "Day 14", "Swipe →")

Underline phrase: wrap in `{...}`. Kept on one line via `white-space: nowrap`. Don't put `\n` inside `{}`. Keep underline phrases ≤14 characters when possible.

CTAs (rotate evenly across new content):
- **Website**: `(B)` punch `"Built for\ninconsistent\n{income}."` — meta `becomeable.app`
- **Free trial**: `(B)` punch `"{Free} for 7 days.\nBuilt for\nvariable income."` — meta `becomeable.app`
- **Pricing**: `(A)` muted `"$14.99 a month."` punch `"Or $129 a year.\n{Save $50.}"` — meta `becomeable.app`

---

## NEW CAROUSELS — C16 → C38

23 carousels sourced from existing articles. Goal: 5–8 slides each, slide 1 = cover with `Swipe →` eyebrow, last slide = CTA.

| ID | Source article | Working title | Theme | CTA | Persona |
|---|---|---|---|---|---|
| C16 | able-content/budgeting/feast-or-famine.md | The feast or famine cycle | multi: page → black → green | free trial | freelancers |
| C17 | able-content/budgeting/freelancer-budget.md | How to budget as a freelancer | white | website | freelancers |
| C18 | able-content/budgeting/pay-yourself-steady-paycheck.md | Pay yourself a steady paycheck | green | pricing | self-employed |
| C19 | able-content/budgeting/creator-budget.md | The creator's budget | glass | free trial | creators |
| C20 | able-content/budgeting/designer-developer-budget.md | Designer / developer income system | white | pricing | freelancers |
| C21 | able-content/budgeting/real-estate-agent-budget.md | Real estate agent commission system | black | website | real estate agents |
| C22 | able-content/budgeting/rideshare-driver-budget.md | Rideshare driver income system | page | free trial | rideshare drivers |
| C23 | able-content/budgeting/etsy-seller-budget.md | Etsy seller income system | glass-dark | pricing | etsy sellers |
| C24 | able-content/budgeting/coach-consultant-budget.md | Coach / consultant income system | green | website | coaches |
| C25 | able-content/budgeting/commission-income-budget.md | Commission income survival | black | free trial | commission earners |
| C26 | able-content/business/emergency-fund.md | The self-employed emergency fund | glass-dark | pricing | self-employed |
| C27 | able-content/taxes/how-much-to-set-aside.md | How much to set aside for taxes | white | website | 1099 |
| C28 | able-content/taxes/1099-nec-explained.md | What is a 1099-NEC? | white | free trial | 1099 |
| C29 | able-content/taxes/1099-k-explained.md | What is a 1099-K? | white | pricing | 1099 |
| C30 | able-content/taxes/bad-month-quarterly-taxes.md | Quarterly taxes during a bad month | glass-dark | website | 1099 |
| C31 | able-content/taxes/home-office-deduction.md | The home office deduction | page | free trial | self-employed |
| C32 | able-content/taxes/schedule-c-walkthrough.md | Schedule C walkthrough | white | pricing | 1099 |
| C33 | able-content/taxes/self-employment-tax-deductions.md | Self-employment tax deductions | glass | website | 1099 |
| C34 | able-content/learn/get-out-of-debt/ | Get out of debt on inconsistent income | multi: black → green | free trial | freelancers |
| C35 | able-content/learn/improve-your-credit-score/ | Improve your credit score | page | pricing | generic |
| C36 | able-content/learn/pay-yourself-first/ | Pay yourself first (the variable-income version) | green | website | self-employed |
| C37 | able-content/learn/how-money-works/ | How money actually works | glass | free trial | generic |
| C38 | able-content/learn/get-business-funding/ | Get business funding (without losing the business) | black | pricing | business owners |

CTA distribution check:
- Free trial: C16, C19, C22, C25, C28, C31, C34, C37 = 8
- Website: C17, C21, C24, C27, C30, C33, C36 = 7
- Pricing: C18, C20, C23, C26, C29, C32, C35, C38 = 8
Total 23. Reasonable spread.

---

## NEW SINGLES — P46 → P54

9 single posts compressed from the comparison pages + calculator pages + resource page.

| ID | Source | Punch direction | Theme | Eyebrow |
|---|---|---|---|---|
| P46 | compare/mint-shutting-down/ | "Mint shut down. The replacement still assumes a paycheck." reframe | white | ent |
| P47 | compare/ynab-alternative-for-freelancers/ | "Asked to assign every dollar of money you don't have yet." | black | fcb |
| P48 | compare/monarch-money-vs-able/ | Generic competitor reframe — built for two-income households not yours | page | fcb |
| P49 | compare/rocket-money-vs-able/ | Generic competitor reframe — cancels subscriptions, doesn't fix the leak | white | ent |
| P50 | calculators/tax-set-aside/ | "30% of every deposit. Moved before you see it." | green | fcb |
| P51 | calculators/emergency-fund/ | "Three months of slow. What does that actually cost?" | glass-dark | ent |
| P52 | calculators/owner-pay/ | "Pay yourself last. Pay yourself wrong." reframe | black | fcb |
| P53 | calculators/sep-vs-solo-401k/ | "The retirement plan your accountant didn't tell you about." | glass | ent |
| P54 | calculators/baseline-income/ | "What's the smallest month you could survive?" | page | fcb |

---

## REELS — R1 → R20

20 reel concepts. Reels are HTML-animated 1080×1920 vertical, designed to be screen-recorded in Chrome. The autonomous run writes the **concept + beats + on-screen text** for each. Actual HTML/animation builds happen in a separate session.

For each reel, the autonomous run drafts:
- **Hook** (first 1.5s, on-screen text)
- **Beats** (3–8 beats, each 2–4 seconds, on-screen text only)
- **Theme** (one of the 6)
- **Duration estimate**
- **Format** (`text-reel` = pure text reveal, no filming) OR (`talking-head` = founder POV script, 30–60s)
- **Source** (which carousel/article/single it's adapted from)

| ID | Concept | Format | Source | Theme |
|---|---|---|---|---|
| R1 | Day 1–31 of a freelancer's month | text-reel | C2 | multi (light → dark → green) |
| R2 | Where $4,000 actually goes | text-reel | C4 | black |
| R3 | The 5 buckets in order | text-reel | C3 | green |
| R4 | 30% of every deposit (1099 tax math) | text-reel | C5 | white |
| R5 | Why budgeting apps fail freelancers | text-reel | C1 | white |
| R6 | You're not bad with money. You were handed the wrong tool. | text-reel | P01 | page |
| R7 | The freezing metaphor | text-reel | freezing-to-flowing | page → green |
| R8 | Quarterly taxes during a bad month | text-reel | C30 | glass-dark |
| R9 | Why I built Able (founder POV) | talking-head | C7 | page |
| R10 | Same income. Different feeling. (before/after) | text-reel | P14 | green |
| R11 | Pay yourself a steady paycheck (system reveal) | text-reel | C18 | green |
| R12 | Which one are you? (Freezer / Leaker / Shame) | text-reel | C9 | multi |
| R13 | April without the panic | text-reel | C13 | glass-dark |
| R14 | The compound cost of waiting | text-reel | C11 | multi |
| R15 | Free 7-day trial (CTA reel, 15s) | text-reel | — | green |
| R16 | The smoothing reserve explained | text-reel | freelancer-budget | page |
| R17 | Set up your tax bucket in 60 seconds | talking-head | tax-set-aside calc | white |
| R18 | Your first week with Able | text-reel | C12 | page |
| R19 | From spreadsheet to system | text-reel | new | white → green |
| R20 | "Save more" isn't a plan | text-reel | C10 | black |

---

## OUTPUT FILES the autonomous run will write

- `social/_drafts/carousels.md` — copy for C16 → C38, slide-by-slide, in the same data shape as `data.js` so we can paste later
- `social/_drafts/singles.md` — copy for P46 → P54
- `social/_drafts/reels.md` — concepts/beats/on-screen-text for R1 → R20

---

## RULES for the autonomous run

1. **Read `social/_drafts/_audit.md` for source material before writing each piece.** That file has direct quotes and nuggets from each article.
2. **Match the existing voice** — short sentences, plain language, no em dashes, customer-as-hero, founder POV is Paul. Reference `social/posts/data.js` to mirror the rhythm of existing carousels (especially C1–C15).
3. **No competitor names** in graphic-bound copy. "Most apps" / "spreadsheets" instead of "YNAB" / "Mint" / "Monarch" / "Rocket Money". Comparison pages can mention by name once in the cover slide eyebrow if needed (e.g., "vs. Rocket Money") — but punch lines stay generic.
4. **Underline phrases ≤14 chars** ideally. Never put `\n` inside `{...}`.
5. **Don't modify** `social/posts/data.js` or any existing files. Only write the three drafts files above.
6. **Stop at 95% context usage.** If approaching the limit, finish the current carousel/reel, then save partial work and write a status note at the bottom of the relevant draft file (`PARTIAL — stopped at C25, resume here next session`).
7. Mirror the data shape — output each carousel like:
   ```
   { id: 'C16', slug: 'feast-or-famine', theme: 'page', slides: [
       { tpl: 'B', eyebrow: 'Swipe →',
         punch: "The feast\nor {famine} cycle.",
         meta: '1 / 7' },
       ...
   ] },
   ```
   So when we promote into `data.js`, it's a copy-paste.
