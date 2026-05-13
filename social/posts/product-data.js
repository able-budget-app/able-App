// Product-shot posts. Each entry pairs an Able phone screenshot with brand
// copy on a themed canvas. ID prefix is `P` so they sort separately from
// text-only POSTS (numeric ids) and brand-script (`B*`).
//
// Schema (extends the regular post object):
//   shot: '01-dashboard' | '02-allocation-flow' | ... — folder under
//         marketing-footage/product-shots/. The 9x16.png inside is used.
//   pos:  'right' | 'left' | 'center' — phone position relative to copy.
//         Mix it up per Paul's call so the cadence doesn't get monotonous.
//
// All other post fields (theme, tpl='C', eyebrow, muted, punch, meta) work
// the same as text-only posts. Eyebrow stays 'mixed' (the brand default)
// across the set per Paul; persona-targeted product posts can be added
// later as a separate bunch.
//
// Available shots:
//   01-dashboard       06-log-income      11-tax-view
//   02-allocation-flow 07-settings        12-deep-dive
//   03-plan-bills      08-more-menu       13-tax-classify
//   04-score           09-refer           14-tax-export
//   05-coach           10-debts

window.PRODUCT_POSTS = [

  // P01 — Hero / dashboard
  { id: 'P01', slug: 'product-floor-coverage', cat: 'Product', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '01-dashboard',
    muted: "Your floor.",
    punch: "Bills + tax.\n{Funded first.}" },

  // P02 — Allocation
  { id: 'P02', slug: 'product-deposit-routed', cat: 'Product', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '02-allocation-flow',
    muted: "One deposit.",
    punch: "{Five jobs.}\nIn order." },

  // P03 — Bills
  { id: 'P03', slug: 'product-bills-funded', cat: 'Product', theme: 'white', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '03-plan-bills',
    muted: "Every bill, on the page.",
    punch: "{Funded} before\nthey're due." },

  // P04 — Score
  { id: 'P04', slug: 'product-score-100', cat: 'Product', theme: 'glass-dark', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '04-score',
    muted: "Score the month.",
    punch: "Reality.\nNot the {plan.}" },

  // P05 — Coach
  { id: 'P05', slug: 'product-coach-knows', cat: 'Product', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '05-coach',
    muted: "A coach that knows",
    punch: "{your real}\nnumbers." },

  // P06 — Log income
  { id: 'P06', slug: 'product-log-ten-seconds', cat: 'Product', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '06-log-income',
    muted: "Log what came in.",
    punch: "{Ten seconds.}\nAble does the rest." },

  // P07 — Settings
  { id: 'P07', slug: 'product-settings-honest', cat: 'Product', theme: 'white', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '07-settings',
    muted: "No tricks.",
    punch: "Just the\n{math.}" },

  // P08 — More menu
  { id: 'P08', slug: 'product-more-everything', cat: 'Product', theme: 'glass-dark', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '08-more-menu',
    muted: "Coach. Learn.",
    punch: "Refer. {All here.}" },

  // P09 — Refer
  { id: 'P09', slug: 'product-refer-month', cat: 'Product', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '09-refer',
    muted: "3 friends start a trial.",
    punch: "You get a {free month.}" },

  // P10 — Debts
  { id: 'P10', slug: 'product-debt-snowball', cat: 'Product', theme: 'black', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '10-debts',
    muted: "Highest APR first.",
    punch: "Watch it {drop.}" },

  // P11 — Tax view
  { id: 'P11', slug: 'product-tax-set-aside', cat: 'Product', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '11-tax-view',
    muted: "Off the top.\nEvery deposit.",
    punch: "April becomes\n{paperwork.}" },

  // P12 — Deep dive
  { id: 'P12', slug: 'product-deep-dive', cat: 'Product', theme: 'glass-dark', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '12-deep-dive',
    muted: "12 months of history.",
    punch: "Bills you\n{forgot} you had." },

  // P13 — Tax classify
  { id: 'P13', slug: 'product-tax-classify', cat: 'Product', theme: 'white', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '13-tax-classify',
    muted: "Tag once.",
    punch: "Able remembers\n{forever.}" },

  // P14 — Tax export
  { id: 'P14', slug: 'product-tax-export', cat: 'Product', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '14-tax-export',
    muted: "April morning.",
    punch: "{One CSV.}\nThat's it." },

  // P15 — Hero / dashboard alt theme
  { id: 'P15', slug: 'product-balance-clear', cat: 'Product', theme: 'glass-dark', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '01-dashboard',
    muted: "Available to spend.",
    punch: "Not your\n{balance.}" },

  // P16 — Bills alt
  { id: 'P16', slug: 'product-bills-no-surprise', cat: 'Product', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '03-plan-bills',
    muted: "No more dread,",
    punch: "every {1st.}" },

  // P17 — Coach alt
  { id: 'P17', slug: 'product-coach-stress', cat: 'Product', theme: 'black', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '05-coach',
    muted: "Stress-tested",
    punch: "with your {actual} bills." },

  // P18 — Log alt
  { id: 'P18', slug: 'product-log-already-split', cat: 'Product', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '06-log-income',
    muted: "Tap the amount.",
    punch: "Already {split.}" },

  // P19 — Score alt
  { id: 'P19', slug: 'product-score-honest', cat: 'Product', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '04-score',
    muted: "100/100.",
    punch: "Or {honest}\nabout why not." },

  // P20 — Tax export final CTA
  { id: 'P20', slug: 'product-tax-export-cta', cat: 'Product', theme: 'glass-dark', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '14-tax-export',
    muted: "30 days free.",
    punch: "{Try it} before\ntax season." },

  // ─────────────────────────────────────────────────────────────────────
  // BRAND-SCRIPT PRODUCT POSTS (P21-P40)
  // Each pairs a locked phrase from docs/brand-script.md with the shot
  // that earns the line. Section labels in comments map to the script.
  // ─────────────────────────────────────────────────────────────────────

  // P21 — PROBLEM (external) · "Most budgeting apps assume a steady paycheck."
  { id: 'P21', slug: 'product-bs-paycheck-assumption', cat: 'Brand-script', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '03-plan-bills',
    muted: "Most budgeting apps",
    punch: "assume a\n{paycheck.}" },

  // P22 — PROBLEM (internal) · "You freeze."
  { id: 'P22', slug: 'product-bs-you-freeze', cat: 'Brand-script', theme: 'black', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '02-allocation-flow',
    muted: "You don't move it.",
    punch: "You {freeze.}" },

  // P23 — PROBLEM (internal) · "Money that sits, leaks."
  { id: 'P23', slug: 'product-bs-money-sits-leaks', cat: 'Brand-script', theme: 'glass-dark', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '06-log-income',
    muted: "Money that sits,",
    punch: "{leaks.}" },

  // P24 — PROBLEM (philosophical) · "The problem was never you."
  { id: 'P24', slug: 'product-bs-problem-not-you', cat: 'Brand-script', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '05-coach',
    muted: "The problem",
    punch: "was never\n{you.}" },

  // P25 — VILLAIN · "Day 30. Where did $1,000 go?"
  { id: 'P25', slug: 'product-bs-day-30-leak', cat: 'Brand-script', theme: 'black', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '12-deep-dive',
    muted: "Day 30.",
    punch: "{Where} did\nit go?" },

  // P26 — GUIDE (empathy) · "It was the advice you were handed."
  { id: 'P26', slug: 'product-bs-not-your-fault', cat: 'Brand-script', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '05-coach',
    muted: "Not your fault.",
    punch: "The {advice}\nwas wrong." },

  // P27 — GUIDE (authority) · "Built for the way you actually get paid."
  { id: 'P27', slug: 'product-bs-built-for-you', cat: 'Brand-script', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '01-dashboard',
    muted: "Built for the way",
    punch: "you actually\nget {paid.}" },

  // P28 — GUIDE (positioning) · "Same foundation. Different clock."
  { id: 'P28', slug: 'product-bs-different-clock', cat: 'Brand-script', theme: 'white', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '04-score',
    muted: "Same foundation.",
    punch: "Different\n{clock.}" },

  // P29 — PLAN (step 1) · "Log what came in. Ten seconds."
  { id: 'P29', slug: 'product-bs-log-ten-seconds', cat: 'Brand-script', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '06-log-income',
    muted: "Log what came in.",
    punch: "{Ten seconds.}" },

  // P30 — PLAN (step 2) · "Able tells you where it goes."
  { id: 'P30', slug: 'product-bs-where-it-goes', cat: 'Brand-script', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '02-allocation-flow',
    muted: "Able tells you",
    punch: "where it\n{goes.}" },

  // P31 — PLAN (step 3) · "Debt drops. Savings grow."
  { id: 'P31', slug: 'product-bs-debt-drops', cat: 'Brand-script', theme: 'glass-dark', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '04-score',
    muted: "Debt drops.",
    punch: "Savings {grow.}" },

  // P32 — FAILURE STAKES · "The cost of waiting compounds."
  { id: 'P32', slug: 'product-bs-cost-of-waiting', cat: 'Brand-script', theme: 'black', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '12-deep-dive',
    muted: "The cost of waiting",
    punch: "{compounds.}" },

  // P33 — FAILURE STAKES · "The cost of starting is $14.99."
  { id: 'P33', slug: 'product-bs-cost-of-starting', cat: 'Brand-script', theme: 'white', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '07-settings',
    muted: "The cost of starting.",
    punch: "Is {$14.99.}" },

  // P34 — SUCCESS · "Nothing leaked."
  { id: 'P34', slug: 'product-bs-nothing-leaked', cat: 'Brand-script', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '03-plan-bills',
    muted: "Bills paid.",
    punch: "Nothing\n{leaked.}" },

  // P35 — SUCCESS · "End of the month, you know exactly where every dollar went."
  { id: 'P35', slug: 'product-bs-every-dollar', cat: 'Brand-script', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '04-score',
    muted: "End of the month.",
    punch: "Every {dollar}\naccounted for." },

  // P36 — SUCCESS · "The fear of the next check fades."
  { id: 'P36', slug: 'product-bs-fear-fades', cat: 'Brand-script', theme: 'glass-dark', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '05-coach',
    muted: "The fear of",
    punch: "the next check\n{fades.}" },

  // P37 — IDENTITY · "I am able to pay down debt, even on slow months."
  { id: 'P37', slug: 'product-bs-i-am-able-debt', cat: 'Brand-script', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '10-debts',
    muted: "I am able",
    punch: "to {pay down}\ndebt." },

  // P38 — IDENTITY · "I am able to save without second-guessing."
  { id: 'P38', slug: 'product-bs-i-am-able-save', cat: 'Brand-script', theme: 'green', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '04-score',
    muted: "I am able",
    punch: "to {save.}" },

  // P39 — TRANSFORMATION · "From holding your breath → To breathing."
  { id: 'P39', slug: 'product-bs-from-breath', cat: 'Brand-script', theme: 'page', tpl: 'C', eyebrow: 'mixed',
    pos: 'right', shot: '01-dashboard',
    muted: "From holding your breath.",
    punch: "To {breathing.}" },

  // P40 — TRANSFORMATION (closing tagline) · "From Unable → Able."
  { id: 'P40', slug: 'product-bs-from-unable-to-able', cat: 'Brand-script', theme: 'glass-dark', tpl: 'C', eyebrow: 'mixed',
    pos: 'left', shot: '01-dashboard',
    muted: "From {Unable.}",
    punch: "To Able." },

];


