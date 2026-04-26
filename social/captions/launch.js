// Captions for the Able social cadence.
// (Originally W1–W3 launch; now W1–W8 and growing.)
//
// Keyed by "week|day" (e.g. "1|Mon"). Each record:
//   ig    — Instagram caption (single, reel, or carousel cover). Trailing CTA "Link in bio."
//   tt    — TikTok caption. URL inlined (TikTok allows it).
//   li    — LinkedIn caption body. Do NOT include the trailing URL —
//           build-master-sheet.js appends `\n\n{relevant_links}` automatically.
//   links — (optional) override for the relevant_links column. Defaults to "becomeable.app".
//
// Voice rules: short sentences, no em dashes, no emojis, permission-not-blame,
// no founder name, $14.99/mo + $129/yr (NOT $9.99/$79), 7-day free trial (card required).

window.LAUNCH_CAPTIONS = {

  // ─────────────────────────────────────────────────────────
  // W1 — Hero & problem (you)
  // ─────────────────────────────────────────────────────────

  '1|Mon': {
    // 55 income-in-waves · single
    ig: `If your income comes in waves, this is for you.

Not a paycheck. Not a cliff. Not consistent.
A wave. Some weeks: high tide. Some weeks: dry.

You don't need more discipline.
You need a budget that bends with the water.

Built for waves. Free for 7 days.
Link in bio.

#freelancing #1099life #variableincome #budgeting #creatorlife`,

    tt: `If your income comes in waves, this is for you.

Not a paycheck. A wave.
Most apps assume you have a tide table.
You don't.

Built for variable. becomeable.app

#freelancetok #1099 #variableincome`,

    li: `If your income comes in waves, this is for you.

Most budgeting tools were built for someone with a paycheck. A predictable amount, on a predictable Friday, that lands in a predictable account. The whole shape of the tool depends on that assumption.

If you freelance, run a one-person business, sell on commission, or live off royalties, that shape doesn't fit. Your income lands when it lands. Some months it's high tide. Some months it's dry. The advice "save 20% of every paycheck" turns into "save 20% of nothing" half the time.

The fix isn't more discipline. It's a tool that bends with the water.

Built Able for that. Free for 7 days, $14.99/mo or $129/yr after.`,
  },

  '1|Tue': {
    // R21 three-of-you · reel
    ig: `There are three of you on Day 30.

The Freezer: money came in, you couldn't make a single move.
The Leaker: it's gone. $14 at a time. Zero bills paid.
The Shame Cycler: relief, spend, hate, repeat.

Same person. Different week.
That's not a discipline problem. That's a system problem.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #moneymindset`,

    tt: `You're not three different people. You're one person without a system.

Freezer. Leaker. Shame cycler.
Same you, different week.

becomeable.app

#freelancetok #moneytok #1099`,

    li: `There are three of you at the end of every month.

The Freezer: money came in, but you couldn't make a single decision. Day 30 looks identical to Day 1.

The Leaker: it's gone. $14 here. A subscription there. Lunch on a Tuesday. Nothing paid down. Nothing saved. Nothing to show for it.

The Shame Cycler: relief when it lands, spending while it's there, panic when it isn't, shame when it ends. Repeat next month.

Same person. Different week.

This is not a discipline problem. Three different "discipline failures" in three weeks doesn't add up to a willpower diagnosis. It adds up to a missing system. Specifically, a system built for income that doesn't follow a schedule.

That's what Able is. Free for 7 days, $14.99/mo or $129/yr after.`,
  },

  '1|Wed': {
    // C39 three-kinds-of-broke · carousel
    ig: `Three kinds of broke at Day 30 →

Swipe to find which week you're in. (You'll recognize all three.)

It's not willpower. It's the wrong tool. Apps built for a paycheck don't work when your paycheck doesn't exist.

Built for variable income. Free for 7 days.
Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Three kinds of broke at Day 30 →

Freezer. Leaker. Shame cycler.
Same person. Different week.
Wrong tool. Not wrong you.

becomeable.app

#freelancetok #1099 #variableincome`,

    li: `There are three kinds of broke at Day 30. You'll recognize all three.

Type 1: The Freezer. Money came in. Never moved. Day 30 looks like Day 1, except the bills came due in between. The freeze isn't laziness. It's overwhelm — too many small decisions, no clear order to make them in.

Type 2: The Leaker. The money came in and dissolved. $14 here. A subscription. A lunch. Gas. By Day 30, there's no big purchase to point at, but there's also no money. Nothing paid down. Nothing saved.

Type 3: The Shame Cycler. Relief when it lands. Spending while it's there. Panic when it isn't. Shame when it ends. The cycle is the symptom, not the cause.

Same person. Different week.

The reason most budgeting apps don't fix any of these is that they were built for a steady paycheck. Envelopes for next month assume you know what's coming next month. A "save 20%" rule assumes a 20% you can spare every period. None of that maps to variable income.

The fix is a system that doesn't pretend your paycheck looks like everyone else's. Built Able to be that system.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '1|Thu': {
    // 56 under-equipped · single
    ig: `If money makes you freeze, you're not lazy. You're under-equipped.

The freeze is a real response. Money lands. You know there are bills. Taxes. Debt. A vague feeling of "I should save." But you don't know which decision to make first, so you don't make any of them. Day 1 to Day 30, the money sits and leaks.

That's not a willpower failure. That's missing tools.

Built for the freeze. Free for 7 days.
Link in bio.

#freelancing #1099life #variableincome #moneymindset #selfemployed`,

    tt: `If money makes you freeze, you're not lazy. You're under-equipped.

It's not a discipline thing. It's a tool thing.

becomeable.app

#freelancetok #moneytok #1099`,

    li: `If money makes you freeze, you're not lazy. You're under-equipped.

The pattern shows up everywhere. Money lands. You know, in the abstract, that there are bills. Taxes. Debt. A vague feeling of "I should be saving." But you don't know which decision to make first, and the cost of the wrong call feels high, so you don't make any decision at all.

Day 1 to Day 30, the money sits. While it sits, it leaks.

The dominant interpretation of that pattern, especially online, is that it's a discipline problem. "You just need to be more disciplined with money." That framing makes the person feel worse without giving them anything to do differently.

The freeze isn't a willpower failure. It's the predictable response to a setup that doesn't have an obvious next move. You're not under-disciplined. You're under-equipped.

The fix is a tool that names the next move for you, the moment money arrives. That's what Able does.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '1|Fri': {
    // C40 built-wrong-for-you · carousel
    ig: `Why every budgeting app fails you specifically →

Swipe for the four assumptions they're built on (and you don't have any of them).

You don't need more discipline. You need a system that doesn't pretend.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Why budgeting apps fail you specifically →

They assume a paycheck. You don't have one.
They want envelopes for next month. You don't know yet.
They expect a fixed surplus. You have variable.
They tell you to save more. That's a wish.

becomeable.app

#freelancetok #1099 #budgeting`,

    li: `Every budgeting app fails you for the same four reasons. None of them are about you.

One. They assume a paycheck. A predictable amount, on a predictable day. If you freelance, contract, run a one-person business, or sell on commission, you don't have one. The whole foundation of the tool is off.

Two. They give you envelopes for next month. Envelopes assume you know what's coming. If your next deposit is a maybe-Tuesday-maybe-the-15th-maybe-not-this-month situation, the envelopes are full of guesses. Guesses make the tool worse than no tool.

Three. They expect a fixed surplus. "Save 20% every paycheck" is built on the same broken assumption as the paycheck itself. If your income is variable, your surplus is variable, and 20% of an unknown is also an unknown.

Four. They tell you to "save more." That's not a system. That's a wish in business-casual.

You don't need more discipline. You need a system that doesn't pretend your income looks like a regular paycheck.

That's what Able is built for.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '1|Sat': {
    // 57 wrong-tool-handed · single
    ig: `You're not bad with money. You've been handed the wrong tool.

If you've ever read a budgeting article and thought "this isn't built for me" — you were right. It wasn't.

Built for variable income. Free for 7 days.
Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `You're not bad with money. You've been handed the wrong tool.

The whole industry assumes you have a paycheck. You don't.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `You're not bad with money. You've been handed the wrong tool.

Every budgeting framework you've ever read was built for someone with a steady paycheck. A predictable amount, on a predictable day, with a predictable tax withholding done for them. If your income looks like that, the tools work. The math math's, the envelopes envelope.

If your income doesn't look like that — freelancers, contractors, creators, commission roles, one-person businesses — the same tools fail. Not because you can't follow them. Because they were never built for the shape of your income in the first place.

You can spend a decade trying to be "better with money" using a tool that was wrong from the start. Most people do. The shame compounds. The numbers don't move.

The fix isn't more willpower. It's the right tool for the shape of your income.

Built Able for that shape. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '1|Sun': {
    // B07 audience-built-for-ents · brandscript
    ig: `Built for entrepreneurs with inconsistent income.

Not freelancers, not contractors, not "self-employed" as a checkbox on a form — entrepreneurs. People who run their own thing and live off whatever it pays.

The whole tool assumes that. Free for 7 days.
Link in bio.

#entrepreneur #freelancing #1099life #variableincome #smallbusiness`,

    tt: `Built for entrepreneurs with inconsistent income.

The whole app assumes your paycheck doesn't exist.

becomeable.app

#entrepreneur #freelancetok #1099`,

    li: `Built for entrepreneurs with inconsistent income.

Most "money tools for entrepreneurs" are spreadsheets with a coat of paint, or apps designed for a W-2 worker that say the word "freelancer" in their marketing. The math underneath assumes a steady paycheck either way.

Able is built the other direction. The whole product assumes:

— Your income doesn't follow a schedule.
— You owe taxes nobody is withholding for you.
— Some months are up. Some months are nothing. Both are normal.
— You need every dollar to have a job the moment it arrives, because if it sits, it leaks.

If you're an entrepreneur with inconsistent income — freelance, contract, creator, one-person business — the tool was built for the actual shape of your money.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  // ─────────────────────────────────────────────────────────
  // W2 — Guide (we get it, we built this)
  // ─────────────────────────────────────────────────────────

  '2|Mon': {
    // 58 the-loop · single
    ig: `The loop, every month, on schedule:

Day 14: brace.
Day 30: blame.
Day 1: forget you ever blamed.

The loop isn't a flaw in you. It's the predictable output of a system that was never built. We built one.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #moneymindset #selfemployed`,

    tt: `The loop:

Day 14: brace.
Day 30: blame.
Day 1: forget you ever blamed.

Built a system to break it.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `The loop runs every month. On schedule.

Day 14: you brace. The "where am I" feeling kicks in. The unread bank app stays unread. You start being careful in a vague, anxious way that doesn't actually change anything.

Day 30: you blame. Yourself, mostly. "Why am I bad at this." "Other people don't live like this." The shame is sharper than the actual shortfall.

Day 1: a deposit lands. The relief is so total that you forget you ever blamed yourself. You're back to "okay this time it'll be different." It won't be, because nothing changed.

The loop is not a personal failing. It's the predictable output of a setup with no real system underneath. The brace, the blame, and the forget all happen because there is no answer to "where does each dollar go the moment it arrives." Without that answer, the only available coping strategy is the loop.

The fix is the answer. Every dollar gets a job. Day 1, automatically. Built Able to do that.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '2|Tue': {
    // R28 not-your-fault · reel
    ig: `What you actually need:

Not more discipline.
Not a stricter budget.
Not "trying harder."

A system. Built for variable income.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #moneymindset #budgeting`,

    tt: `Not more discipline. A system.

becomeable.app

#freelancetok #moneytok #1099`,

    li: `The cycle isn't your fault. It's a missing system.

Every time you hit "where did the money go?" at the end of a month, the dominant story is that you should have tried harder. Been more disciplined. Resisted more. The next month, you try harder. The result is the same.

The reason the result is the same is that effort isn't the missing variable. The missing variable is a system that decides — at the moment money arrives — what each dollar's job is. Taxes, off the top. Bills, set aside. A buffer for slow months. Debt, on schedule. What's left, yours to spend, guilt-free.

When that system runs, "discipline" becomes irrelevant. The decisions are already made. There's nothing to white-knuckle.

Built Able to be that system. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '2|Wed': {
    // B21 permission-not-discipline · brandscript
    ig: `You don't need more discipline. You need a plan built for income like yours.

If your income is variable, the "save 20% of every paycheck" advice is broken before it starts. You don't have a steady 20%. You don't have a steady anything.

Built for income like yours. Free for 7 days.
Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `You don't need more discipline. You need a plan built for income like yours.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `You don't need more discipline. You need a plan built for income like yours.

Almost every piece of personal finance advice you'll read in the next 24 hours assumes your income is steady. "Pay yourself first." "Save 20% of every paycheck." "Set up automatic transfers on the 1st and 15th." All of it falls apart the moment your paycheck doesn't follow a schedule.

When the advice fails, the dominant interpretation is: I'm undisciplined. The truer interpretation is: the advice was built for someone whose money behaves differently than mine.

A plan built for income like yours starts with different assumptions:

— Some months are big. Some are nothing.
— Tax has to come off the top, every deposit, no exceptions.
— A buffer between months matters more than a single emergency fund.
— "Free spending" is what's left after all jobs are covered, not what's first to feel safe.

Able is built around those assumptions. The discipline most people are reaching for stops being relevant once the plan fits the income.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '2|Thu': {
    // 59 not-a-cfo · single
    ig: `You shouldn't have to be a CFO to have a calm month.

But that's the bar most "money tools" set. Spreadsheets. Categories. Quarterly projections. If you wanted a finance job, you'd have one.

A calm month should be the default, not a reward for advanced bookkeeping.

Built that way. Free for 7 days.
Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `You shouldn't have to be a CFO to have a calm month.

But every other app is asking you to be one.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `You shouldn't have to be a CFO to have a calm month.

Run through what most "tools for self-employed people" actually require: download statements, categorize transactions, reconcile a spreadsheet, project quarterly tax, separate business and personal, build a 12-month forecast. That's a finance job. People who run businesses for a living hire someone to do that.

If you're a one-person business — freelancer, creator, consultant, contractor — you're already doing the work that pays. Adding a second job to manage the money from the first one is a recipe for nothing changing.

A calm month should be the floor, not a reward for advanced bookkeeping. The tool's job is to do the CFO work for you, in the background, the moment money arrives. Your job is to do the work that brings the money in.

That's the split Able is built around.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '2|Fri': {
    // C42 calm-month · carousel
    ig: `What a calm month actually feels like →

Swipe for the day-by-day. (Spoiler: nothing exciting happens. That's the entire point.)

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `What a calm month actually feels like →

Day 1: deposit lands. Already sorted.
Day 7: first bill auto-pays. You don't think about it.
Day 14: you open the app, smile, close it.
Day 30: no surprises. April-proof.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `What a calm month actually feels like, day by day.

Day 1. A deposit lands. The moment it arrives, it's already sorted into jobs — tax set aside, bills covered, a slice for the buffer, a slice for debt, what's left is yours to spend without guilt. There is nothing for you to do.

Day 7. The first bill auto-pays. The money was set aside on Day 1, so it's not a question of "do we have it?" — it's already gone, doing the job it was set aside to do. You don't think about it. You don't even register it happened.

Day 14. You open Able. You glance at the numbers. Nothing's wrong. You close it. That's the entire interaction.

Day 30. End of month. No surprises. The tax money is sitting where it was always going to sit until April. The bills got paid. The buffer is full. There's nothing to brace for.

This is what calm-specific feels like. Boring on purpose. Specific by design. The opposite of every "money insights dashboard" that wants your attention every day.

If your last 12 months looked nothing like this, that's not a discipline gap. That's a missing system.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '2|Sat': {
    // 60 boring-on-purpose · single
    ig: `Boring is the goal. Specific is how you get there.

Most money apps want you opening them every day. Notifications. Streaks. AI insights. Engagement.

Able wants the opposite. Open it less. Forget about it more. The math runs while you're doing your actual job.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Boring is the goal. Specific is how you get there.

The best money tool is the one you forget about.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Boring is the goal. Specific is how you get there.

The current generation of money apps is built around engagement. Notifications, streaks, "AI insights," daily dashboards, push messages telling you about your spending. The metric the company is optimizing for is your time inside the app.

That metric is the wrong metric for you.

The thing you actually want is to think about money less. Not in a denial way — in a "the system is running and I trust it" way. The right tool is the one you open less and less over time, because the questions stop being open questions.

Boring is the goal. Specific is how you get there. Specifically: every dollar gets a job the moment it arrives, taxes come off the top, bills are covered before they're due, the buffer protects slow months, debt drops on schedule, what's left is yours to spend. With those decisions made automatically, there's nothing to obsess over.

Built Able for that. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '2|Sun': {
    // B22 solution-every-dollar-job · brandscript
    ig: `Able gives every dollar a job the moment it arrives.

No leftover money. No "we'll figure it out later." Every deposit, sorted into taxes, bills, buffer, debt, free spending — before you even see it.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Every dollar gets a job the moment it arrives.

That's the whole product.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Able gives every dollar a job the moment it arrives.

The reason money "disappears" between Day 1 and Day 30 is that it sits idle. Idle money is not idle for long — it leaks. $14 here. A subscription. A weekend. The leak isn't dramatic, which is why you can't see it. By Day 30, $400-$1,000 is gone, and there's nothing to point to.

The fix is to never let money be idle in the first place. Every dollar gets a job — taxes off the top, bills covered, a slice to a buffer for slow months, debt killed down, what's left yours to spend, guilt-free — at the exact moment the deposit hits.

When the money has a job, it stops drifting. The leak closes.

That's the entire mechanic Able runs on.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  // ─────────────────────────────────────────────────────────
  // W3 — Plan + CTA + success/failure
  // ─────────────────────────────────────────────────────────

  '3|Mon': {
    // 61 split-first · single
    ig: `One pile. Five jobs. Split first. Spend last.

That's the whole model.

Taxes. Bills. Smoothing. Debt. Free.
In that order. Every deposit. Automatically.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `One pile. Five jobs. Split first. Spend last.

That's it. That's the whole model.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `One pile. Five jobs. Split first. Spend last.

Most personal finance is built around a "spend, then save what's left" model. With variable income, "what's left" is almost always nothing. By the end of the month, the money has drifted to small things and the big jobs — taxes, debt, savings — went unfunded again.

Flip the order.

Every deposit splits, the moment it arrives, into five jobs:

1. Taxes — off the top, untouchable.
2. Bills — current cycle, set aside before they're due.
3. Smoothing — the buffer that keeps slow months from breaking the system.
4. Debt — on schedule, every month, no skipping.
5. Free — what's left, yours to spend, guilt-free.

Spend last. Out of bucket five only. The first four are protected because the split happened before any spending was possible.

Built Able to run this exact model, automatically. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '3|Tue': {
    // R23 split-first-spend-last · reel
    ig: `One pile. Five jobs. In order:

1. Taxes — off the top.
2. Bills — before they're due.
3. Smoothing — for the slow months.
4. Debt — on schedule.
5. Free — guilt-free.

Split first. Spend last.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `One pile. Five jobs. Split first. Spend last.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `The five-bucket order, in plain English.

One. Taxes — off the top, the moment a deposit lands. The IRS isn't withholding for you. Pretend they are. Move 25-30% of every dollar to a place you don't see.

Two. Bills — the current cycle's known obligations, set aside before they're due. Not "we'll have it by the 15th." Already gone. Already in a separate place. Auto-pays draw from there.

Three. Smoothing — the buffer between months. The thing that lets a slow month not break the system. Most personal finance frameworks skip this entirely because they assume your income is steady. Yours isn't.

Four. Debt — on schedule, every month, including slow months. The reason debt-payoff plans fail isn't motivation. It's that they get skipped on bad months until the plan dies.

Five. Free spending — what's left, yours, guilt-free. This bucket is small on purpose. It's the only bucket you spend out of, which means it's also the only spending decision you have to make.

Split first. Spend last. The order matters more than the math.

That's Able. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '3|Wed': {
    // C45 how-breathing-again-works · carousel
    ig: `How breathing again works →

Three steps. The whole system. (Swipe.)

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `How breathing again works →

1. Log what came in. 10 seconds.
2. Able tells you where it goes.
3. Tap each move off.

Debt drops. Savings grow. The fear fades.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `How breathing again works, in three steps.

Step one. Log what came in. Ten seconds. Any amount. Any source. Cash, check, deposit, Stripe payout, whatever. The point is naming the deposit and naming the amount.

Step two. Able tells you where it goes. Bills. Debt. Savings. Smoothing. Free. The split happens automatically based on the rules you set up once. There is no "what should I do with this $1,400" decision to make. The decision is already made.

Step three. Tap each move off as you do it. Each tap is a tiny dopamine hit — proof that the system is running, proof that the money is going where it's supposed to go.

Run that loop for a few months. Debt drops. Savings grow. The fear that runs in the background of every Sunday afternoon starts to fade. Not because you became more disciplined. Because the system you needed finally exists.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '3|Thu': {
    // 62 april-surprise-shame · single
    ig: `What you avoid:

April.
Surprise.
Shame.

(The biggest reason people don't build a system isn't laziness. It's avoiding the look at how bad it's gotten. The system makes the look unnecessary.)

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #taxes #selfemployed`,

    tt: `What you avoid:

April. Surprise. Shame.

A system means the look is unnecessary.

becomeable.app

#freelancetok #1099 #taxtok`,

    li: `What an actual system gets you, summarized in three things you stop having:

April. The annual tax surprise. The "wait, how much?" panic in mid-March. The scrambling to come up with money you didn't set aside. With taxes coming off the top of every deposit, April is just "yep, here's the money I already had aside for this." A non-event.

Surprise. The bigger pattern: a year of small leaks adding up to a number you didn't see coming. End-of-year, end-of-month, end-of-quarter. Surprise is the symptom of a system that doesn't tell you what's coming. The fix isn't more spreadsheets. It's a real-time system that runs in the background.

Shame. The hardest one to name. The reason most people don't build a real system isn't that they don't want to — it's that they don't want to look at how bad it's gotten. The shame of opening the bank app is what keeps it closed. A system makes the look unnecessary, because there's nothing scary to find. The numbers are doing what they're supposed to do.

That's the actual offer. Not "save more." Not "try harder." A system that ends those three things.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '3|Fri': {
    // C44 day-1-to-90 · carousel
    ig: `Day 1 to Day 90 with Able →

The actual timeline. (No "results may vary" — nothing happens on its own. The timeline is the system running.)

Swipe.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Day 1 → Day 90 with Able →

Day 1: 8 min setup.
Day 7: first auto-allocation. Felt weird, in a good way.
Day 14: first bill paid itself.
Day 30: didn't open it for 3 days. That's the win.
Day 60: first calm month. No bracing.
Day 90: you don't recognize past-you.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Day 1 to Day 90 with Able. The actual timeline.

Day 1. Setup. Eight minutes. Connect a bank or don't (manual works). Tell Able your expected income. Pick your buckets — defaults work. That's it.

Day 7. First auto-allocation. A deposit hits. The split runs. The first time, it feels weird. You've never had money "decided" the moment it arrived. Weird in a good way.

Day 14. First bill auto-pays — except the money was already set aside on Day 1. The bill paying itself isn't dramatic. You forgot it was due, and it didn't matter.

Day 30. End of the first month. You don't open the app for three days in a row. That's the win. The system is running and you don't need to babysit it.

Day 60. First calm month. No bracing. No leak. The end-of-month feeling is "what should I do with the leftover?" instead of "where did it all go?"

Day 90. You don't recognize past-you. The freezing, the panic, the avoidance — all of that was downstream of not having a system. Now there is one.

This is not a "results may vary" pitch. The timeline isn't a promise about how fast you'll see results — it's the system doing its job in calendar time. Show up, log deposits, let the rules run.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '3|Sat': {
    // 63 free-seven-days · single
    ig: `Free for 7 days.

If you've made it to this post and you're still scrolling — the cost of one more month of "I'll figure it out later" is bigger than the cost of trying.

Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Free for 7 days. Card on file. Cancel anytime.

If you've watched this far, you already know.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Free for 7 days.

The math of waiting on this one is the easiest math in the post.

Every month you go without a system, the leak runs. $400-$1,000 in small things — subscriptions, lunches, gas, the unaccounted-for. Multiplied by twelve months a year, multiplied by however many years you've been telling yourself you'll figure this out later.

Seven days, free, to see whether the system actually works for the shape of your income. After that, $14.99/mo or $129/yr — the price of one of the leaks you'll close in the first week.

Card required at signup. Cancel anytime in the trial with no charge.`,
  },

  '3|Sun': {
    // B41 transform-unable-to-able · brandscript
    ig: `From Unable → Able.

The whole brand is in two words. Unable was the freezing, the leaking, the bracing, the shame. Able is the math running, the bills paid, the breath taken.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #identity #selfemployed`,

    tt: `From Unable → Able.

That's the whole point.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `From Unable to Able.

The name is the whole brand promise, and the arrow between the two words is the entire product.

Unable is the version of you that can't make a single decision when money lands, can't trust a number you wrote down last week, can't open the bank app on a Sunday, can't say "yes" to a slow month without bracing for what it means in April.

Able is the version of you that knows what each dollar is doing, knows what's coming, knows that a slow month is already accounted for, knows that taxes are sitting where they're supposed to be sitting. The version that is, in plain English, able.

The arrow between them is a system that doesn't pretend your income looks like a paycheck. Splits every deposit into jobs the moment it arrives. Auto-pays bills before they're due. Builds a buffer that protects slow months. Kills debt on schedule. Leaves what's left for you, guilt-free.

There is no "becoming able" without that arrow. Discipline alone doesn't get you there, because the freezing was never about discipline.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  // ─────────────────────────────────────────────────────────
  // W4 — Sustain · brand reinforcement
  // ─────────────────────────────────────────────────────────

  '4|Mon': {
    // 09 free-to-try · single
    ig: `Free to try. Built for inconsistent income.

If your last twelve months looked nothing like a steady paycheck, this is the budgeting tool built for that. Not "for entrepreneurs" as a marketing line — for the actual shape of your money.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Free to try. Built for inconsistent income.

becomeable.app

#freelancetok #1099 #variableincome`,

    li: `Free to try. Built for inconsistent income.

The "free to try" matters because most people in the variable-income camp have already paid for two or three budgeting apps that didn't fit. The trial is to prove the tool actually works for the shape of your money before you commit a single dollar.

The "built for inconsistent income" matters because every other budgeting tool you've tried was built for a steady paycheck and rebranded for freelancers. Different surface, same broken assumption underneath.

Seven days, free, no charge in the trial. Card required at signup. Cancel anytime in those seven days with zero charge. After that, $14.99/mo or $129/yr.`,
  },

  '4|Tue': {
    // R15 free-trial · reel
    ig: `Built for inconsistent income. Every deposit auto-routed.

Taxes. Bills. Reserve. Debt. Free.
The split happens the moment money lands. You don't have to think.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Built for inconsistent income. Every deposit auto-routed.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Built for inconsistent income. Every deposit, auto-routed.

The whole product is built around one moment: the moment a deposit hits. Most people in variable-income work do nothing in that moment except feel temporarily relieved. The deposit goes into a single checking account where it sits, drifts, and starts to leak.

Able runs a different sequence. The moment the deposit lands, it's split — taxes off the top, bills set aside before they're due, a slice into a buffer for the slow months ahead, debt on schedule, what's left yours to spend without guilt. By the end of the same day the money arrived, every dollar already has a job.

The "auto" in auto-routed isn't magic. It's a set of rules you set up once at the start. After that, the system runs without you.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '4|Wed': {
    // C9 three-personas · carousel
    ig: `Which one are you? →

Freezer. Leaker. Shame Cycler. All three are structural, not personal.

Swipe through and find your week.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #moneymindset #selfemployed`,

    tt: `Which one are you?

Freezer. Leaker. Shame Cycler.

All three are structural. Not personal.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Which one are you?

Type 1: The Freezer. Money lands. You don't move it. Moving it would make it real, and right now "real" feels like a thing you can't deal with. So it sits.

Type 2: The Leaker. Day 30 hits and the money is gone. Not on anything specific — a hundred small things. The leak is invisible while it's happening, which is exactly why it's a leak.

Type 3: The Shame Cycler. Relief when it lands. Spending while it's there. Panic when it isn't. Shame when it's gone. Then a deposit lands and the cycle restarts.

All three look like personal failings. None of them are. They're the predictable output of a setup with no real system underneath. You can swap freezing for leaking for shame-cycling, but you can't escape the pattern by trying harder. The pattern needs a different system, not a more disciplined version of the same one.

A system that runs without you is what closes all three loops. That's what Able is built to be.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '4|Thu': {
    // 25 freezing · single
    ig: `You're not overspending. You're freezing.

The standard diagnosis for "where did the money go" is that you spent too much. For variable-income people, that's usually wrong. The deeper issue is that the money sat unmoved on Day 1, and once money sits, it leaks.

Built for the freeze. Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #moneymindset #selfemployed`,

    tt: `You're not overspending. You're freezing.

Different diagnosis. Different fix.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `You're not overspending. You're freezing.

The standard diagnosis for "where did the money go" is overspending. The standard fix is "be more disciplined." For variable-income people, the diagnosis is usually wrong, which means the fix can't work.

The actual pattern, in most freelancer/contractor/creator cases, is this: a deposit lands. You don't move it. The "moving it" is the part that requires a decision — how much for taxes, how much for bills, how much to save for slow months — and you don't have a clear answer to those questions, so you don't decide. You freeze. The money sits in checking for a few days. Once it sits, it starts to leak. $14 here. A subscription. Lunch. Gas. By the time you check the balance, the freeze isn't a freeze anymore. It's a leak.

The fix isn't more discipline against the leak. It's eliminating the freeze on Day 1, by having the decisions already made before the money arrives. That's what Able does.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '4|Fri': {
    // C2 freelancer-month · carousel
    ig: `A freelancer's month →

Day 1 to Day 31, every month, on schedule. (Swipe.)

It's not a willpower problem. It's a Day 1 problem.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `A freelancer's month →

Day 1: deposit lands. You breathe.
Day 7: a snack. A subscription. You stop checking.
Day 14: the leak. You feel it. Can't name it.
Day 30: where did $4,000 go?
Day 31: shame, guilt, repeat.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `A freelancer's month, in seven beats. You'll recognize at least four of them.

Day 1. Deposit hits. You breathe. The relief is real and total — the rent will be paid, the immediate fires are out.

Day 7. A snack. A subscription. You stop checking the balance because everything feels fine and checking would feel like accounting work you don't have time for.

Day 14. The leak. You feel something off — money is moving in a way you can't track — but you can't put your finger on what specifically.

Day 30. You finally check the balance. "Where did $4,000 go?" Nothing big. A hundred small things. A real expense or two. A bunch of "I'll just grab" decisions.

Day 31. Shame. Guilt. The promise that next month will be different. Repeat.

The whole pattern is downstream of one missing decision: what every dollar's job was, the moment it arrived. Without that decision, the freeze and the leak and the shame run on schedule. With that decision, the cycle ends.

This is not a willpower problem. It's a Day 1 problem. Built Able for Day 1.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '4|Sat': {
    // 11 needed-system · single
    ig: `"I didn't need another budgeting app. I needed a system."

That's what gets said in our DMs constantly. Apps measure. Systems decide. You don't need another dashboard showing you what already happened — you need something that decides what to do, the moment money lands.

Built as a system. Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `"I didn't need another budgeting app. I needed a system."

Apps measure. Systems decide.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `"I didn't need another budgeting app. I needed a system."

The most common thing said by people who switch to Able. It captures something the budgeting industry has gotten wrong for a decade.

An app shows you what already happened. Pie charts of last month's spending, color-coded categories, "you spent 23% more on dining out than the average user in your zip code." None of that information arrives in time to be useful. By the time you can see the leak, it's already happened.

A system makes the decisions before the leak can happen. The moment money arrives, the rules run — taxes off the top, bills set aside, buffer for slow months, debt on schedule, what's left for spending. There's nothing to "review" later because nothing was left undecided.

The shift from "another app" to "a system" is the difference between knowing where the money went and knowing where every dollar is going.

Built Able as a system, not an app. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '4|Sun': {
    // B01 lockup-built-for · brandscript
    ig: `Built for inconsistent income.

Five words. They're either the most important thing about a money tool or they're not. For you, they are.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Built for inconsistent income.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Built for inconsistent income.

That's the whole positioning. Five words.

There are budgeting tools built for steady paychecks (most of them), tools built for couples merging finances, tools built for college students learning to budget for the first time, tools built for retirees managing fixed income. There were almost no tools built specifically for the case of inconsistent income — money that lands when it lands, varies in size, comes from different sources, and can't be projected on a calendar.

If your income looks like that, the lack of a tool built for it is the entire reason every budgeting attempt has failed before. It wasn't you.

Able was built for that case specifically. Not as a feature. As the foundational assumption.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  // ─────────────────────────────────────────────────────────
  // W5 — The problem · leaks
  // ─────────────────────────────────────────────────────────

  '5|Mon': {
    // 02 willpower · single
    ig: `You don't have a willpower problem. You have a structure problem.

If you tried harder every month for the last five years and the result was the same every December, that's not a willpower diagnosis. That's a missing structure.

Built for the structure. Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `You don't have a willpower problem. You have a structure problem.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `You don't have a willpower problem. You have a structure problem.

The willpower diagnosis is the default, especially online. "If you really wanted to save, you would." The implication is that the gap between intent and outcome is moral. Try harder. Want it more.

This framing falls apart under one piece of evidence: people who do try harder, who do want it more, who do white-knuckle their spending for an entire quarter, still end up in the same place. They didn't lose to weakness. They lost to a missing structure.

A structure makes the right thing happen automatically. Tax money moves to a tax account the moment a deposit hits. Bill money moves to bill accounts before bills are due. The buffer fills. Debt drops on schedule. None of that requires resisting in the moment, because none of those decisions are made in the moment.

The reason discipline-as-strategy keeps failing isn't that you're undisciplined. It's that discipline is the wrong tool for the job. The right tool is structure.

Built Able to be the structure.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '5|Tue': {
    // R5 apps-fail-freelancers · reel
    ig: `Why budgeting apps fail freelancers:

They assume a paycheck. Yours isn't one.
They show what already happened. By then it's too late.

You don't need a different version of the same broken tool. You need a system for variable.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Why apps fail freelancers:

They assume a paycheck. They show what already happened.

You need a system for variable.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Two reasons every budgeting app fails freelancers, in plain English.

One. They assume a paycheck. The whole math underneath — envelopes, target spending, automatic transfers on the 1st and 15th — is built on the existence of a steady paycheck. If your income doesn't behave like that, the math is off from the first day.

Two. They show what already happened. The dashboard shows last month's spending. The pie chart shows yesterday's leak. By the time the data arrives in front of you, the leak has already happened. There is no decision left to make.

What you actually need is the inverse: a system that decides what each dollar's job is the moment it arrives, before any spending can happen. No retrospective dashboards. No pie charts of regret. Just decisions made automatically, ahead of the leak.

That's the gap Able is built to close.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '5|Wed': {
    // C1 apps-fail-freelancers · carousel
    ig: `Why budgeting apps fail freelancers →

Five reasons. Same root cause. (Swipe.)

It's the assumption. Not you.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Why budgeting apps fail freelancers →

They assume a paycheck.
They show what already happened.
They want you to be an accountant.

You need a system that starts the second money hits.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Five reasons every budgeting app fails freelancers, with the same root cause underneath all of them.

One. They assume a paycheck. The math is built on a fixed amount, on a fixed day. Yours isn't.

Two. They show what already happened. By the time the dashboard tells you about the leak, it's already gone.

Three. They expect you to do bookkeeping. Categorizing, reconciling, projecting. That's an accountant's job. You don't have a finance degree, and you didn't sign up for one when you opened the app.

Four. The fix they recommend is "save more." Saving requires what's left after spending. Variable-income people rarely have a what's-left, because the leaks consume it.

Five. They were built before variable income was a real category. The product roadmap dates from a different decade.

The root cause is the same in all five: the assumption baked into the software is that your paycheck is steady. None of the surface fixes — a freelancer-themed dashboard, a self-employed onboarding flow — change the underlying assumption.

The fix isn't a better dashboard. It's a system designed from the start around the actual shape of variable income. Splits every deposit the moment it arrives. Doesn't wait for a Monday review. Doesn't ask you to be an accountant.

Built Able from that angle. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '5|Thu': {
    // 18 leak-not-dramatic · single
    ig: `The leak isn't dramatic. That's why you can't see it.

If a single $400 charge hit your account, you'd see it instantly and react. The leak doesn't work that way. It's $14 on a Tuesday, $7 on a Friday, a subscription you forgot, a "while I'm here" coffee. By Day 30: $400 gone, no single thing to point to.

The fix isn't more vigilance. It's a system that closes the leak before it starts.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `The leak isn't dramatic. That's why you can't see it.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `The leak isn't dramatic. That's why you can't see it.

If a single $400 unexpected charge hit your account, you'd notice instantly. You'd dispute it, refund it, change a password, take action. The cost is high enough and the cause is specific enough that detection happens automatically.

The leak that actually drains variable-income accounts doesn't work like that. It's $14 on a Tuesday. $7 on a Friday. A subscription you signed up for in 2021 and forgot. A "while I'm here" coffee. A $48 dinner you can't quite remember the context of. By the end of the month, the total is the same as the dramatic $400 charge would have been — but spread across forty small actions, none of which felt like a decision at the time.

Detection fails because the leak is below the threshold of "I should pay attention to this." Vigilance can't fix it because by the time you'd notice, you've already noticed. The only fix is structural: a system that prevents the leak by removing the available money in the first place. The tax dollars are gone before they can become a Tuesday coffee. The bill dollars are set aside before they can become a Friday lunch. The buffer is funded before it can be raided.

Same income. No leak. That's what Able does.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '5|Fri': {
    // C8 5-signs-working · carousel
    ig: `5 signs your money system is actually working →

(If you can't say "yes" to most of these, the system isn't there yet. Swipe.)

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #moneymindset #selfemployed`,

    tt: `5 signs your money system is working →

1. Open your bank app without bracing.
2. Know your tax number without checking.
3. Slow months don't feel slow.
4. Spend the free bucket without guilt.
5. Year-end. Not panic. Just Tuesday.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Five signs the money system you're using is actually working. If you can't say yes to most of these, what you have isn't a system yet — it's a stack of intentions.

One. You can open your bank app without bracing. The opening is neutral. You're not preparing yourself for what you'll find. You already know roughly where the numbers are, and you trust them.

Two. You know your tax-set-aside number without having to check. Not the federal bracket — your number. The total in your tax bucket, the percentage you're moving from each deposit, the rough amount you'll owe in April. It's a fact about your finances you carry around the way you carry around your address.

Three. Slow months don't feel slow. There's a buffer in front of the slow month, doing what a buffer is supposed to do. The slow month is a calendar event, not a panic event.

Four. You spend out of your free bucket without guilt. The guilt-free part isn't denial. It's that the other four buckets are already funded, so there's nothing to feel guilty about.

Five. Year-end isn't a panic event. It's just Tuesday. Taxes are sitting where they were always going to sit. The numbers you need for an accountant are in one place. The "how bad is it this year" question doesn't apply.

If most of those land as "no, that's not me," you don't have a discipline gap. You have a missing system.

That's what Able is. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '5|Sun': {
    // B15 paralysis-money-leaks · brandscript
    ig: `Money that sits, leaks.

Three words. The whole product is built around this single observation. Idle money does not stay idle for long.

The fix is to never let it sit. Every dollar gets a job, the moment it arrives.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Money that sits, leaks.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Money that sits, leaks.

Three words. The whole product is built around this single observation.

Idle money in a variable-income setup behaves differently than idle money in a steady-paycheck setup. Steady-paycheck people have an automatic next paycheck and a known budget, so the money in checking is somewhat protected by the predictability of what's coming. Variable-income people have neither. The money in checking is the entire pool of available decisions, and every small purchase competes against every big obligation in the same pool.

In that environment, idle money has nowhere safe to be. It's always on deck for the next "I'll just grab" decision. The leak isn't an event. It's a steady-state property of money sitting in one undifferentiated pool.

The fix is to never let it sit. Each dollar gets a specific job — taxes, bills, buffer, debt, free spending — the moment it arrives. Once a dollar has a job, it's no longer competing in the general pool. The leak closes.

That's the entire mechanic Able runs on.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  // ─────────────────────────────────────────────────────────
  // W6 — System · five buckets
  // ─────────────────────────────────────────────────────────

  '6|Mon': {
    // 43 five-buckets · single
    ig: `Five buckets. In order.

1. Taxes
2. Bills
3. Reserve (smoothing)
4. Debt
5. Free

That's the whole system. Order matters more than the math. Once it runs, you stop having to make money decisions in the moment.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Five buckets. In order.

Taxes. Bills. Reserve. Debt. Free.

Order matters.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Five buckets, in order. The whole system in five lines.

One. Taxes. Off the top, every deposit. The IRS isn't withholding for you, so move 25-35% of every dollar to a place you don't see.

Two. Bills. Current cycle's known obligations, set aside before they're due. Not "we'll have it" — already gone. Already in a separate place.

Three. Reserve (smoothing). The buffer that keeps slow months from breaking the system. The thing personal finance frameworks built for steady paychecks skip entirely.

Four. Debt. On schedule, every month, including slow months. The buffer (bucket 3) makes this possible.

Five. Free. What's left, yours, guilt-free. This bucket is small on purpose. It's the only bucket you spend out of, which means it's also the only spending decision you have to make.

The order matters more than the math. Most personal finance is "spend, then save what's left." That's bucket five first, with the rest "later." With variable income, "later" never arrives. Reverse the order. Spend last.

Built Able to run this exact model, automatically. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '6|Tue': {
    // R3 five-buckets · reel
    ig: `Every dollar gets a job:

1. Taxes — not yours.
2. Bills — don't wait.
3. Reserve — for next month.
4. Debt — on schedule.
5. Free — guilt-free.

That's it. That's the whole product.

$14.99/mo or $129/yr (save $50). Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Every dollar gets a job.

Taxes. Bills. Reserve. Debt. Free.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Every dollar gets a job. The job-list is five items long.

Taxes — not yours. The IRS doesn't withhold for self-employment income, so 25-35% of every deposit gets routed to a separate account you don't touch. Treat it like the IRS is already taking it.

Bills — don't wait. Move bill money to a separate place the moment it lands, not the day before the bill is due. By the time the bill arrives, the money is already there.

Reserve — for next month. A buffer between months. Slow weeks don't break the system because the buffer is there to cover the gap.

Debt — on schedule. Every month, including slow ones. The buffer makes this possible. Without the buffer, debt is the first thing skipped on a bad month, and skipped debt kills payoff plans.

Free — guilt-free. What's left after the four jobs above are done. This is the bucket you spend out of. The "guilt-free" part isn't permission to overspend — it's that the other jobs are already done, so there's nothing to feel guilty about.

The whole product is built around running this loop, automatically, the moment a deposit hits.

$14.99/mo or $129/yr (save $50 with annual). Free for 7 days first.`,
  },

  '6|Wed': {
    // C3 five-buckets · carousel
    ig: `Every dollar gets a job →

Five buckets. Specific jobs. (Swipe.)

When the money has a job, it stops drifting. The leak closes.

$14.99/mo or $129/yr. Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Every dollar gets a job →

1. Taxes ~30%. Not yours.
2. Bills. Spread across months.
3. Reserve. Slow months don't feel slow.
4. Debt. Killed on schedule.
5. Free. Spend without flinching.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Every dollar gets a job. Five buckets. Specific jobs each.

Bucket one: taxes. Roughly 30% of every deposit. Not yours. Move it the moment the deposit lands so you can't accidentally spend it.

Bucket two: bills. Current and upcoming bills, spread across the months they're due. Move the bill money before the bill is due, not the day before.

Bucket three: reserve. A buffer between months so slow months don't feel slow. Personal finance built around steady paychecks skips this entirely. For variable income, it's the most important bucket.

Bucket four: debt. Killed on a schedule. Every month, including slow ones. Bucket three (the reserve) is what makes this possible — it covers the slow-month gap so debt doesn't get skipped.

Bucket five: free. What's left after the first four jobs are done. Spend without flinching. The flinch comes from not knowing whether the other jobs got done. Once they're done, the flinch goes away.

When every dollar has a job, the money stops drifting. The leak closes. The "where did it all go" question doesn't have anywhere to come from.

$14.99/mo or $129/yr (save $50 on annual). Free for 7 days first.`,
  },

  '6|Thu': {
    // 04 every-deposit · single
    ig: `Every deposit, already sorted.

That's the entire user experience. Money lands. The split runs. You don't think.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Every deposit, already sorted.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Every deposit, already sorted.

Three words for the entire user experience.

Most budgeting tools require an active session. You sit down, open the app, look at the dashboard, drag transactions into categories, reconcile against last month, decide what to do next. The work is yours. The tool is a workspace.

Able runs the other direction. The deposit lands. The split happens. You don't sit down. You don't open anything. The work is the tool's. You go back to the work that brings the money in.

The "already" in "already sorted" is the part that matters. Not "sorted when you remember." Not "sorted at end of month." Already. The split has happened by the time you'd think to check.

That's what makes the system actually feel like a system instead of another to-do list.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '6|Fri': {
    // C16 feast-or-famine · carousel
    links: 'becomeable.app/budgeting/feast-or-famine/',
    ig: `The feast or famine cycle →

Big check, you feel rich. Three weeks of nothing, you panic. Repeat. (Swipe.)

It's not discipline. It's a missing structure.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `The feast or famine cycle:

Feast: big check. You feel rich.
Famine: three weeks of nothing. Panic.
Repeat.

It's not discipline. It's a missing structure.

becomeable.app/budgeting/feast-or-famine/

#freelancetok #1099 #moneytok`,

    li: `The feast or famine cycle, in three beats.

Feast. A big check lands. The relief is total. You feel — temporarily, accurately for that one moment — rich. Spending decisions get made off this feeling.

Famine. Three weeks of nothing. The math from the feast didn't account for this stretch. Panic. Drain.

Repeat. Another check eventually lands. Feast. Famine. Repeat.

The standard interpretation of this cycle is that it's a discipline problem — the person should have spent less during the feast. The actual problem is structural. A single undifferentiated checking account, no buffer between months, no specific job for the big check beyond "we have it now."

The fix is to route every deposit into five accounts with specific jobs the moment it lands. Tax bucket, bill bucket, reserve bucket, debt bucket, free bucket. The big check stops being a feast — it becomes funding for the next two months instead of available cash for the next two days.

Same income. No cycle. That's the entire pitch.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '6|Sun': {
    // B23 solution-without-paycheck · brandscript
    ig: `A budget that works without a predictable paycheck.

That sentence is either common sense or revolutionary, depending on whether your last twelve months looked like a paycheck. For most freelancers, contractors, creators — it's the latter.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `A budget that works without a predictable paycheck.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `A budget that works without a predictable paycheck.

Read that sentence again. It's either obvious or revolutionary, depending on what your last twelve months looked like.

If your income lands like a paycheck — same amount, same day — every budgeting tool ever made works for you. Pick whichever has the prettiest interface.

If your income doesn't land like that — freelance, contract, creator, commission, lumpy retainer, "we'll get you on net-90" — every one of those budgeting tools is fundamentally mismatched to your situation. The math underneath assumes a paycheck you don't have.

A budget that works without that paycheck has to start with different building blocks. Allocation by deposit, not by calendar. A buffer that smooths the gaps, not just an emergency fund for catastrophes. Tax handling that doesn't assume someone else is withholding. Bill handling that doesn't assume the same amount lands on the same day every two weeks.

That's what Able is built around. The whole product was designed from the assumption that there is no paycheck.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  // ─────────────────────────────────────────────────────────
  // W7 — Tax · 30% rule
  // ─────────────────────────────────────────────────────────

  '7|Mon': {
    // 35 yours-isnt · single
    ig: `Every budgeting app assumes a paycheck. Yours isn't.

That single mismatch is why nothing has worked for you. Not because you tried wrong tools — because the entire industry built tools for someone else.

We built ours for you. Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Every budgeting app assumes a paycheck. Yours isn't.

That's why nothing's worked.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Every budgeting app assumes a paycheck. Yours isn't.

That single sentence is the whole reason the last decade of budgeting tools has failed you.

Walk through any popular budgeting app's onboarding. Question two will be "when do you get paid?" with options like "weekly," "bi-weekly," "twice monthly," "monthly." None of those map to "whenever a client closes" or "when the algorithm pays out" or "when commission clears" or "when an invoice finally gets paid net-60."

You either pick the closest option (lying to the tool) or skip the question (breaking half the features). Either way, every projection the tool makes from that point forward is wrong, because the foundation it's projecting from is wrong.

The fix isn't a budgeting app with a "freelancer mode" toggle. The fix is a tool whose foundational assumption is that your income doesn't follow a schedule. Different assumption, different math, different product.

That's what Able is. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '7|Tue': {
    // R4 tax-math-30 · reel
    links: 'becomeable.app/taxes/how-much-to-set-aside/',
    ig: `If you're 1099, read this:

Roughly 30% of every deposit belongs to the IRS.
Not in April. The second it clears.

Move it the moment it lands, or you'll spend it.

Free for 7 days. Link in bio.

#freelancing #1099life #taxes #1099 #selfemployed`,

    tt: `If you're 1099:

30% of every deposit belongs to the IRS.
Not in April. The second it clears.
Move it. Or lose it.

becomeable.app/taxes/how-much-to-set-aside/

#freelancetok #1099 #taxtok`,

    li: `If you're 1099, the most important tax math in your life is this:

Roughly 30% of every deposit belongs to the IRS. Federal income tax plus self-employment tax (15.3% by itself), minus deductions, lands most people somewhere between 25% and 35%. Pick 30% as a working number, err high if you're unsure.

That 30% does not become "owed" in April. It became "owed" the second the deposit cleared. April is the deadline to send it, not the moment it became real.

If you don't move that 30% out of your spending account the moment it lands, two things happen. One: you spend it (it's in checking, it's "available," it's a Tuesday coffee). Two: April hits and the bill is real, and you don't have it.

The fix is structural, not motivational. The 30% has to be physically moved to a separate account the moment a deposit lands. Once it's there, you can't accidentally spend it. April becomes a non-event.

That's what Able's tax bucket does, automatically.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '7|Wed': {
    // C5 tax-math-1099 · carousel
    links: 'becomeable.app/taxes/how-much-to-set-aside/',
    ig: `If you're 1099, read this →

The 30% rule, the April panic, and the fix. (Swipe.)

Free for 7 days. Link in bio.

#freelancing #1099life #taxes #1099 #selfemployed`,

    tt: `If you're 1099, read this →

30% belongs to the IRS. The second it clears. Not April.

Don't move it = you'll spend it.

Fix: a tax bucket that fills automatically.

becomeable.app/taxes/how-much-to-set-aside/

#freelancetok #1099 #taxtok`,

    li: `The complete 1099 tax framing, in seven beats. If you're self-employed and have ever felt blindsided in April, this is the math you're missing.

One. Roughly 30% of every deposit belongs to the IRS. Federal plus self-employment, before deductions. Most 1099 workers land between 25% and 35%.

Two. That 30% is not "owed in April." It's owed the second the deposit cleared. April is the deadline to send it, not the moment it became real.

Three. If you leave the full deposit in checking, you will spend the 30%. It's not a discipline question. The 30% looks identical to the 70% in your account, so it gets allocated to whatever the next decision is.

Four. April hits and the bill is real. The IRS doesn't care that you spent it. The penalty is roughly 9% annually on underpayment plus interest, on top of the actual tax owed.

Five. Quarterlies (April, June, September, January) compound the same problem on a faster cycle. Miss one and the penalty starts immediately.

Six. The fix is a tax bucket that fills automatically. The moment a deposit lands, 30% routes to a separate account you don't touch. By the time April arrives, the money is already there.

Seven. The structural fix beats the motivational one every time. You're not going to "be more disciplined about taxes" if you've spent ten years not being more disciplined about taxes. The bucket does the discipline for you.

That's what Able's tax bucket is. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '7|Thu': {
    // 36 tax-was-never-yours · single
    links: 'becomeable.app/taxes/how-much-to-set-aside/',
    ig: `30% of every deposit. Was never yours.

The mental shift is the whole game. Stop thinking of the gross deposit as your money. Think of the 70% as your money. The 30% is the IRS's, in transit through your account.

When you treat it that way, you stop being shocked in April.

Free for 7 days. Link in bio.

#freelancing #1099life #taxes #1099 #selfemployed`,

    tt: `30% of every deposit. Was never yours.

The IRS just hasn't taken it yet.

becomeable.app/taxes/how-much-to-set-aside/

#freelancetok #1099 #taxtok`,

    li: `30% of every deposit. Was never yours.

The mental shift is the whole game. The accounting is just downstream of how you frame the deposit.

Frame one: "I made $4,000 this week." That's the framing most 1099 workers carry by default. The full deposit is yours. Taxes are a separate, future thing. April will deal with itself.

Frame two: "I made $2,800 this week and the IRS is getting $1,200 that's already theirs." Same deposit, different mental ownership. The 30% was never yours. It was the IRS's, briefly in transit through your account on the way to a separate tax bucket.

Frame two is the one that ends April panic forever. Not because the math is different — the actual tax owed is identical — but because the spending decisions get made off the $2,800, not the $4,000. There's no "I have $4,000 to work with" delusion to spend down before reality hits.

The bucket structure forces frame two automatically. The 30% leaves the spending account the moment the deposit clears. By the time you'd think about how much you have to work with, the spending account already shows $2,800.

That's what Able's tax bucket is for.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '7|Fri': {
    // C27 tax-set-aside · carousel
    links: 'becomeable.app/taxes/how-much-to-set-aside/',
    ig: `How much for taxes? →

The math, the formula, and the rule of thumb if you're guessing. (Swipe.)

If you're 1099 and wonder if 20% is "enough" — it almost certainly isn't.

Free for 7 days. Link in bio.

#freelancing #1099life #taxes #1099 #selfemployed`,

    tt: `How much for taxes if you're 1099?

You pay federal + self-employment tax.
Self-employment tax is 15.3% flat.
Most land between 25-35%.
If you guess, err high.

becomeable.app/taxes/how-much-to-set-aside/

#freelancetok #1099 #taxtok`,

    li: `How much should you set aside for taxes if you're 1099? Here's the actual math, not the vibes.

You pay two taxes, not one. Federal income tax plus self-employment tax. Most "what percentage do I need" advice ignores that you're paying both, which is why 20% feels like enough until it isn't.

Self-employment tax is 15.3% flat, on every dollar of net self-employment income, before deductions. That's Social Security and Medicare — the half your employer would normally cover plus your half.

Federal income tax is on top of that. Bracket-based. For most 1099 workers in the $50K-$150K range, the combined effective rate (federal + SE) lands somewhere between 25% and 35% of gross.

If you want a real number for your situation, take last year's total federal tax bill and divide it by last year's gross income. Add 3 points to be safe. Add your state's rate if your state has income tax.

If you're guessing for the first time, err high. A refund beats a bill. 30% is a defensible default for someone in their first year of self-employment with no state-specific data yet.

The rule isn't to guess once and hope. The rule is to move that percentage of every deposit into a separate tax account the moment the deposit clears. The math gets easier the more deposits you've moved.

That's what Able's tax bucket does, automatically.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '7|Sun': {
    // B25 outcome-pay-down-debt · brandscript
    ig: `Finally pay down your debt.

Debt-payoff plans don't fail because of motivation. They fail because slow months knock the plan off-schedule, and once it's off, it dies. The fix is a buffer in front of the slow months.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #debtfree #selfemployed`,

    tt: `Finally pay down your debt.

Slow months are why most plans die.
A buffer fixes that.

becomeable.app

#freelancetok #1099 #debtfreejourney`,

    li: `Finally pay down your debt.

Most variable-income debt-payoff plans fail in the same place. They start strong. The first month, the payment goes through. The second month too. By month four or five, a slow month hits, the payment gets skipped or reduced, and the plan never recovers. Once the discipline of "every month, no exceptions" breaks once, it's almost impossible to restore.

The reason it breaks is structural, not motivational. Without a buffer between months, the slow month forces the choice between paying debt and paying rent. Rent wins. Debt slides. The plan dies.

The fix is bucket three: a smoothing reserve that funds slow months specifically so debt payment can stay on schedule. With the reserve doing its job, the slow month is an event but not a catastrophe. Debt drops on schedule, every month, including slow ones.

That's how variable-income debt actually gets paid down. Not heroic discipline. A buffer in front of the slow months.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  // ─────────────────────────────────────────────────────────
  // W8 — Calm · numbers over panic
  // ─────────────────────────────────────────────────────────

  '8|Mon': {
    // 22 calm-beats-panic · single
    ig: `Calm beats panic. Specific beats vague.

Most money advice is loud and abstract. "Save more!" "Cut expenses!" "Build wealth!" None of it tells you what to do at 9am Monday with this specific deposit.

Specific is the only kind of help that helps.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `Calm beats panic. Specific beats vague.

Loud advice never moved a dollar.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `Calm beats panic. Specific beats vague.

Most personal finance content sells the opposite of those two principles. It's loud (panic-toned hooks, "STOP DOING THIS NOW" headlines) and abstract ("save more," "cut expenses," "build wealth").

The loudness is the point — engagement metrics reward it. The abstraction is also the point — abstract advice can apply to everyone, which means it can sell to everyone, which means it can scale.

The cost of loud and abstract is that nothing actionable gets delivered. The viewer feels something briefly, doesn't know what to do at 9am Monday with their specific deposit, scrolls to the next thing.

Calm and specific is the inverse pattern. Quiet voice. Specific answer to a specific question. "Move 30% of this $4,200 deposit to a separate tax account, today, before you do anything else." That's the kind of help that actually changes a number on a balance sheet.

That's the voice we built Able around — both the product and how we communicate. Calm beats panic. Specific beats vague.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '8|Tue': {
    // R8 bad-month-quarterly · reel
    links: 'becomeable.app/taxes/bad-month-quarterly-taxes/',
    ig: `Quarterlies due. Bad month. The IRS doesn't care.

The penalty is about 9% annually, plus interest. Pay what you can. Beats nothing.

The real fix: a reserve in front of slow months, so quarterlies always get paid even when income drops.

Free for 7 days. Link in bio.

#freelancing #1099life #taxes #1099 #selfemployed`,

    tt: `Quarterlies due. Bad month.
The IRS doesn't care.

Penalty: 9% annually.
Pay what you can. Beats nothing.

Prevention: a reserve.

becomeable.app/taxes/bad-month-quarterly-taxes/

#freelancetok #1099 #taxtok`,

    li: `Quarterlies are due. It's a bad month. What now?

The IRS doesn't care that it's a bad month. The estimated tax deadlines (April, June, September, January) don't move. The penalty for missing or under-paying is roughly 9% annually plus interest, calculated from the missed-payment date.

Two things to do today, in order.

One: pay what you can today. Underpaying is meaningfully better than not paying. The penalty calculation is on the unpaid portion. Sending $400 of an estimated $1,200 quarterly cuts your penalty by two-thirds compared to sending nothing.

Two: figure out what specifically went wrong with the system. Almost every "I can't pay quarterlies" situation traces back to one of two failures. Either the tax bucket wasn't being funded from each deposit (so the tax money got spent), or there was no smoothing reserve in front of slow months (so the bad month forced you to dip into the tax bucket). Both are structural. Both have structural fixes.

The structural fix for next quarter: bucket one is taxes off the top, bucket three is a reserve big enough to cover one full quarterly during a slow stretch. With both running, "bad month + quarterly due" stops being a crisis.

That's what Able is built around.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '8|Wed': {
    // C26 emergency-fund · carousel
    ig: `Three months isn't enough →

The standard "3-6 months emergency fund" advice was built for W-2 workers. You don't have unemployment, severance, or paid leave. Your baseline needs to include the shocks. (Swipe.)

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #emergencyfund #selfemployed`,

    tt: `Three months isn't enough.

That advice was built for W-2 workers.
No unemployment. No severance. No paid leave.

Aim for 9 months.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `The "three to six months emergency fund" advice was built for W-2 workers. If you're self-employed, three months isn't enough.

W-2 workers have layers of cushion the advice silently assumes. Unemployment insurance kicks in if they lose the job. Severance is often part of the exit. Paid leave covers medical events. Employer health insurance carries through gaps. The "emergency fund" is one of several backstops.

If you're self-employed, none of those exist. Lose the work, lose all income, immediately. Get sick, lose income for the duration. Take a vacation, lose income. Slow quarter, lose income. Your "emergency fund" isn't a backstop. It's the first, second, and third layer of cushion.

The right baseline for variable-income work is closer to nine months of bills covered, not three. Not because you're paranoid — because the math actually requires it once you account for the absence of every other backstop the standard advice assumed.

Run that math, and slow quarters stop threatening anything. They become "this is what the reserve is for" instead of "we are in trouble."

That's how the smoothing bucket in Able is sized. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '8|Thu': {
    // 12 where-it-is · single
    ig: `If the goal is more money, you need to know where it is.

A surprising number of variable-income people don't know what's in their tax bucket, what their bills total, or how much "free" money is actually free. The not-knowing is the leak.

Knowing is the fix.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #budgeting #selfemployed`,

    tt: `If the goal is more money, you need to know where it is.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `If the goal is more money, you need to know where it is.

It sounds obvious until you ask the question literally. Right now, in your accounts:

— What's the dollar amount sitting in your tax bucket?
— What's the total of bills due in the next 30 days?
— How much is in a reserve specifically for slow months?
— How much of your "spending" money is actually free to spend without breaking something else?

If three out of four of those questions take you more than ten seconds to answer, you don't have a money problem. You have a visibility problem. The money exists. You just don't know where it is or what it's doing.

The leak feeds on the visibility gap. Money that has no clear location and no clear job gets reabsorbed into general spending decisions. Knowing where it is — specifically, in named buckets, with specific jobs — is the entire fix.

That's what Able shows you, all the time. Tax bucket dollar amount. Bills total. Reserve total. Free balance. Four numbers. Always current. Always visible.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '8|Fri': {
    // C30 bad-month-quarterly · carousel
    links: 'becomeable.app/taxes/bad-month-quarterly-taxes/',
    ig: `Quarterlies due. Bad month. →

What to do today, what the penalty actually costs, and how to prevent it next time. (Swipe.)

Free for 7 days. Link in bio.

#freelancing #1099life #taxes #1099 #selfemployed`,

    tt: `Quarterlies due. Bad month.

The IRS doesn't care.
Penalty: 9% annually.
Pay what you can. Beats nothing.

Prevention: a reserve for lean months.

becomeable.app/taxes/bad-month-quarterly-taxes/

#freelancetok #1099 #taxtok`,

    li: `"Quarterlies are due, it's a bad month, what do I do" — the playbook.

What to do today: pay what you can, even if it's partial. The IRS calculates penalty on the unpaid portion at roughly 9% annually plus interest. Sending half is materially better than sending nothing. The math punishes complete misses, not partial payments.

What the penalty actually costs: 9% annually, prorated by how late the payment is. On a $1,200 missed quarterly, paid two months late, that's about $18 in penalty plus a small amount of interest. Not nothing, but also not the catastrophe most freelancers expect when they think "IRS penalty."

What to do this week: figure out specifically why the bad month broke quarterlies. Either the tax bucket wasn't being funded from each deposit (so tax money got spent in better months), or there was no smoothing reserve to cover the gap during the slow stretch. Both are structural. Both have structural fixes.

Prevention going forward: route 30% of every deposit to a tax bucket the moment it lands, build a smoothing reserve big enough to cover one full quarterly during a slow stretch. With both running, "bad month + quarterly due" stops being a crisis. The money is already there.

That's what Able is built around.

Free for 7 days. $14.99/mo or $129/yr after.`,
  },

  '8|Sun': {
    // B39 outcome-just-confidence · brandscript
    ig: `No more paralysis. No more holding your breath. Just confidence. Every day.

That's the actual outcome. Not "wealth." Not "financial freedom." Just the day-to-day feeling that the system is running and the numbers are doing what they're supposed to do.

Free for 7 days. Link in bio.

#freelancing #1099life #variableincome #moneymindset #selfemployed`,

    tt: `No more paralysis. No more holding your breath.

Just confidence. Every day.

becomeable.app

#freelancetok #1099 #moneytok`,

    li: `The actual outcome we sell is small and specific. Not "wealth." Not "financial freedom." Just confidence, every day.

The confidence comes from the numbers doing what they're supposed to do, not from the absence of money worries. Worries about money never fully disappear in variable-income work — that's the nature of the work. What disappears is the secondary worry layer: not knowing whether the system is handling things underneath.

Confidence is being able to open the bank app on a Sunday and not feel anything. Confidence is knowing the tax money is sitting where it's supposed to sit. Confidence is taking on a slow week without bracing.

The paralysis goes because there's nothing to be paralyzed by — the decisions are already made. The breath-holding goes because there's nothing to brace for — the system already accounted for the thing you'd brace against.

That's the small, specific outcome. Free for 7 days. $14.99/mo or $129/yr after.`,
  },

};
