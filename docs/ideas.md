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
- 2026-05-03 | **Auto-close the month on the 1st** | Replace (or supplement) the manual "Close this month" button with an automatic month-end rollup that fires when the user opens the app on day 1 of a new month. `autoRolloverIfNewMonth` already exists in the bills layer; extend the same pattern to month_history archival + score finalization. Manual button stays as an override. | Saves a step, prevents stale month-in-progress state for users who don't visit the Settings drawer
- 2026-05-03 | **Add-to-Home-Screen prompt after engagement** | Show an install prompt (iOS Safari = share/add instructions, Android Chrome / desktop Chrome = `beforeinstallprompt` one-tap button) after the user has engaged for N sessions — never on first visit. PWA already auto-updates (no fetch handler in `service-worker.js`, so each open pulls fresh `app.html`). Push card on iOS Safari already nudges install inline (commit 2026-05-03); this is the broader cross-platform prompt. Acts as a soft "get the app" path before App Store. | App-store-without-app-store; reduces friction for users who'd benefit from push + offline icon
- 2026-05-03 | **Push-driven allocation flow (notification → allocate sheet)** | When Plaid detects a deposit (transaction with positive amount in a depository account), `send-push` fires a notification: "$X just landed — give it a job." Tapping the notification deep-links into the allocate sheet pre-filled with the detected amount. User still allocates manually (preserves Floor-First's "every dollar gets a job" moment); the system just handles the *trigger*. When this ships, Plaid effectively becomes the source of truth for income events and the manual `Log new income` becomes the cash/Venmo escape hatch instead of the default. Likely also lets us collapse the dual-balance reads (Balance + Bank balances dropdown) into one. | Behavior change + system-driven trigger. Replaces the "remember to open Able when you get paid" friction without short-circuiting the allocation moment. Long-term: the income half of Plaid-first.

---

## Promoted to triage (with date moved)

*(items moved out get a one-line entry here so we have an audit trail)*

---

## Rejected (with reason)

*(ideas explicitly killed get logged here so we don't re-litigate)*

- 2026-05-03 | Trim achievements grid for new users | **Rejected.** Half the personas loved the dense gallery; the right fix is minimize/expand toggle + closest-to-unlocking sort, which is on triage as #6. Trimming would lose the users for whom achievements are working.
- 2026-05-03 | Raise "Snowball Started" threshold from $200 to $500 | **Parked, not committed.** Only Riley (1 of 6 personas) flagged it as patronizing. Maya/Jordan would never trigger it at higher gates. The achievement is correctly calibrated for the people who need it most.
