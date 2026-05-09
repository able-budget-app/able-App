// REELS — vertical 1080×1920 short-form for IG/TikTok/Shorts
// Each reel: { id, slug, theme, format, durationSec, eyebrow, beats: [{ text, durationSec, theme? }] }
// HARD RULE: every beat is max 2 lines (one \n). Auto-fit at render time picks the largest
// font-size that fits the longest line in the reel and applies uniformly.
// {phrase} = squiggle underline (nowrap, absorbs trailing punctuation).
// \n = the ONE allowed line break — usually setup → punch.
// eyebrow: 'mixed' | 'freelance' | 'creator' | 'gig' | 'commission' | 'business'
//   Default = 'mixed' (brand default). Persona keys for targeted bunches.
window.REELS = [

  // R1 — Day 1-31 of an inconsistent month (multi: page → black → green)
  { id: 'R1', slug: 'inconsistent-month', theme: 'page', format: 'text-reel', durationSec: 24, eyebrow: 'mixed',
    beats: [
      { text: "An inconsistent\n{month}.", durationSec: 2.5 },
      { text: "Day 1.\nMoney {lands}.", durationSec: 2.5 },
      { text: "Day 7.\nA {subscription}.", durationSec: 3 },
      { text: "Day 14.\nThe {leak}.", durationSec: 2.5, theme: 'black' },
      { text: "Day 30.\n{$4,000} gone?", durationSec: 3, theme: 'black' },
      { text: "Day 31.\n{Shame.}", durationSec: 2.5, theme: 'black' },
      { text: "Not willpower.\nA {Day 1} problem.", durationSec: 3.5, theme: 'green' },
      { text: "{Free} for 30 days.\nbecomeable.app", durationSec: 4.5, theme: 'green' },
    ] },

  // R2 — Where $4,000 actually goes (cloud black)
  { id: 'R2', slug: 'where-4000-goes', theme: 'black', format: 'text-reel', durationSec: 22, eyebrow: 'mixed',
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

  // R3 — The 5 buckets in order (brand green) — order locked to app: tax→bills→debt→reserve→free
  { id: 'R3', slug: 'five-buckets', theme: 'green', format: 'text-reel', durationSec: 20, eyebrow: 'mixed',
    beats: [
      { text: "Every dollar\ngets {a job}.", durationSec: 2.5 },
      { text: "1. {Taxes.}\nOff the top.", durationSec: 2.5 },
      { text: "2. {Bills.}\nReserved early.", durationSec: 2.5 },
      { text: "3. {Debt.}\nOn schedule.", durationSec: 3 },
      { text: "4. {Reserve.}\nFor slow months.", durationSec: 3 },
      { text: "5. {Free.}\nGuilt-free.", durationSec: 3 },
      { text: "$14.99 a month.\n{Save $50} annual.", durationSec: 3.5 },
    ] },

  // R4 — 30% of every deposit (white)
  { id: 'R4', slug: 'tax-math-30', theme: 'white', format: 'text-reel', durationSec: 18, eyebrow: 'mixed',
    beats: [
      { text: "If you're paid in\n{deposits}, read this.", durationSec: 2.5 },
      { text: "Every deposit.\nRoughly {30%}.", durationSec: 2.5 },
      { text: "Belongs to\n{the IRS}.", durationSec: 2.5 },
      { text: "Not April.\n{The second} it clears.", durationSec: 3 },
      { text: "Move it.\nOr {lose it}.", durationSec: 2.5 },
      { text: "{Free} for 30 days.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 2.5 },
    ] },

  // R5 — Why budgeting apps fail (white)
  { id: 'R5', slug: 'apps-fail', theme: 'white', format: 'text-reel', durationSec: 20.5, eyebrow: 'mixed',
    beats: [
      { text: "Why apps fail\n{variable income}.", durationSec: 3 },
      { text: "They assume\na {paycheck}.", durationSec: 2.5 },
      { text: "Yours {isn't}.", durationSec: 2.5 },
      { text: "They show\nwhat {happened}.", durationSec: 3 },
      { text: "Too {late}.", durationSec: 2.5 },
      { text: "You need a system\nfor {variable}.", durationSec: 3 },
      { text: "{Free} for 30 days.", durationSec: 2 },
      { text: "becomeable.app", durationSec: 2 },
    ] },

  // R6 — You were handed the wrong tool (page)
  { id: 'R6', slug: 'wrong-tool', theme: 'page', format: 'text-reel', durationSec: 14, eyebrow: 'mixed',
    beats: [
      { text: "You're not\n{bad with money}.", durationSec: 3 },
      { text: "You were handed\nthe {wrong tool}.", durationSec: 3 },
      { text: "Every app assumes\na {paycheck}.", durationSec: 3 },
      { text: "Yours is {variable}.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 2.5 },
    ] },

  // R7 — The freezing metaphor (page → green)
  { id: 'R7', slug: 'freezing-flowing', theme: 'page', format: 'text-reel', durationSec: 18, eyebrow: 'mixed',
    beats: [
      { text: "You're not\noverspending.", durationSec: 2.5 },
      { text: "You're {freezing}.", durationSec: 2.5 },
      { text: "Money sits.\nMoney {leaks}.", durationSec: 2.5 },
      { text: "Direct it.\nOr {it leaks}.", durationSec: 3, theme: 'green' },
      { text: "Same income.\n{Different month.}", durationSec: 3, theme: 'green' },
      { text: "{Free} for 30 days.", durationSec: 2, theme: 'green' },
      { text: "becomeable.app", durationSec: 2.5, theme: 'green' },
    ] },

  // R8 — Quarterly taxes during a bad month (glass-dark)
  { id: 'R8', slug: 'bad-month-quarterly', theme: 'glass-dark', format: 'text-reel', durationSec: 18, eyebrow: 'mixed',
    beats: [
      { text: "Quarterlies due.\n{Bad month.}", durationSec: 3 },
      { text: "The {IRS}\ndoesn't care.", durationSec: 2.5 },
      { text: "Penalty:\nabout {8%}.", durationSec: 2.5 },
      { text: "Pay what you can.\nBeats {nothing}.", durationSec: 3 },
      { text: "Prevention?\n{A reserve.}", durationSec: 3 },
      { text: "becomeable.app", durationSec: 4 },
    ] },

  // R9 — The insight: not laziness, fear (page) — replaces founder-POV reel
  { id: 'R9', slug: 'fear-not-laziness', theme: 'page', format: 'text-reel', durationSec: 22, eyebrow: 'mixed',
    beats: [
      { text: "You don't fail\nat {debt} because", durationSec: 3 },
      { text: "you don't\n{want to}.", durationSec: 3 },
      { text: "You fail because\nyou're {afraid}.", durationSec: 3.5 },
      { text: "Afraid of when\nthe {next check} comes.", durationSec: 3.5 },
      { text: "A {plan}\nremoves the fear.", durationSec: 3 },
      { text: "{Free} for 30 days.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 3 },
    ] },

  // R10 — Same income. Different feeling. (green)
  { id: 'R10', slug: 'same-income', theme: 'green', format: 'text-reel', durationSec: 17, eyebrow: 'mixed',
    beats: [
      { text: "Same income.", durationSec: 2.5 },
      { text: "Different\n{feeling}.", durationSec: 3 },
      { text: "Bills paid.\nTaxes covered.", durationSec: 3 },
      { text: "Debt {shrinking}.\nSavings {growing}.", durationSec: 3 },
      { text: "Nothing\n{leaked}.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 3 },
    ] },

  // R11 — Pay yourself a steady paycheck (green)
  { id: 'R11', slug: 'steady-paycheck', theme: 'green', format: 'text-reel', durationSec: 20, eyebrow: 'mixed',
    beats: [
      { text: "Income\nis lumpy.", durationSec: 2.5 },
      { text: "Bills\n{are not}.", durationSec: 2.5 },
      { text: "Build your\n{reserve}.", durationSec: 2.5 },
      { text: "{A dam}\non a river.", durationSec: 2.5 },
      { text: "Same paycheck.\n{Same day.}", durationSec: 3 },
      { text: "{Boring} is\nthe feature.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 4 },
    ] },

  // R12 — Three days, one cycle (multi: page → dark → green) — persona labels removed
  { id: 'R12', slug: 'three-days', theme: 'page', format: 'text-reel', durationSec: 18, eyebrow: 'mixed',
    beats: [
      { text: "Which day\nare {you}?", durationSec: 2.5 },
      { text: "Day 3.\nFrozen on the {money}.", durationSec: 3, theme: 'glass-dark' },
      { text: "Day 14.\nGone before you\n{noticed}.", durationSec: 3, theme: 'black' },
      { text: "Day 31.\nRelief, then {panic}.", durationSec: 3.5, theme: 'glass-dark' },
      { text: "Same person.\n{Different week.}", durationSec: 3, theme: 'green' },
      { text: "becomeable.app", durationSec: 3, theme: 'green' },
    ] },

  // R13 — April without the panic (glass-dark)
  { id: 'R13', slug: 'april-no-panic', theme: 'glass-dark', format: 'text-reel', durationSec: 16, eyebrow: 'mixed',
    beats: [
      { text: "April without\nthe {panic}.", durationSec: 3 },
      { text: "Moved 30%\nsince {January}.", durationSec: 3 },
      { text: "The {bill}\nis paid.", durationSec: 3 },
      { text: "Just {paperwork}.\nNot an event.", durationSec: 3.5 },
      { text: "becomeable.app", durationSec: 3.5 },
    ] },

  // R14 — The compound cost of waiting (multi)
  { id: 'R14', slug: 'cost-of-waiting', theme: 'page', format: 'text-reel', durationSec: 18, eyebrow: 'mixed',
    beats: [
      { text: "The cost\nof {waiting}.", durationSec: 2.5 },
      { text: "Per month.\n{$2,000} gone.", durationSec: 3 },
      { text: "Six months.\n{$12,000} gone.", durationSec: 3, theme: 'glass-dark' },
      { text: "One year.\n{$24,000} gone.", durationSec: 3, theme: 'black' },
      { text: "Not bad.\nA {missing system}.", durationSec: 3, theme: 'black' },
      { text: "becomeable.app", durationSec: 3.5, theme: 'green' },
    ] },

  // R15 — Free 30-day trial CTA reel (green, 12s)
  { id: 'R15', slug: 'free-trial', theme: 'green', format: 'text-reel', durationSec: 12, eyebrow: 'mixed',
    beats: [
      { text: "Built for\n{inconsistent}.", durationSec: 3 },
      { text: "Every deposit.\n{Auto-routed.}", durationSec: 3 },
      { text: "Taxes. Bills.\n{Reserve.}", durationSec: 3 },
      { text: "{Free} for 30 days.", durationSec: 3 },
    ] },

  // R16 — The reserve explained (page) — canonical explainer
  { id: 'R16', slug: 'income-reserve', theme: 'page', format: 'text-reel', durationSec: 18, eyebrow: 'mixed',
    beats: [
      { text: "Your\n{reserve}.", durationSec: 2.5 },
      { text: "A dam.\nOn a {river}.", durationSec: 2.5 },
      { text: "Big check?\n{Fills up.}", durationSec: 3 },
      { text: "Slow week?\n{You draw down.}", durationSec: 3 },
      { text: "Bills funded.\n{Always.}", durationSec: 3 },
      { text: "becomeable.app", durationSec: 4 },
    ] },

  // R17 — Set up your tax bucket (text-reel, fast actionable steps)
  { id: 'R17', slug: 'tax-bucket-setup', theme: 'white', format: 'text-reel', durationSec: 24, eyebrow: 'mixed',
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
  { id: 'R18', slug: 'first-week', theme: 'page', format: 'text-reel', durationSec: 18, eyebrow: 'mixed',
    beats: [
      { text: "First week\nwith {Able}.", durationSec: 2.5 },
      { text: "Day 1.\n{Connect} your bank.", durationSec: 2.5 },
      { text: "Day 2.\n{Confirm} the plan.", durationSec: 2.5 },
      { text: "Day 3.\n{Schedule} debt.", durationSec: 2.5 },
      { text: "Day 4.\n{Reserve} target.", durationSec: 2.5 },
      { text: "Day 5.\nWhat's left is {free}.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 2.5 },
    ] },

  // R19 — From spreadsheet to system (white → green)
  { id: 'R19', slug: 'spreadsheet-to-system', theme: 'white', format: 'text-reel', durationSec: 16, eyebrow: 'mixed',
    beats: [
      { text: "Your spreadsheet\nis {dying}.", durationSec: 3 },
      { text: "Opened {three times}\nthis quarter.", durationSec: 3.5 },
      { text: "Can't follow\n{variable}.", durationSec: 3 },
      { text: "Don't need a better\n{spreadsheet}.", durationSec: 3, theme: 'green' },
      { text: "Need {a system}.", durationSec: 3.5, theme: 'green' },
    ] },

  // R20 — "Save more" isn't a plan (cloud black)
  { id: 'R20', slug: 'save-more', theme: 'black', format: 'text-reel', durationSec: 18, eyebrow: 'mixed',
    beats: [
      { text: "'Save more'\nisn't a {plan}.", durationSec: 3 },
      { text: "It's a {wish}.\nDressed as advice.", durationSec: 3 },
      { text: "Saving needs\n{left over}.", durationSec: 3 },
      { text: "Variable income\nrarely {has it}.", durationSec: 3 },
      { text: "Reverse the {order}.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 3 },
    ] },

  // ── LAUNCH REELS (StoryBrand sequence — R21–R23) ──

  // R21 — L1 Tue · CHARACTER (Day-by-Day, persona labels removed)
  { id: 'R21', slug: 'three-days-of-you', theme: 'page', format: 'text-reel', durationSec: 23, eyebrow: 'mixed',
    beats: [
      { text: "Same person.\n{Three days.}", durationSec: 2.5 },
      { text: "Day 1.\nFrozen on the {money}.", durationSec: 3 },
      { text: "Day 14.\n{Gone} before you noticed.", durationSec: 3 },
      { text: "Day 31.\nRelief. Then {panic}.", durationSec: 3 },
      { text: "Same person.\n{Different week.}", durationSec: 3 },
      { text: "Not a {discipline}\nproblem.", durationSec: 2.5 },
      { text: "A {system}\nproblem.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 3.5 },
    ] },

  // R22 — REMOVED 2026-04-26 (how-i-lost-40k founder reel; per user feedback)

  // R23 — L3 Tue · PLAN (split first, spend last) — order locked
  { id: 'R23', slug: 'split-first-spend-last', theme: 'green', format: 'text-reel', durationSec: 22, eyebrow: 'mixed',
    beats: [
      { text: "{One pile.}\nFive jobs.", durationSec: 2.5 },
      { text: "1. {Taxes} —\noff the top.", durationSec: 2.5 },
      { text: "2. {Bills} —\nbefore they're due.", durationSec: 2.5 },
      { text: "3. {Debt} —\non schedule.", durationSec: 2.5 },
      { text: "4. {Reserve} —\nfor slow months.", durationSec: 2.5 },
      { text: "5. {Free} —\nguilt-free.", durationSec: 2.5 },
      { text: "{Split first.}\nSpend last.", durationSec: 3 },
      { text: "Free for {30 days}.\nbecomeable.app", durationSec: 4 },
    ] },

  // ── BRAND-MESSAGING REELS (R27–R31) ──
  // Daily-cadence text-reels filling brand-script gaps the existing 23 don't
  // hit: pure audience recognition, pure permission, identity stack, anti-hustle
  // positioning, and the $400-leak paralysis anchor.

  // R27 — Audience recognition (page → green)
  { id: 'R27', slug: 'if-youve-ever', theme: 'page', format: 'text-reel', durationSec: 14, eyebrow: 'mixed',
    beats: [
      { text: "If you've ever\n{frozen} on Day 1.", durationSec: 2.5 },
      { text: "Or {checked}\nyour balance at 1am.", durationSec: 2.5 },
      { text: "Or {dreaded}\nApril.", durationSec: 2.5 },
      { text: "You're not\n{bad with money}.", durationSec: 2.5, theme: 'green' },
      { text: "Wrong {tool}.\nNot wrong you.", durationSec: 2, theme: 'green' },
      { text: "becomeable.app", durationSec: 2, theme: 'green' },
    ] },

  // R28 — Permission reel (page → green)
  { id: 'R28', slug: 'not-your-fault', theme: 'page', format: 'text-reel', durationSec: 12, eyebrow: 'mixed',
    beats: [
      { text: "Not more\n{discipline}.", durationSec: 2 },
      { text: "Not a stricter\n{budget}.", durationSec: 2 },
      { text: "Not {trying harder}.", durationSec: 2 },
      { text: "A {system}.\nBuilt for variable.", durationSec: 3, theme: 'green' },
      { text: "{Free} for 30 days.", durationSec: 1.5, theme: 'green' },
      { text: "becomeable.app", durationSec: 1.5, theme: 'green' },
    ] },

  // R29 — New identity stack (green)
  { id: 'R29', slug: 'i-am-able', theme: 'green', format: 'text-reel', durationSec: 16, eyebrow: 'mixed',
    beats: [
      { text: "I am able\nto {pay down debt}.", durationSec: 2.5 },
      { text: "Even on\n{slow months}.", durationSec: 2.5 },
      { text: "I am able\nto {save}.", durationSec: 2.5 },
      { text: "Without\n{second-guessing}.", durationSec: 2.5 },
      { text: "I am\n{able}.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 3 },
    ] },

  // R30 — Anti-hustle positioning (cloud black)
  { id: 'R30', slug: 'boring-on-purpose', theme: 'black', format: 'text-reel', durationSec: 16, eyebrow: 'mixed',
    beats: [
      { text: "Other apps want\n{your attention}.", durationSec: 3 },
      { text: "This one wants\nthe {math right}.", durationSec: 3 },
      { text: "No streaks.\nNo {confetti}.", durationSec: 2.5 },
      { text: "No {AI insights}\nyou won't read.", durationSec: 2.5 },
      { text: "{Boring}\nis the feature.", durationSec: 2.5 },
      { text: "becomeable.app", durationSec: 2.5 },
    ] },

  // R31 — Specific paralysis anchor: $400 gone (cloud black)
  { id: 'R31', slug: '400-nothing-to-show', theme: 'black', format: 'text-reel', durationSec: 14, eyebrow: 'mixed',
    beats: [
      { text: "Day 1.\n{Money lands}.", durationSec: 2.5 },
      { text: "Day 14.\n$23 here.", durationSec: 2.5 },
      { text: "$48 there.\n{$12} again.", durationSec: 2.5 },
      { text: "Day 30.\n{$400 gone}.", durationSec: 3 },
      { text: "Nothing\nto {show for it}.", durationSec: 2 },
      { text: "becomeable.app", durationSec: 1.5 },
    ] },

  // ── PERSONA REELS (R32-R35) — 4 audience moments ──

  // R32 — Gig moment (page → green)
  { id: 'R32', slug: 'gig-moment', theme: 'page', format: 'text-reel', durationSec: 16, eyebrow: 'gig',
    beats: [
      { text: "End of\n{a long shift}.", durationSec: 2.5 },
      { text: "Earnings hit.\n{Already gone.}", durationSec: 3 },
      { text: "Gas. Phone.\n{Tax owed.}", durationSec: 3 },
      { text: "Reserve {30%}\nthe second it lands.", durationSec: 3, theme: 'green' },
      { text: "The rest is\n{actually yours}.", durationSec: 2.5, theme: 'green' },
      { text: "becomeable.app", durationSec: 2, theme: 'green' },
    ] },

  // R33 — Creator moment (page → green)
  { id: 'R33', slug: 'creator-moment', theme: 'page', format: 'text-reel', durationSec: 17, eyebrow: 'creator',
    beats: [
      { text: "{Sponsorship} hits.", durationSec: 2.5 },
      { text: "Feels like\n{a windfall}.", durationSec: 2.5 },
      { text: "Until tax day.\n{Then it isn't.}", durationSec: 3 },
      { text: "Every payout\nsplits {five ways}.", durationSec: 3, theme: 'green' },
      { text: "Tax. Bills.\nDebt. {Reserve.} Free.", durationSec: 3.5, theme: 'green' },
      { text: "becomeable.app", durationSec: 2.5, theme: 'green' },
    ] },

  // R34 — Commission moment (glass-dark → green)
  { id: 'R34', slug: 'commission-moment', theme: 'glass-dark', format: 'text-reel', durationSec: 17, eyebrow: 'commission',
    beats: [
      { text: "Big {commission}\nlands.", durationSec: 2.5 },
      { text: "Then {crickets}\nfor weeks.", durationSec: 3 },
      { text: "Lumpy income.\n{Steady bills.}", durationSec: 3 },
      { text: "The {reserve}\nis the bridge.", durationSec: 3, theme: 'green' },
      { text: "Same paycheck.\n{Same day.}", durationSec: 3, theme: 'green' },
      { text: "becomeable.app", durationSec: 2.5, theme: 'green' },
    ] },

  // R35 — Business owner moment (white → green)
  { id: 'R35', slug: 'business-moment', theme: 'white', format: 'text-reel', durationSec: 18, eyebrow: 'business',
    beats: [
      { text: "Revenue {up}.\nOwner pay {flat}.", durationSec: 3 },
      { text: "Because every dollar\nhad {someone else's} job.", durationSec: 3.5 },
      { text: "Set an\n{owner pay} percent.", durationSec: 3, theme: 'green' },
      { text: "Every deposit\n{honors it}.", durationSec: 3, theme: 'green' },
      { text: "Pay yourself first.\n{Boring is right.}", durationSec: 3, theme: 'green' },
      { text: "becomeable.app", durationSec: 2.5, theme: 'green' },
    ] },

  // ── TIP REELS (R36-R38) — single-idea quick reels ──

  // R36 — Tip: 30% the second it clears (white)
  { id: 'R36', slug: 'tip-30-percent', theme: 'white', format: 'text-reel', durationSec: 9, eyebrow: 'mixed',
    beats: [
      { text: "One tip.\nFor {1099 income}.", durationSec: 2.5 },
      { text: "Move {30%}\nthe second it clears.", durationSec: 3 },
      { text: "Not April.\n{Day of.}", durationSec: 2 },
      { text: "becomeable.app", durationSec: 1.5 },
    ] },

  // R37 — Tip: name every dollar (page)
  { id: 'R37', slug: 'tip-name-every-dollar', theme: 'page', format: 'text-reel', durationSec: 9, eyebrow: 'mixed',
    beats: [
      { text: "One rule.\n{For variable income.}", durationSec: 2.5 },
      { text: "Every dollar\ngets {a job}.", durationSec: 3 },
      { text: "Before it\n{leaves your hand}.", durationSec: 2 },
      { text: "becomeable.app", durationSec: 1.5 },
    ] },

  // R38 — Tip: floor first (green)
  { id: 'R38', slug: 'tip-floor-first', theme: 'green', format: 'text-reel', durationSec: 9, eyebrow: 'mixed',
    beats: [
      { text: "Bills + tax\n= the {floor}.", durationSec: 2.5 },
      { text: "Fill it\n{first}.", durationSec: 2 },
      { text: "Then {everything else}\nis a real choice.", durationSec: 3 },
      { text: "becomeable.app", durationSec: 1.5 },
    ] },

  // ── STAT-FACT REELS (R39-R40) ──

  // R39 — Stat: 76% of self-employed Americans (black)
  { id: 'R39', slug: 'stat-76-percent', theme: 'black', format: 'text-reel', durationSec: 14, eyebrow: 'mixed',
    beats: [
      { text: "{76%}", durationSec: 2.5 },
      { text: "of self-employed\nAmericans.", durationSec: 2.5 },
      { text: "Have {variable}\nmonthly income.", durationSec: 3 },
      { text: "Yet {every} app\nassumes a paycheck.", durationSec: 3 },
      { text: "Built for the {76%}.", durationSec: 2 },
      { text: "becomeable.app", durationSec: 1 },
    ] },

  // R40 — Stat: 36% of US workers freelance (page → green)
  { id: 'R40', slug: 'stat-36-million', theme: 'page', format: 'text-reel', durationSec: 14, eyebrow: 'mixed',
    beats: [
      { text: "{36%}", durationSec: 2.5 },
      { text: "of US workers\nfreelance now.", durationSec: 2.5 },
      { text: "Most budgeting tools\n{don't fit them}.", durationSec: 3 },
      { text: "Built for the\n{paycheck} that doesn't\ncome every two weeks.", durationSec: 3.5, theme: 'green' },
      { text: "becomeable.app", durationSec: 2.5, theme: 'green' },
    ] },

  // ── EDU MICRO-REELS (R41) — 3-slide concept teardowns ──

  // R41 — Floor-First Budgeting in 3 beats (green)
  { id: 'R41', slug: 'edu-floor-first', theme: 'green', format: 'text-reel', durationSec: 12, eyebrow: 'mixed',
    beats: [
      { text: "{Floor-First}\nBudgeting.", durationSec: 3 },
      { text: "Floor =\nbills + {tax}.", durationSec: 3 },
      { text: "Every deposit\nfills the {floor first}.", durationSec: 3 },
      { text: "{Then} you spend.", durationSec: 3 },
    ] },

];
