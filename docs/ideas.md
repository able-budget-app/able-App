# Able Ideas — Holding Pen

**This is where new ideas go, not the active triage list.** When Paul has an idea that isn't a refinement of an existing `triage.md` item, it lands here with one-line rationale + date. Periodically (monthly?) we triage from here into Now/Next/Later.

The friction is the feature. Untriaged ideas living in active queues are how scope blows up.

---

## Format

```
- YYYY-MM-DD | One-line idea | Why it might matter | Linked persona / problem (optional)
```

---

## Open ideas

- 2026-05-03 | **Reverse-engineer goals from income events** | What-if currently runs forward (here's $X, here's how it splits). Add a backward path: pick a goal (pay off card, buy boat, etc.) and surface "how many DoorDash runs / Etsy sales / freelance invoices does that take?" Concrete units instead of abstract dollars. | Gig-worker persona, fits inside the What-if surface, idea via Paul's brother
- 2026-05-03 | **"Reset paid flags for this month" action** | Settings entry that unchecks every `bill.paid` for the current month. Useful for users who toggled bills paid in error (or while testing). Per Paul's bug report 2026-05-03: bills toggled paid persist after income delete because allocation never set them in the first place — only manual checkbox + Mark paid through today + Past-due banner do. | Data-hygiene QoL
- 2026-05-03 | **Soft warning when paid-flag total exceeds plausible cash** | If `paidBills()` > (balance + reservedNow + plausible recent income), surface a small "your paid-flags look stale, want to review?" inline hint above Bills. Non-blocking, dismissible. Catches the same bug as the reset action but proactively. | Same source
- 2026-05-03 | **Add-to-Home-Screen prompt after engagement** | Show an install prompt (iOS Safari = share/add instructions, Android Chrome / desktop Chrome = `beforeinstallprompt` one-tap button) after the user has engaged for N sessions — never on first visit. PWA already auto-updates (no fetch handler in `service-worker.js`, so each open pulls fresh `app.html`). Push card on iOS Safari already nudges install inline (commit 2026-05-03); this is the broader cross-platform prompt. Acts as a soft "get the app" path before App Store. | App-store-without-app-store; reduces friction for users who'd benefit from push + offline icon
- 2026-05-03 | **Push-driven allocation flow (notification → allocate sheet)** | When Plaid detects a deposit (transaction with positive amount in a depository account), `send-push` fires a notification: "$X just landed — give it a job." Tapping the notification deep-links into the allocate sheet pre-filled with the detected amount. User still allocates manually (preserves Floor-First's "every dollar gets a job" moment); the system just handles the *trigger*. When this ships, Plaid effectively becomes the source of truth for income events and the manual `Log new income` becomes the cash/Venmo escape hatch instead of the default. Likely also lets us collapse the dual-balance reads (Balance + Bank balances dropdown) into one. | Behavior change + system-driven trigger. Replaces the "remember to open Able when you get paid" friction without short-circuiting the allocation moment. Long-term: the income half of Plaid-first.
- 2026-05-04 | **Email the user their new plan after onboarding** | Once the analyzer produces a plan_id, fire an email summarizing what we set up: "I read 7 months of your transactions. Here's the plan I drafted — 15 bills, 4 debts, 12% taxes off the top." Becomes a permanent reference + a re-engagement hook (link back into the app). | Onboarding moment, retention, also a nice "look what we did for you" trust-builder
- 2026-05-04 | **Achievements / milestones email** | When user hits a streak, completes their first month, finishes Snowball Started, etc., send a celebratory email — both as positive reinforcement and as a passive re-engagement nudge. Pairs with the in-app achievements grid. | Retention, dormancy prevention
- 2026-05-04 | **Drop the 6/12/24 month lookback picker** | Other apps don't ask. Just default to 6 or 12 months, tell the user "I read X months of your history for analysis accuracy" so they understand we did real work. Removes a question from onboarding and removes the false UX choice (lookback doesn't actually change time-to-first-plan; that's bounded by Plaid's INITIAL_UPDATE). | Simplification, fewer onboarding questions
- 2026-05-04 | **Move plan review out of onboarding into a first-visit card-stack on Bills + Debt** | Current state: onboarding has a Step-7 plan review screen with Accept/Edit/Skip per section + bulk Apply, plus REVIEW pills surface per-row in Bills/Debt for users who close mid-review. Pivot: drop the in-onboarding review screen entirely; first time the user lands on Bills (with `pending_review` rows present), spawn a card-stack modal — one bill per card, Approve / Edit / Skip / Review later, progress indicator ("Bill 3 of 16"). Same for Debt. After last card, no more pop-ups. Onboarding ends faster, review happens contextually when the user is naturally on Bills/Debt. Tradeoff: 16 cards is a lot to grind through, so the per-card "Review later" escape is essential. | Onboarding + post-onboarding UX, replaces (not supplements) current plan-review surface
- 2026-05-05 | **Persona-targeted social posts (without naming the persona)** | Periodically run social posts that speak directly to a specific archetype without labeling them as "focus group" / persona names. Examples: post-layoff rideshare driver; single dad on a tight floor (low-income empathy test); 41/43 dual-contractor couple (household-level multi-bank stress test). Each post leads with a moment that's unmistakable to that archetype ("rent's due Friday, last fare was Tuesday, the app says…"), no demographic callout. Pulls from the customer-research persona inventory but reads as honest first-person. | Social: makes Able feel like it's talking to YOU specifically vs. generic "freelancers." Pairs with able-customer-research + able-social-media skills
- 2026-05-05 | **Webhook → GHL for email sequence control (exploratory, Paul flagged "not sure")** | Push user lifecycle events (signup, trial_started, subscription_activated, dormancy, milestone hit) from Supabase / `stripe-webhook` into GoHighLevel via webhook. GHL then runs the email sequences instead of `email-cron-daily` + Resend driving them directly from app code. Tradeoff: GHL gives drag-and-drop sequence editing + branching + SMS fallback + visual journey builder — useful if email iteration becomes a bottleneck. Cost: another moving piece, FROM_EMAIL routing question, deliverability question (GHL's sender reputation vs. our Resend domain), and a duplicate source of truth for sequences. Only worth it if the iteration speed on emails actually slows us down — current Resend setup already works. Decide before building. | Email infra; depends on whether we want a marketing-team-friendly tool or keep it engineering-controlled
- 2026-05-05 | **Full content-language audit pass after app-capabilities + docs are locked** | After `able-app-capabilities` skill and product docs are settled, sweep every piece of generated content (blog articles, ads, emails, landing-page copy, social posts, video scripts) for stale feature claims, wrong terminology (e.g. old bucket names, pre-Plaid framings), and outdated capability descriptions. **Sub-task:** spot-check that `/resources/`, `/learn/`, `/calculators/`, `/compare/` hub `index.html` files actually link to their subdirectories — symptom would be "footer link works but hub page is empty." | Ground-truth content sync; depends on capability docs being canonical first

---

## Promoted to triage (with date moved)

*(items moved out get a one-line entry here so we have an audit trail)*

- 2026-05-04 | **Auto-close the month on the 1st** → **Shipped 2026-05-04** in `autoRolloverIfNewMonth` (extended to archive prior month into `month_history`); manual "Close this month" buttons removed from Home + Settings; commit `5e4f6a2`
- 2026-05-04 | **Snowball vs Avalanche debt payoff method toggle** → **Shipped 2026-05-04** as inline pill at top of Debt page with first-time educational tip; `_sortDebtsByStrategy` shared by debt list, payoff timeline, payoff-estimate card; commit `d57fd5b`

---

## Rejected (with reason)

*(ideas explicitly killed get logged here so we don't re-litigate)*

- 2026-05-03 | Trim achievements grid for new users | **Rejected.** Half the personas loved the dense gallery; the right fix is minimize/expand toggle + closest-to-unlocking sort, which is on triage as #6. Trimming would lose the users for whom achievements are working.
- 2026-05-03 | Raise "Snowball Started" threshold from $200 to $500 | **Parked, not committed.** Only Riley (1 of 6 personas) flagged it as patronizing. Maya/Jordan would never trigger it at higher gates. The achievement is correctly calibrated for the people who need it most.
