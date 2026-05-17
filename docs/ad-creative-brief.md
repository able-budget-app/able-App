# Cold Ad Creative Brief — Able persona LPs

**Status:** v1.0 draft, 2026-05-15
**Use:** Concept spec for cold creative pointed at the 3 persona LPs. Hand to production once iOS clears review. Each concept is a brief-for-build, not finished copy. Production session writes the polished variants.

**Targets (1:1 LP per persona):**
- `/scared-to-spend/` (The Freezer)
- `/money-leaks/` (The Leaker)
- `/done-feeling-behind/` (The Shame Cycle)

**Channels in scope:** Meta (FB + IG feed, Reels, Stories), TikTok, YouTube Shorts. Static + 15s vertical video at minimum per persona. Carousel optional where flagged.

---

## Brand constraints (verified against `docs/brand-script.md` + `able-app-capabilities` skill, 2026-05-15)

Hard rules every concept honors:

1. **No em dashes.** Hyphens, periods, colons, parens, line breaks. Sweep before producing.
2. **Faceless.** No founder, no actor on camera. Hands holding a phone are fine. Voiceover is allowed (faceless = no identified person).
3. **"Become Able" is the closing seal, not a CTA.** Button label is always "Start your free trial" or "Start free." Never "Become Able" on a button.
4. **Trial framing:** "30 days free. Card required. Cancel anytime." Annual badge is "Save $50."
5. **No YNAB phrase variants.** Never "every dollar gets a job," "every dollar has an assignment," or "give your money a job." Allowed: "every deposit has a purpose" and "five jobs."
6. **Floor is the only "first."** Never write "save first," "owner pay first," "debt first." Only "Floor first" or "bills first."
7. **No tax overclaim.** Able does bucket / classify / export for tax. It is NOT a tax filer, NOT a CPA, NOT a quarterly-tax payer. Acceptable: "tax set-aside off the top," "the export is ready for your accountant." Off-limits: "Able pays your taxes," "Able files for you."
8. **No credit overclaim.** Able has no credit-score feature. Off-limits: "boost your score," "improve your credit," "build credit." APR detection is fine to claim (Plaid liabilities, true purchase APR).
9. **No "smoothing reserve."** Brand term is "reserve." The reserve does NOT auto-release into bills. Acceptable: "the cushion you build for slow months." Off-limits: "the reserve fires when bills go uncovered."
10. **Anti-Ramsey / anti-YNAB framing is OFF-brand.** Villain is the monthly-paycheck paradigm, not any competitor.

Locked phrases available for direct use:
- "You freeze."
- "Money that sits, leaks."
- "A little here. A little there. Nothing feels like a decision."
- "By the 30th, $500 to $1,000 is gone."
- "The cost of starting is $14.99."
- "Most budgeting apps assume a steady paycheck."
- "Built for the paycheck that does not come every two weeks."
- "The problem was never you. It was the advice you were handed."
- "You don't need more discipline. You need a plan built for income like yours."
- "Become Able." (closing only)

---

## Shared asset library (build once, reuse everywhere)

So we're not respec'ing assets per concept:

**A. Phone-frame app shots** (already a backlog item per MEMORY.md "product shots pivot")
  - A1: Deposit-logged confirmation — "Yours to spend freely: $640" headline number
  - A2: Bills tab with "REVIEW" chips on Plaid-detected items
  - A3: Surplus split sliders in Settings (debt / reserve / free / pay-yourself)
  - A4: Coach chat exchange (one user message, one Coach reply with real reservation numbers)
  - A5: Score card (monthly score with green tick on a covered floor)
  - A6: Hero grid (balance / reserved_total / available_to_spend three-tile)
  - A7: Allocation animation — single deposit lands, splits into 6 stacks (tax, bills, pay-yourself, debt, reserve, free)

