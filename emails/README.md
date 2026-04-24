# Able email sequences

Drafts for the Able lifecycle email sequences. Review, tweak voice, and paste into your email tool (Resend API, GoHighLevel workflow, or whatever you choose).

**Voice guardrails** (matches Coach + landing):
- Short sentences. Plain language.
- No em dashes anywhere — they read as AI. Use periods, commas, or hyphens.
- No emojis unless the reader used one first.
- Warm, calm, specific. Not hype, not corporate, not therapized.
- From: `Paul at Able <paul@becomeable.app>` (or your preferred sender).
- Reply-to always routes to a monitored inbox.

**Required unsubscribe link** on every marketing email (CAN-SPAM). Transactional (confirmation, receipt, trial ending) can skip unsubscribe but should include a plain-text reason line like "You're getting this because you have an Able trial."

## Files

| File | When it fires |
|---|---|
| `welcome-01-confirm-email.md` | Immediately after signup, before they can sign in. Transactional. |
| `welcome-02-trial-started.md` | Right after checkout completes (trial begins). |
| `welcome-03-first-income-win.md` | First time `first_income_logged` event fires. |
| `welcome-04-day-2-check-in.md` | 48h after `trial_started`. |
| `trial-day-5-nudge.md` | ~48h before trial ends. |
| `trial-day-7-last-call.md` | ~24h before trial ends. |
| `abandoned-checkout.md` | Signed up, did not complete checkout within ~1 hour. |
| `trial-ended-no-convert.md` | Trial ended + status flipped to inactive. |
| `dormancy-5-days.md` | No app login in 5 days. |
| `win-back-canceled.md` | Paid subscriber canceled. Sent ~3 days later. |

## Trigger logic summary

Subscribe to the Stripe webhook events and PostHog custom events to drive:

- `signup_completed` → schedule welcome-01.
- `trial_started` → schedule welcome-02, welcome-04 (+48h), day-5 nudge (trial_end - 48h), day-7 last call (trial_end - 24h).
- `first_income_logged` → send welcome-03 (once).
- No `trial_started` within 1h of `signup_completed` → abandoned-checkout.
- `subscription_canceled` + previously active → win-back-canceled (+3d).
- Trial ended (`subscription.deleted` event while status was `trialing`) → trial-ended-no-convert.
- User inactive 5d (from app login ping) → dormancy-5-days.

If using GHL, the Stripe webhook can fan out there. If using Resend + Supabase `email-cron-daily`, the cron scans `profiles` each morning and sends whoever matches the window.
