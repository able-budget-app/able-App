# Able onboarding first-win audit

_Ran 2026-04-23 via subagent tracing signup → first income logged._

## Punch list (15 items)

### BLOCKING (3)

**1. Onboarding progress bar says "Step 1 of 7" but there are 9 steps.**
`app.html:892`. Hardcoded label; user reaches Step 9 and UI still reads "Step 9 of 7."
Fix: template the label into `renderObStep()` so it uses `OB_QUESTIONS.length`.

**5. Post-signup flow is ambiguous.**
`app.html:841` shows "Check your email for a confirmation link, then come back here to sign in." Unclear whether refresh auto-signs-in or whether they need to re-enter credentials.
Fix: explicit copy — "Check your email, click the link, then return and sign in with your email + password."

**12. No empty-state fallback for first-time users who skip onboarding.**
`app.html:1723–1735`. Onboarding gate is `no profile AND no bills AND no debts`. If a user closes mid-onboarding or skips, they land in the app with zero data and no guidance.
Fix: Check `(history.length === 0 && bills.length === 0)` or similar, and render a persistent empty-state card with "Log first income" + "Add first bill" CTAs.

### FRICTION (8)

**2. Plan cards on paywall are not keyboard-accessible.**
`app.html:852, 862`. `<div onclick="selectPlan(...)">` has no `tabindex`, no `role`, no keyboard handler.
Fix: change to `<button role="radio">` or add `tabindex="0"` plus a keydown handler for Enter/Space.

**4. Empty states have zero guidance.**
`app.html:1016, 1066, 1188, 1219, 1226`. "No income logged yet this month", "No expected income added yet" etc. No next-step CTA.
Fix: each empty state gets a one-line hint with a target action, e.g. "Log your first income above ↑".

**6. Checkout-return spinner has no ETA.**
`app.html:1641–1651`. Shows "Finalizing your account" and polls for up to 6s. On slow networks the user sees a silent spinner.
Fix: "Confirming your subscription. This usually takes a few seconds."

**7. Submit buttons disable too late.**
`app.html:1560, 2108`. `btn.disabled = true` happens after the async call starts, allowing double-submits.
Fix: set `disabled = true` immediately (synchronously before the await).

**9. "Tell me where it goes →" is opaque for first-time users.**
`app.html:1000`. No indication what happens next.
Fix: change to "See allocation plan →" or add a line of microcopy beneath.

**10. Income source dropdown is empty until `populateSources()` runs.**
`app.html:997–998`. First-time user opens the form to find an empty select.
Fix: seed a placeholder option ("Pick an income source"), and/or ensure sources are populated synchronously on page load.

**11. Guided tour auto-starts and buries the first-win action.**
`app.html:1747–1748`. Tour fires 500ms after first login and spotlights tabs, not the "log income" CTA.
Fix: skip the tour on first login; show inline empty-state guidance instead. Settings already has a "Replay app tour" button.

**13. No focus state on paywall's primary button.**
`app.html:212`. Keyboard users tabbing to "Start your free 7-day trial" see no focus ring.
Fix: `.btn-primary:focus-visible { outline: 3px solid rgba(42,122,74,.3); outline-offset: 2px; }`.

### POLISH (4)

**3. Em dashes in subscription status labels (rule violation: no em dashes).**
`app.html:2172–2173`. My own regression — "Past due — update your card", "Incomplete — finish checkout".
Fix: replace both em dashes with hyphens.

**8. Inconsistent button padding; `.btn-ghost` falls under the 44px mobile touch-target minimum.**
`app.html:209, 211, 213`.
Fix: enforce `min-height: 44px` on interactive buttons at mobile breakpoint.

**14. "Buffer fund" hint has mixed em-dash and run-on copy.**
`app.html:1040`. "For slow months — goal is 1 month of bills."
Fix: split with colon: "Buffer fund: goal is one month of bills, for slow months."

**15. Annual plan value isn't obvious on mobile.**
`app.html:852–871`. The "Save $41" badge is inline and visible, but the per-month equivalent ($6.58/mo) is not shown.
Fix: add subtext "$6.58/month, billed yearly" under the $79/yr price.

---

## First-win acceleration ideas

**A. Skip full onboarding for new users.**
Remove the 9-step AI onboarding. Land users on the home page with a prominent "Log your first income" card. Collect bills/debts lazily via inline modals as they allocate. Cuts signup-to-first-win from ~3 min to under 30 seconds.

**B. Suggest plausible default bills.**
After signup, offer 3 common bills (Rent $1,500, Internet $60, Phone $15) with an "Edit or skip" button. Removes the blank-list friction on the very first allocation.

**C. Single-step inline tour on the first allocation result.**
When the user logs their first income, show a one-step spotlight on the result card: "Here's where your money goes — bills, debt, buffer, and you." No multi-tab tour.

**D. Email confirmation link drops directly into checkout.**
`{{APP_URL}}?email_confirmed=true` auto-opens the paywall instead of the sign-in form. Saves one step.

**E. "Log another" CTA on the result card.**
Keep the momentum. After the first allocation success, a prominent "Log more income" button resets the form and refocuses the amount field.

---

## Priority recommendation

For a launch-week pass, prioritize items **1, 3, 5, 12** (three BLOCKING + the em dash rule violation). Items **4, 7, 9, 10, 11** would meaningfully improve activation and are all under 30-min fixes each. The POLISH tier can wait for a post-launch sweep.
