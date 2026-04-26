// REELS — vertical 1080×1920 short-form for IG/TikTok/Shorts
// Each reel: { id, slug, theme, format, durationSec, beats: [{ text, durationSec, theme? }] }
// HARD RULE: every beat is max 2 lines (one \n). Auto-fit at render time picks the largest
// font-size that fits the longest line in the reel and applies uniformly.
// {phrase} = squiggle underline (nowrap, absorbs trailing punctuation).
// \n = the ONE allowed line break — usually setup → punch.
window.REELS = [

  // R1 — Day 1-31 of a freelancer's month (multi: page → black → green)
  { id: 'R1', slug: 'freelancer-month', theme: 'page', format: 'text-reel', durationSec: 24,
    beats: [
      { text: "A freelancer's\n{month}.", durationSec: 2.5 },
      { text: "Day 1.\nMoney {lands}.", durationSec: 2.5 },
      { text: "Day 7.\nA {subscription}.", durationSec: 3 },
      { text: "Day 14.\nThe {leak}.", durationSec: 2.5, theme: 'black' },
      { text: "Day 30.\n{$4,000} gone?", durationSec: 3, theme: 'black' },
      { text: "Day 31.\n{Shame.}", durationSec: 2.5, theme: 'black' },
      { text: "Not willpower.\nA {Day 1} problem.", durationSec: 3.5, theme: 'green' },
      { text: "{Free} for 7 days.\nbecomeable.app", durationSec: 4.5, theme: 'green' },
    ] },

  // R2 — Where $4,000 actually goes (cloud black)
  { id: 'R2', slug: 'where-4000-goes', theme: 'black', format: 'text-reel', durationSec: 22,
    beats: [
      { text: "Where {$4,000}\nactually goes.", durationSec: 2.5 },
      { text: "$1,200.\n{Tax.}", durationSec: 2.5 },
      { text: "$1,800.\n{Bills.}", durationSec: 2.5 },
      { text: "$300.\n{Subscriptions.}", durationSec: 2.5 },
      { text: "$400.\n{Just grabbed.}", durationSec: 2.5 },
      { text: "$300.\n{The leak.}", durationSec: 2.5 },
      { text: "Feels small.\n{The compound is huge.}", durationSec: 3 },
      { text: "becomeable.app", durationSec: 4 },
    ] },

  // R3 — The 5 buckets in order (brand green)
  { id: 'R3', slug: 'five-buckets', theme: 'green', format: 'text-reel', durationSec: 22,
    beats: [
      { text: "Every dollar\ngets {a job}.", durationSec: 2.5 },
      { text: "1. {Taxes.}\nNot yours.", durationSec: 2.5 },
      { text: "2. {Bills.}\nDon't wait.", durationSec: 2.5 },
      { text: "3. {Reserve.}\nFor next month.", durationSec: 3 },
      { text: "4. {Debt.}\nOn schedule.", durationSec: 3 },
      { text: "5. {Free.}\nGuilt-free.", durationSec: 3 },
      { text: "$14.99 a month.\n{Save $50} annual.", durationSec: 3.5 },
    ] },

  // R4 — 30% of every deposit (white)
  { id: 'R4', slug: 'tax-math-30', theme: 'white', format: 'text-reel', durationSec: 18,
    beats: [
      { text: "If you're {1099},\nread this.", durationSec: 2.5 },
      { text: "Every deposit.\nRoughly {30%}.", durationSec: 2.5 },
      { text: "Belongs to\n{the IRS}.", durationSec: 2.5 },
      { text: "Not April.\n{The second} it clears.", durationSec: 3 },
      { text: "Move it.\nOr {lose it}.", durationSec: 2.5 },
      { text: "{Free} for 7 days.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 2.5 },
    ] },

  // R5 — Why budgeting apps fail freelancers (white)
  { id: 'R5', slug: 'apps-fail-freelancers', theme: 'white', format: 'text-reel', durationSec: 20,
    beats: [
      { text: "Why apps fail\n{freelancers}.", durationSec: 3 },
      { text: "They assume\na {paycheck}.", durationSec: 2.5 },
      { text: "Yours {isn't}.", durationSec: 2.5 },
      { text: "They show\nwhat {happened}.", durationSec: 3 },
      { text: "Too {late}.", durationSec: 2.5 },
      { text: "You need a system\nfor {variable}.", durationSec: 3 },
      { text: "{Free} for 7 days.", durationSec: 2 },
      { text: "becomeable.app", durationSec: 2 },
    ] },

  // R6 — You were handed the wrong tool (page)
  { id: 'R6', slug: 'wrong-tool', theme: 'page', format: 'text-reel', durationSec: 14,
    beats: [
      { text: "You're not\n{bad with money}.", durationSec: 3 },
      { text: "You were handed\nthe {wrong tool}.", durationSec: 3 },
      { text: "Every app assumes\na {paycheck}.", durationSec: 3 },
      { text: "Yours is {variable}.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 2.5 },
    ] },

  // R7 — The freezing metaphor (page → green)
  { id: 'R7', slug: 'freezing-flowing', theme: 'page', format: 'text-reel', durationSec: 18,
    beats: [
      { text: "You're not\noverspending.", durationSec: 2.5 },
      { text: "You're {freezing}.", durationSec: 2.5 },
      { text: "Money sits.\nMoney {leaks}.", durationSec: 2.5 },
      { text: "Direct it.\nOr {it leaks}.", durationSec: 3, theme: 'green' },
      { text: "Same money.\n{More work.}", durationSec: 3, theme: 'green' },
      { text: "{Free} for 7 days.", durationSec: 2, theme: 'green' },
      { text: "becomeable.app", durationSec: 2.5, theme: 'green' },
    ] },

  // R8 — Quarterly taxes during a bad month (glass-dark)
  { id: 'R8', slug: 'bad-month-quarterly', theme: 'glass-dark', format: 'text-reel', durationSec: 18,
    beats: [
      { text: "Quarterlies due.\n{Bad month.}", durationSec: 3 },
      { text: "The {IRS}\ndoesn't care.", durationSec: 2.5 },
      { text: "Penalty:\nabout {9%}.", durationSec: 2.5 },
      { text: "Pay what you can.\nBeats {nothing}.", durationSec: 3 },
      { text: "Prevention?\n{A reserve.}", durationSec: 3 },
      { text: "becomeable.app", durationSec: 4 },
    ] },

  // R9 — Why I built Able (founder POV, text-reel; name removed 2026-04-26)
  { id: 'R9', slug: 'why-i-built-able', theme: 'page', format: 'text-reel', durationSec: 28,
    beats: [
      { text: "Why I built\n{Able}.", durationSec: 3 },
      { text: "I'm a freelancer.\nI {froze}.", durationSec: 3.5 },
      { text: "Not because\nI was {bad}.", durationSec: 3.5 },
      { text: "Every tool assumed\na {paycheck}.", durationSec: 4 },
      { text: "I built it to\n{stop the math}.", durationSec: 4 },
      { text: "The tool I needed\n{five years ago}.", durationSec: 4 },
      { text: "becomeable.app", durationSec: 6 },
    ] },

  // R10 — Same income. Different feeling. (green)
  { id: 'R10', slug: 'same-income', theme: 'green', format: 'text-reel', durationSec: 17,
    beats: [
      { text: "Same income.", durationSec: 2.5 },
      { text: "Different\n{feeling}.", durationSec: 3 },
      { text: "Bills paid.\nTaxes covered.", durationSec: 3 },
      { text: "Debt {shrinking}.\nSavings {growing}.", durationSec: 3 },
      { text: "Nothing\n{leaked}.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 3 },
    ] },

  // R11 — Pay yourself a steady paycheck (green)
  { id: 'R11', slug: 'steady-paycheck', theme: 'green', format: 'text-reel', durationSec: 20,
    beats: [
      { text: "Income\nis lumpy.", durationSec: 2.5 },
      { text: "Bills\n{are not}.", durationSec: 2.5 },
      { text: "The income\nreserve.", durationSec: 2.5 },
      { text: "{A dam}\non a river.", durationSec: 2.5 },
      { text: "Same paycheck.\n{Same day.}", durationSec: 3 },
      { text: "{Boring} is\nthe feature.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 4 },
    ] },

  // R12 — Which one are you? (multi: page → dark → green)
  { id: 'R12', slug: 'which-one', theme: 'page', format: 'text-reel', durationSec: 18,
    beats: [
      { text: "Which one\nare {you}?", durationSec: 2.5 },
      { text: "The {Freezer}.\nIt makes it {real}.", durationSec: 3, theme: 'glass-dark' },
      { text: "The {Leaker}.\nDay 30. It's {gone}.", durationSec: 3, theme: 'black' },
      { text: "The {Shame Cycle}.\nRelief, leak, {panic}.", durationSec: 3.5, theme: 'glass-dark' },
      { text: "All structural.\nNot {personal}.", durationSec: 3, theme: 'green' },
      { text: "becomeable.app", durationSec: 3, theme: 'green' },
    ] },

  // R13 — April without the panic (glass-dark)
  { id: 'R13', slug: 'april-no-panic', theme: 'glass-dark', format: 'text-reel', durationSec: 16,
    beats: [
      { text: "April without\nthe {panic}.", durationSec: 3 },
      { text: "Moved 30%\nsince {January}.", durationSec: 3 },
      { text: "The {bill}\nis paid.", durationSec: 3 },
      { text: "Just {paperwork}.\nNot an event.", durationSec: 3.5 },
      { text: "becomeable.app", durationSec: 3.5 },
    ] },

  // R14 — The compound cost of waiting (multi)
  { id: 'R14', slug: 'cost-of-waiting', theme: 'page', format: 'text-reel', durationSec: 18,
    beats: [
      { text: "The cost\nof {waiting}.", durationSec: 2.5 },
      { text: "Per month.\n{$2,000} gone.", durationSec: 3 },
      { text: "Six months.\n{$12,000} gone.", durationSec: 3, theme: 'glass-dark' },
      { text: "One year.\n{$24,000} gone.", durationSec: 3, theme: 'black' },
      { text: "Not bad.\nA {missing system}.", durationSec: 3, theme: 'black' },
      { text: "becomeable.app", durationSec: 3.5, theme: 'green' },
    ] },

  // R15 — Free 7-day trial CTA reel (green, 12s)
  { id: 'R15', slug: 'free-trial', theme: 'green', format: 'text-reel', durationSec: 12,
    beats: [
      { text: "Built for\n{inconsistent}.", durationSec: 3 },
      { text: "Every deposit.\n{Auto-routed.}", durationSec: 3 },
      { text: "Taxes. Bills.\n{Reserve.}", durationSec: 3 },
      { text: "{Free} for 7 days.", durationSec: 3 },
    ] },

  // R16 — The income reserve explained (page) — canonical explainer for the bucket-3 concept
  { id: 'R16', slug: 'income-reserve', theme: 'page', format: 'text-reel', durationSec: 18,
    beats: [
      { text: "The income\nreserve.", durationSec: 2.5 },
      { text: "A dam.\nOn a {river}.", durationSec: 2.5 },
      { text: "Big check?\n{Flows in.}", durationSec: 3 },
      { text: "Slow week?\n{Flows out.}", durationSec: 3 },
      { text: "Bills funded.\n{Always.}", durationSec: 3 },
      { text: "becomeable.app", durationSec: 4 },
    ] },

  // R17 — Set up your tax bucket (text-reel, fast actionable steps)
  { id: 'R17', slug: 'tax-bucket-setup', theme: 'white', format: 'text-reel', durationSec: 24,
    beats: [
      { text: "{Tax bucket}\nsetup.", durationSec: 3 },
      { text: "Step 1.\nSeparate {savings}.", durationSec: 3 },
      { text: "Step 2.\nPick {30%}.", durationSec: 3 },
      { text: "Step 3.\nMove it {every deposit}.", durationSec: 3 },
      { text: "Same day.\nBefore {spending}.", durationSec: 3 },
      { text: "April becomes\n{paperwork}.", durationSec: 3 },
      { text: "Not an {event}.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 3 },
    ] },

  // R18 — Your first week with Able (page)
  { id: 'R18', slug: 'first-week', theme: 'page', format: 'text-reel', durationSec: 18,
    beats: [
      { text: "First week\nwith {Able}.", durationSec: 2.5 },
      { text: "Day 1.\nSet your {tax %}.", durationSec: 2.5 },
      { text: "Day 2.\n{Pick} bills.", durationSec: 2.5 },
      { text: "Day 3.\n{Schedule} debt.", durationSec: 2.5 },
      { text: "Day 4.\n{Reserve} target.", durationSec: 2.5 },
      { text: "Day 5.\nWhat's left is {free}.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 2.5 },
    ] },

  // R19 — From spreadsheet to system (white → green)
  { id: 'R19', slug: 'spreadsheet-to-system', theme: 'white', format: 'text-reel', durationSec: 16,
    beats: [
      { text: "Your spreadsheet\nis {dying}.", durationSec: 3 },
      { text: "Opened {three times}\nthis quarter.", durationSec: 3.5 },
      { text: "Can't follow\n{variable}.", durationSec: 3 },
      { text: "Don't need a better\n{spreadsheet}.", durationSec: 3, theme: 'green' },
      { text: "Need {a system}.", durationSec: 3.5, theme: 'green' },
    ] },

  // R20 — "Save more" isn't a plan (cloud black)
  { id: 'R20', slug: 'save-more', theme: 'black', format: 'text-reel', durationSec: 18,
    beats: [
      { text: "'Save more'\nisn't a {plan}.", durationSec: 3 },
      { text: "It's a {wish}.\nDressed as advice.", durationSec: 3 },
      { text: "Saving needs\n{left over}.", durationSec: 3 },
      { text: "Variable income\nrarely {has it}.", durationSec: 3 },
      { text: "Reverse the {order}.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 3 },
    ] },

  // ── LAUNCH REELS (StoryBrand sequence — R21–R23) ──

  // R21 — L1 Tue · CHARACTER (the three personas)
  { id: 'R21', slug: 'three-of-you', theme: 'page', format: 'text-reel', durationSec: 23,
    beats: [
      { text: "There are\n{three of you}.", durationSec: 2.5 },
      { text: "The {Freezer.}\nFrozen on Day 1.", durationSec: 3 },
      { text: "The {Leaker.}\nGone by Day 30.", durationSec: 3 },
      { text: "The {Shame cycler.}\nRelief. Then panic.", durationSec: 3 },
      { text: "Same person.\n{Different week.}", durationSec: 3 },
      { text: "Not a {discipline}\nproblem.", durationSec: 2.5 },
      { text: "A {system}\nproblem.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 3.5 },
    ] },

  // R22 — REMOVED 2026-04-26 (how-i-lost-40k founder reel; per user feedback)

  // R23 — L3 Tue · PLAN (split first, spend last)
  { id: 'R23', slug: 'split-first-spend-last', theme: 'green', format: 'text-reel', durationSec: 24,
    beats: [
      { text: "{One pile.}\nFive jobs.", durationSec: 2.5 },
      { text: "1. {Taxes} —\noff the top.", durationSec: 2.5 },
      { text: "2. {Bills} —\nbefore they're due.", durationSec: 2.5 },
      { text: "3. {Smoothing} —\nfor next month.", durationSec: 2.5 },
      { text: "4. {Debt} —\non schedule.", durationSec: 2.5 },
      { text: "5. {Free} —\nguilt-free.", durationSec: 2.5 },
      { text: "{Split first.}\nSpend last.", durationSec: 3 },
      { text: "Free for {7 days}.\nbecomeable.app", durationSec: 4 },
    ] },

  // ── BRAND-MESSAGING REELS (R27–R31) ──
  // Daily-cadence text-reels filling brand-script gaps the existing 23 don't
  // hit: pure audience recognition, pure permission, identity stack, anti-hustle
  // positioning, and the $400-leak paralysis anchor.

  // R27 — Audience recognition (page → green)
  { id: 'R27', slug: 'if-youve-ever', theme: 'page', format: 'text-reel', durationSec: 14,
    beats: [
      { text: "If you've ever\n{frozen} on Day 1.", durationSec: 2.5 },
      { text: "Or {checked}\nyour balance at 1am.", durationSec: 2.5 },
      { text: "Or {dreaded}\nApril.", durationSec: 2.5 },
      { text: "You're not\n{bad with money}.", durationSec: 2.5, theme: 'green' },
      { text: "Wrong {tool}.\nNot wrong you.", durationSec: 2, theme: 'green' },
      { text: "becomeable.app", durationSec: 2, theme: 'green' },
    ] },

  // R28 — Permission reel (page → green)
  { id: 'R28', slug: 'not-your-fault', theme: 'page', format: 'text-reel', durationSec: 12,
    beats: [
      { text: "Not more\n{discipline}.", durationSec: 2 },
      { text: "Not a stricter\n{budget}.", durationSec: 2 },
      { text: "Not {trying harder}.", durationSec: 2 },
      { text: "A {system}.\nBuilt for variable.", durationSec: 3, theme: 'green' },
      { text: "{Free} for 7 days.", durationSec: 1.5, theme: 'green' },
      { text: "becomeable.app", durationSec: 1.5, theme: 'green' },
    ] },

  // R29 — New identity stack (green)
  { id: 'R29', slug: 'i-am-able', theme: 'green', format: 'text-reel', durationSec: 16,
    beats: [
      { text: "I am able\nto {pay down debt}.", durationSec: 2.5 },
      { text: "Even on\n{slow months}.", durationSec: 2.5 },
      { text: "I am able\nto {save}.", durationSec: 2.5 },
      { text: "Without\n{second-guessing}.", durationSec: 2.5 },
      { text: "I am\n{able}.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 3 },
    ] },

  // R30 — Anti-hustle positioning (cloud black)
  { id: 'R30', slug: 'boring-on-purpose', theme: 'black', format: 'text-reel', durationSec: 16,
    beats: [
      { text: "Other apps want\n{your attention}.", durationSec: 3 },
      { text: "This one wants\nthe {math right}.", durationSec: 3 },
      { text: "No streaks.\nNo {confetti}.", durationSec: 2.5 },
      { text: "No {AI insights}\nyou won't read.", durationSec: 2.5 },
      { text: "{Boring}\nis the feature.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 2.5 },
    ] },

  // R31 — Specific paralysis anchor: $400 gone (cloud black)
  { id: 'R31', slug: '400-nothing-to-show', theme: 'black', format: 'text-reel', durationSec: 14,
    beats: [
      { text: "Day 1.\n{Money lands}.", durationSec: 2.5 },
      { text: "Day 14.\n$23 here.", durationSec: 2.5 },
      { text: "$48 there.\n{$12} again.", durationSec: 2.5 },
      { text: "Day 30.\n{$400 gone}.", durationSec: 3 },
      { text: "Nothing\nto {show for it}.", durationSec: 2 },
      { text: "becomeable.app", durationSec: 1.5 },
    ] },

];