**B. Motion-graphics primitives**
  - B1: Day 1 to Day 31 calendar grid that fills with leak markers
  - B2: Bank-balance ticker counting down in small irregular amounts
  - B3: Stack of dollar bills frozen inside an ice cube (Freezer metaphor)
  - B4: Money "leaks" as droplets falling from a sealed container (Leaker metaphor)
  - B5: Calendar page tearing on the 31st, looping to Day 1 (Shame Cycle metaphor)

**C. Voiceover spec**
  - Female VO and male VO both rendered. Female default for Reels (calmer). Male VO for TikTok cold-traffic test. Voice cadence: short sentences, no music swell on the punchline.
  - Article-video voice = onyx is the locked default for *article* videos (per memory). For ads we'll A/B both.

**D. Type system**
  - Bricolage Grotesque headlines, kinetic single-line reveals on dark green.
  - Brand stripe (the swoosh) is the closing visual on every video, with "Become Able." sealed underneath.

**E. CTA card (always last frame)**
  - Headline: "Start your 30-day free trial."
  - Microcopy: "Card required. Cancel anytime."
  - URL or button: persona-LP URL.

---

## Persona: The Freezer

### Who they are
A freelancer, creator, or business owner who has money in the bank right now but is afraid to deploy it. The next check has no date. So the current check sits, untouched, in checking. They underpay themselves, delay reinvesting, and let "safe untouched" become a strategy. Often newer to self-employment (1-3 years) or just transitioned from a W2. They are careful by temperament, which becomes paralysis under inconsistent income. They read budgeting blogs but bounce off monthly-paycheck advice in the first paragraph.

### Top pain
A check sitting in checking that they cannot tell whether it's safe to spend.

### Promise
Able tells you exactly what's safe to spend the moment a check arrives.

### Disqualifiers (so the ad self-selects out churn risk)
- "If your paycheck lands on the 1st and the 15th, this isn't for you."
- "If you already know exactly what's safe to spend without doing math, skip this."
- "If you'd rather feel safe than know what safe actually is, this won't change that."

### Ad concepts

#### F1. "What's safe to spend?" — 15s vertical video
- **Hook (0-3s):** "Your check landed three days ago. You haven't touched it." (VO over a static phone screen showing a deposit notification at the top.)
- **Body (3-15s):** Phone frame opens Able. Deposit logged. Split animates: tax off the top, bills reserved, surplus split. The number "Yours to spend freely: $640" highlights and holds. VO closes with "That's the number you didn't have."
- **Visual direction:** Asset A1 + A7 inside phone frame. Plain dark-green background. Single phone, no hand. The split animation is the entire performance.
- **Format fit:** Reels primary. Works as YouTube Short. TikTok secondary.
- **Hypothesis:** Functional. Tests whether the *specific number* is the unfreeze trigger versus the metaphor. If it wins on hook-rate, the Freezer is hungry for proof, not poetry.

#### F2. "Money that sits, leaks." — static / single-frame
- **Hook (headline):** "Money that sits, leaks." (locked phrase, full-bleed type)
- **Body:** Sub: "Built for the paycheck that does not come every two weeks." CTA card below.
- **Visual direction:** Asset B3 (frozen-cash ice cube) with one droplet rendered visibly forming. Dark-green background. No phone. Bricolage Grotesque all-caps headline.
- **Format fit:** FB feed static, IG feed single-image, Reels cover image. Recyclable as YouTube end-card.
- **Hypothesis:** Emotional. Tests the metaphor as standalone hook. Pairs with F1 in the same campaign for an emotional/functional split test.

