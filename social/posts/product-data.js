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
    punch: "{Five jobs} —\nin order." },

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