// ─────────────────────────────────────────────────────────────────────
// PRODUCT-SHOT CAROUSELS
// Multi-slide carousels using the tpl-C product-shot template alongside
// existing tpl-A (muted+punch) and tpl-B (single statement) text slides.
// ID prefix `PC` — keeps them sortable separately from the numeric C-id
// text-only carousels in data.js.
// ─────────────────────────────────────────────────────────────────────
window.PRODUCT_CAROUSELS = [

  // PC1 — Your first week with Able (product walkthrough)
  { id: 'PC1', slug: 'product-first-week', theme: 'page', format: 'tiktok', slides: [
      { tpl: 'B', eyebrow: 'Swipe →', size: 'md',
        punch: "Your first week\nwith {Able.}",
        meta: '1 / 6' },
      { tpl: 'C', eyebrow: 'Day 1', size: 'md', pos: 'right', shot: '01-dashboard',
        muted: "Connect your bank.",
        punch: "Plan ready in\n{3 minutes.}",
        meta: '2 / 6' },
      { tpl: 'C', eyebrow: 'Day 2', size: 'md', pos: 'left', shot: '06-log-income',
        muted: "First deposit lands.",
        punch: "Already\n{split.}",
        meta: '3 / 6' },
      { tpl: 'C', eyebrow: 'Day 4', size: 'md', pos: 'right', shot: '03-plan-bills',
        muted: "First bill comes due.",
        punch: "Already\n{reserved.}",
        meta: '4 / 6' },
      { tpl: 'C', eyebrow: 'Day 7', size: 'md', pos: 'left', shot: '04-score',
        muted: "End of week one.",
        punch: "Floor steady.\nReserve {growing.}",
        meta: '5 / 6' },
      { tpl: 'A', eyebrow: 'mixed', size: 'md',
        muted: "$14.99 a month.",
        punch: "Or $129 a year.\n{Save $50.}",
        meta: 'becomeable.app/get-able' },
  ] },

  // PC2 — How Able works (5-step product tour)
  { id: 'PC2', slug: 'product-how-it-works', theme: 'green', format: 'tiktok', slides: [
      { tpl: 'B', eyebrow: 'Swipe →', size: 'md',
        punch: "How {Able} works.",
        meta: '1 / 7' },
      { tpl: 'C', eyebrow: 'Step 1', size: 'md', pos: 'right', shot: '06-log-income',
        muted: "Log what came in.",
        punch: "{Ten seconds.}",
        meta: '2 / 7' },
      { tpl: 'C', eyebrow: 'Step 2', size: 'md', pos: 'left', shot: '02-allocation-flow',
        muted: "Able tells you",
        punch: "where it\n{goes.}",
        meta: '3 / 7' },
      { tpl: 'C', eyebrow: 'Step 3', size: 'md', pos: 'right', shot: '03-plan-bills',
        muted: "Bills funded",
        punch: "before they're\n{due.}",
        meta: '4 / 7' },
      { tpl: 'C', eyebrow: 'Step 4', size: 'md', pos: 'left', shot: '04-score',
        muted: "Debt drops.",
        punch: "Savings\n{grow.}",
        meta: '5 / 7' },
      { tpl: 'C', eyebrow: 'Step 5', size: 'md', pos: 'right', shot: '05-coach',
        muted: "Coach checks in",
        punch: "when something\n{looks off.}",
        meta: '6 / 7' },
      { tpl: 'A', eyebrow: 'mixed', size: 'md',
        muted: "$14.99 a month.",
        punch: "Or $129 a year.\nFree for {30.}",
        meta: 'becomeable.app/get-able' },
  ] },

  // PC3 — Built for variable income (5 features)
  { id: 'PC3', slug: 'product-built-for-variable', theme: 'glass-dark', format: 'tiktok', slides: [
      { tpl: 'B', eyebrow: 'Swipe →', size: 'md',
        punch: "Built for\n{variable income.}",
        meta: '1 / 7' },
      { tpl: 'C', eyebrow: 'The floor', size: 'md', pos: 'right', shot: '01-dashboard',
        muted: "Bills + tax.",
        punch: "{Funded first.}",
        meta: '2 / 7' },
      { tpl: 'C', eyebrow: 'Splits', size: 'md', pos: 'left', shot: '02-allocation-flow',
        muted: "Per deposit.",
        punch: "Five {jobs.}",
        meta: '3 / 7' },
      { tpl: 'C', eyebrow: 'Score', size: 'md', pos: 'right', shot: '04-score',
        muted: "Score the month.",
        punch: "Reality.\nNot the {plan.}",
        meta: '4 / 7' },
      { tpl: 'C', eyebrow: 'Coach', size: 'md', pos: 'left', shot: '05-coach',
        muted: "Knows your real",
        punch: "{numbers.}",
        meta: '5 / 7' },
      { tpl: 'C', eyebrow: 'Tax export', size: 'md', pos: 'right', shot: '14-tax-export',
        muted: "April morning.",
        punch: "{One CSV.}",
        meta: '6 / 7' },
      { tpl: 'A', eyebrow: 'mixed', size: 'md',
        muted: "30 days free.",
        punch: "Card required.\n{Cancel anytime.}",
        meta: 'becomeable.app/get-able' },
  ] },

  // PC4 — From Unable → Able (transformation arc)
  { id: 'PC4', slug: 'product-from-unable-to-able', theme: 'page', format: 'tiktok', slides: [
      { tpl: 'B', eyebrow: 'Swipe →', size: 'md',
        punch: "From {Unable.}\nTo Able.",
        meta: '1 / 7' },
      { tpl: 'A', eyebrow: 'Before', size: 'md',
        muted: "Money sits.",
        punch: "Money\n{leaks.}",
        meta: '2 / 7' },
      { tpl: 'A', eyebrow: 'Day 30', size: 'md',
        muted: "Where did $1,000 go?",
        punch: "{Shame.}\nNot a plan.",
        meta: '3 / 7' },
      { tpl: 'C', eyebrow: 'After', size: 'md', pos: 'right', shot: '01-dashboard',
        muted: "Every bill covered.",
        punch: "Every dollar\n{accounted for.}",
        meta: '4 / 7' },
      { tpl: 'C', eyebrow: 'After', size: 'md', pos: 'left', shot: '04-score',
        muted: "Nothing leaked.",
        punch: "Floor {steady.}",
        meta: '5 / 7' },
      { tpl: 'B', eyebrow: 'mixed', size: 'md',
        punch: "From holding\nyour breath.\nTo {breathing.}",
        meta: '6 / 7' },
      { tpl: 'A', eyebrow: 'mixed', size: 'md',
        muted: "30 days free.",
        punch: "{Become Able.}",
        meta: 'becomeable.app/get-able' },
  ] },

  // PC5 — Tax season, simplified (4 tax features)
  { id: 'PC5', slug: 'product-tax-season', theme: 'white', format: 'tiktok', slides: [
      { tpl: 'B', eyebrow: 'Swipe →', size: 'md',
        punch: "Tax season,\n{simplified.}",
        meta: '1 / 6' },
      { tpl: 'C', eyebrow: 'Off the top', size: 'md', pos: 'right', shot: '11-tax-view',
        muted: "Every deposit.",
        punch: "Tax {set aside}\nfirst.",
        meta: '2 / 6' },
      { tpl: 'C', eyebrow: 'Tag once', size: 'md', pos: 'left', shot: '13-tax-classify',
        muted: "Mark a deductible.",
        punch: "Able remembers\n{forever.}",
        meta: '3 / 6' },
      { tpl: 'C', eyebrow: 'Find more', size: 'md', pos: 'right', shot: '12-deep-dive',
        muted: "12 months of history.",
        punch: "Bills you\n{forgot} you had.",
        meta: '4 / 6' },
      { tpl: 'C', eyebrow: 'Export', size: 'md', pos: 'left', shot: '14-tax-export',
        muted: "April morning.",
        punch: "{One CSV.}",
        meta: '5 / 6' },
      { tpl: 'A', eyebrow: 'mixed', size: 'md',
        muted: "30 days free.",
        punch: "Card required.\n{Cancel anytime.}",
        meta: 'becomeable.app/get-able' },
  ] },

  // PC6 — The slow month (reserve mechanic walkthrough)
  { id: 'PC6', slug: 'product-slow-month', theme: 'glass-dark', format: 'tiktok', slides: [
      { tpl: 'B', eyebrow: 'Swipe →', size: 'md',
        punch: "When the\n{slow month}\nhits.",
        meta: '1 / 7' },
      { tpl: 'A', eyebrow: 'The fact', size: 'md',
        muted: "Income drops.",
        punch: "Bills\n{don't.}",
        meta: '2 / 7' },
      { tpl: 'C', eyebrow: 'Build it', size: 'md', pos: 'right', shot: '01-dashboard',
        muted: "Every deposit.",
        punch: "A slice to the\n{reserve.}",
        meta: '3 / 7' },
      { tpl: 'C', eyebrow: 'When you need it', size: 'md', pos: 'left', shot: '05-coach',
        muted: "Coach checks in.",
        punch: "Suggests the\n{move.}",
        meta: '4 / 7' },
      { tpl: 'C', eyebrow: 'Result', size: 'md', pos: 'right', shot: '03-plan-bills',
        muted: "Bills still covered.",
        punch: "Floor {steady.}",
        meta: '5 / 7' },
      { tpl: 'B', eyebrow: 'mixed', size: 'md',
        punch: "Slow months\nstop being\n{a crisis.}",
        meta: '6 / 7' },
      { tpl: 'A', eyebrow: 'mixed', size: 'md',
        muted: "$14.99 a month.",
        punch: "Or $129 a year.\n{Save $50.}",
        meta: 'becomeable.app/get-able' },
  ] },

  // PC7 — 5 things you stop doing (anti-pattern reframe)
  { id: 'PC7', slug: 'product-stop-doing', theme: 'green', format: 'tiktok', slides: [
      { tpl: 'B', eyebrow: 'Swipe →', size: 'md',
        punch: "5 things you\n{stop} doing\nwith Able.",
        meta: '1 / 7' },
      { tpl: 'C', eyebrow: 'No 1', size: 'md', pos: 'right', shot: '01-dashboard',
        muted: "Stop holding",
        punch: "your {breath}\non the 1st.",
        meta: '2 / 7' },
      { tpl: 'C', eyebrow: 'No 2', size: 'md', pos: 'left', shot: '03-plan-bills',
        muted: "Stop bracing",
        punch: "for {bills.}",
        meta: '3 / 7' },
      { tpl: 'C', eyebrow: 'No 3', size: 'md', pos: 'right', shot: '05-coach',
        muted: "Stop guessing",
        punch: "if it'll\n{work out.}",
        meta: '4 / 7' },
      { tpl: 'C', eyebrow: 'No 4', size: 'md', pos: 'left', shot: '14-tax-export',
        muted: "Stop dreading",
        punch: "{April.}",
        meta: '5 / 7' },
      { tpl: 'C', eyebrow: 'No 5', size: 'md', pos: 'right', shot: '04-score',
        muted: "Stop pretending",
        punch: "the plan\n{worked.}",
        meta: '6 / 7' },
      { tpl: 'A', eyebrow: 'mixed', size: 'md',
        muted: "30 days free.",
        punch: "{Try it} once.",
        meta: 'becomeable.app/get-able' },
  ] },

  // PC8 — Why apps fail variable income (problem → solution)
  { id: 'PC8', slug: 'product-why-apps-fail', theme: 'glass-dark', format: 'tiktok', slides: [
      { tpl: 'B', eyebrow: 'Swipe →', size: 'md',
        punch: "Why apps fail\n{variable income.}",
        meta: '1 / 7' },
      { tpl: 'A', eyebrow: 'Reason 1', size: 'md',
        muted: "They assume",
        punch: "a {paycheck.}",
        meta: '2 / 7' },
      { tpl: 'A', eyebrow: 'Reason 2', size: 'md',
        muted: "They want monthly.",
        punch: "Yours is\n{lumpy.}",
        meta: '3 / 7' },
      { tpl: 'A', eyebrow: 'Reason 3', size: 'md',
        muted: "They show",
        punch: "what {happened.}\nToo late.",
        meta: '4 / 7' },
      { tpl: 'C', eyebrow: 'The fix', size: 'md', pos: 'right', shot: '02-allocation-flow',
        muted: "Per deposit.",
        punch: "Not per\n{month.}",
        meta: '5 / 7' },
      { tpl: 'C', eyebrow: 'The fix', size: 'md', pos: 'left', shot: '04-score',
        muted: "Score reality.",
        punch: "Not the\n{plan.}",
        meta: '6 / 7' },
      { tpl: 'A', eyebrow: 'mixed', size: 'md',
        muted: "Built for",
        punch: "{inconsistent}\nincome.",
        meta: 'becomeable.app/get-able' },
  ] },

];