#### F3. "The balance that lies / the number that doesn't." — static comparison
- **Hook (headline):** "Your balance: $4,200. What's safe to spend: $840."
- **Body:** Sub: "Same money. Two very different numbers. Able shows you the second one." CTA card.
- **Visual direction:** Two phone frames side by side. Left: a generic banking app screen showing $4,200 (mock). Right: Able's "Yours to spend freely: $840" card from A1. Subtle red-tint on the left number, brand-green on the right.
- **Format fit:** FB feed (the comparison reads well at thumb scale). Skip TikTok (too text-heavy).
- **Hypothesis:** Functional. Tests whether the *gap* between balance and safe-to-spend is the persuasion (we suspect yes, this is the Freezer's exact internal question).

#### F4. "Three days." — 15s vertical, narrative
- **Hook (0-3s):** "The check came in Monday. It's Thursday. You still haven't touched it." (kinetic type, no phone).
- **Body (3-12s):** Phone enters frame. Deposit logged. Split runs. Bills reserve. The "Yours to spend freely" number lands.
- **Closer (12-15s):** "From freezing to moving with intention." Brand stripe + "Become Able." seal.
- **Visual direction:** First half is type-only on dark green. Second half is asset A1 + A7 phone reveal. The transition (type collapses into the phone frame) is the kinetic beat.
- **Format fit:** Reels, TikTok, YouTube Shorts. Pin as Reels cover candidate.
- **Hypothesis:** Emotional → functional bridge. Tests whether naming the freeze (in seconds, by name) outperforms metaphor F2 and pure-functional F1.

---

## Persona: The Leaker

### Who they are
A freelancer, creator, or business owner whose income is decent but whose balance bleeds in $7 to $22 chunks across the month. They KNOW it's happening. They can feel the gap between "I made $7K this month" and "I have $1,800 left." They cannot point to where it went. They self-describe as "bad with money" but they're actually unstructured: bills get paid, just-in-time, leaving a fuzzy "everything else" pool that quietly evaporates. Often higher-earning than the Freezer. Often skeptical of budgeting apps because they've tried Mint, YNAB, or a spreadsheet, and all of them assumed a monthly cycle that doesn't fit.

### Top pain
$500 to $1,000 a month evaporating in micro-spends with no visible cause.

### Promise
Able allocates every deposit the moment it lands, so "free spending" becomes a number, not a leftover.

### Disqualifiers
- "If you already track every dollar in a spreadsheet and like it that way, you don't need this."
- "If your discretionary spend is under $500 a month, the leak's not your problem."
- "If you don't actually want to know where the money goes, this won't help."

### Ad concepts

#### L1. "Where did $1,000 go?" — 15s vertical video (storyboarded)
- **0-2s:** Bank-balance ticker (asset B2). Number starts at $4,820. A small red flick: -$7 (lunch). Then -$14 (gas). Then -$22 (subscription). Each tick is silent except for a soft tap.
- **2-6s:** Calendar grid (asset B1) fills with leak markers. The ticker bottoms out at $3,820 by Day 30. On-screen text: "Same month, every month."
- **6-9s:** Cut to phone frame. Asset A1: "Yours to spend freely: $640." On-screen text: "What if free spending was a number, not a leftover?"
- **9-13s:** Phone shows asset A7 (the split animation). VO: "Every deposit gets allocated the moment it lands."
- **13-15s:** Brand stripe + "Become Able." + CTA card.
- **Visual direction:** Cold open is pure motion graphics (no phone). Phone enters at the pivot. Voice-over enters only after the leak is shown.
- **Format fit:** Reels and TikTok primary. The first 6 seconds are the entire ad — full ad payoff is bonus.
- **Hypothesis:** Functional with emotional cold open. Tests the "show the leak first, name the fix second" structure against L2 (which leads with the phrase, not the demo).

#### L2. "By the 30th, $500 to $1,000 is gone." — static
- **Hook (headline):** "By the 30th, $500 to $1,000 is gone." (locked phrase, full-bleed)
- **Body:** Sub: "A little here. A little there. Nothing feels like a decision." (locked phrase) CTA card.
- **Visual direction:** Dark-green card. Type-only. The number is set in the brand accent so it stops the scroll. No phone, no metaphor — the phrase is the whole ad.
- **Format fit:** FB feed, IG feed, Reels cover. Skip TikTok (no motion).
- **Hypothesis:** Pure phrase test. If this beats L1 on click-through, the locked-phrase library is the asset, not the demos.

#### L3. "The leak audit you'd do for any business." — 15s vertical
- **Hook (0-3s):** "If your business was bleeding $1,000 a month, you'd find it in a week." (VO + kinetic type)
- **Body (3-12s):** "Your money is the same business. Run the audit." Cut to phone frame: asset A6 (hero grid showing balance, reserved_total, available_to_spend). VO names each number.
- **Closer (12-15s):** "Every deposit has a purpose. Bills first. Then everything else." Brand stripe + seal.
- **Visual direction:** Type-only first half. Phone reveal in the second half. Punchy cuts, not soft fades.
- **Format fit:** TikTok primary (the "you'd do this for any business" framing reads as POV creator-talk even faceless). Reels secondary.
- **Hypothesis:** Identity hook. Tests whether reframing personal money *as* a business problem flips the "I'm bad with money" tape. If it works, this is the cold-traffic frame for all 3 personas.

#### L4. "Where the leak hides" — carousel (5 slides)
- **Slide 1 (cover):** "Where does $1,000 a month actually go?"
- **Slide 2:** "Lunch. $7-$22 a hit. 18 hits a month."
- **Slide 3:** "Subscriptions you forgot about. Average: 4 of them."
- **Slide 4:** "Gas, parking, the impulse $40 at Target. The rounding-error money."
- **Slide 5:** "Above the floor (bills + tax) is yours, free to spend. Able tells you exactly how much that is. [CTA]"
- **Visual direction:** Each slide is a single illustration on dark green. Slide 5 introduces the phone frame for the first time.
- **Format fit:** IG carousel and FB feed carousel. Skip TikTok and Reels (carousels underperform there).
- **Hypothesis:** Educational longform. Tests whether building the case slide-by-slide outperforms the punch of L1 / L2 for the "I need to understand it before I'll trust it" Leaker subtype.

---

## Persona: The Shame Cycle

### Who they are
A freelancer, creator, or business owner who has tried four budgeting apps. Each one started with January enthusiasm and ended in March abandonment. They believe they are the problem. They carry credit card debt they're embarrassed about, near-zero savings, and the dread of opening a banking app. Often older than the other two (longer in self-employment), often has a partner asking "what's our plan?" Reads finance content with shame, not curiosity. Comes to the LP from organic search ("why can't I budget on irregular income") or from a podcast mention.

### Top pain
The internal tape that says "I'm bad with money," reinforced by every budgeting tool that quietly assumed a monthly paycheck and made them feel broken when it didn't fit.

### Promise
The problem was never you. It was the advice you were handed. Able is built for the way you actually get paid.

### Disqualifiers
- "If you've never tried to budget before, this isn't the right starting point."
- "If you have a steady salary, this won't help. There are better tools for you."
- "If you want a tool that judges your spending, this isn't it. Able doesn't grade you. It plans with you."

### Ad concepts

#### S1. "You're not bad with money." — 15s vertical video (storyboarded)
- **0-3s:** Black frame. White text appears one line at a time: "You're not bad with money." Hold.
- **3-6s:** "You were handed advice that assumes a paycheck you don't get." Hold.
- **6-10s:** Cut to phone frame. Asset A6 (hero grid). VO: "Bills covered. Debt down. Savings up. End of the month, you know exactly where every dollar went."
- **10-13s:** Asset A5 (score card with the green tick). VO: "The score isn't the plan. It's what actually happened."
- **13-15s:** Brand stripe + "Become Able." seal + CTA card.
- **Visual direction:** Type-only first half. Calm pacing. No music sting. The phone is reward, not setup.
- **Format fit:** Reels primary (Reels rewards calm direct-address). Skip TikTok cold (this lands better on warmer traffic, save it for retargeting).
- **Hypothesis:** Permission-as-hook. Tests whether direct empathy in the first 3 seconds opens the click for the most defensive persona. We expect this to be the highest-performing concept across all 3 personas.

#### S2. "I am able." — static, type-only
- **Hook (headline):** "I am able to predict what is coming."
- **Body:** Sub: "Built for the paycheck that does not come every two weeks." CTA card.
- **Visual direction:** Type-only. Dark green. The "I am able to..." line in brand-accent. Three rotating variants for ad sets:
  - "I am able to pay down debt, even on slow months."
  - "I am able to save without second-guessing."
  - "I am able to predict what is coming."
- **Format fit:** FB feed, IG feed, Reels cover. Pinterest if extended.
- **Hypothesis:** Identity-statement test. Tests which of the three "I am able to..." statements pulls hardest for cold traffic (vs warm). The winner becomes the headline pattern for the whole persona.

#### S3. "Same 31 days, over and over." — 15s vertical
- **0-3s:** Calendar wheel (asset B5) spinning fast. Tearing pages. Voice-over: "Shame. Guilt. Avoidance."
- **3-7s:** Wheel slows. Stops. Single calendar page. VO: "Same 31 days, over and over."
- **7-12s:** Page tears apart. Phone enters the rupture. Asset A7 split animation runs inside the phone. VO: "You don't need more discipline. You need a plan built for income like yours."
- **12-15s:** Brand stripe + "Become Able." seal + CTA card.
- **Visual direction:** Heavy motion in the first half (the wheel is the spectacle). Phone reveal is the rupture. Music kept to a low pad until the rupture, then drops out for the VO.
- **Format fit:** TikTok primary (the wheel is scroll-stopping). Reels secondary. Cut a 6s edit for YouTube bumper.
- **Hypothesis:** Emotional metaphor + locked-phrase payoff. Tests whether visualizing the loop (vs naming it in S1) does more work. If S3 wins on hold-rate but S1 wins on click-through, that tells us metaphor sells the watch but empathy sells the click.

#### S4. "The five rules." — carousel (6 slides)
- **Slide 1 (cover):** "Floor-First Budgeting. The rules." (bold headline, dark-green)
- **Slide 2:** "Rule 1. Know your floor. Bills plus tax equal the amount you can't miss."
- **Slide 3:** "Rule 2. Every deposit fills the floor first. Not month by month. Deposit by deposit."
- **Slide 4:** "Rule 3. Build your reserve before you spend. Slow months get paid by the reserve, not by next month's panic."
- **Slide 5:** "Rule 4. One month ahead = Able. When next month's floor is already reserved, you've arrived."
- **Slide 6:** "Try it free for 30 days. [CTA]"
- **Visual direction:** Type-led, each slide one rule. Use the Able floor-illustration motif (a horizontal line with money "above the floor" and "filling the floor"). Phone frame appears only on the cover and slide 6.
- **Format fit:** IG carousel, FB carousel, LinkedIn (this persona over-indexes on LinkedIn). Slide 1 also doubles as a static.
- **Hypothesis:** Methodology-as-credibility. Tests whether naming the method (giving the Shame Cycle a label and a structure) earns the install where empathy alone might not. This is the "you finally have something to point to" pull.

---

## Test plan (single-sentence per persona)

- **Freezer:** Test functional (F1) vs metaphor (F2) head-to-head; promote the winner against narrative bridge (F4).
- **Leaker:** Test demo-led (L1) vs phrase-led (L2); use carousel (L4) for warmer audiences.
- **Shame Cycle:** Run S1 as baseline (high expected performer); test S3 as scroll-stopper variant; reserve S4 for LinkedIn + retargeting only.

## Production handoff checklist (next session)

1. Render Able phone-frame assets A1 through A7 from `app.html` (per "product shots pivot" backlog item in MEMORY.md). Static stills first, then a 3s loop of A7 (the split animation).
2. Build motion primitives B1 through B5 in Remotion (the cousin of `able-reel-remotion` setup).
3. Record VO scratch for F1, L1, L3, S1, S3 (both onyx + female default).
4. Cut all 12 concepts to spec lengths.
5. Write final polished hooks + bodies (this brief gives the concept; production writes the variants).
6. QA pass against the 10 brand constraints above before any concept ships.

---

**Closing seal across every asset:** "Become Able."
