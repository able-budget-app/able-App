# Able — App Store Connect Submission

Paste-ready content for App Store Connect. Each section maps to a specific App Store Connect field.

Voice is locked per `docs/brand-script.md`. PrivacyInfo data types are pulled from `ios-wrapper/ios/App/App/PrivacyInfo.xcprivacy` — they must match what's declared in the App Privacy section below.

Status: drafted 2026-05-14. Awaiting final pass before submission.

---

## App Information

### App Name (30 char limit)

**`Able: Inconsistent Income`** *(25 chars)*

### Subtitle (30 char limit)

**`Built for inconsistent income`** *(29 chars)*

### Bundle ID

`com.becomeable.app`

### Primary Category

**Finance**

### Secondary Category

**Productivity**

---

## Promotional Text (170 char limit)

**Recommended:**
```
Built for the paycheck that doesn't follow a schedule. Every deposit gets a plan: bills first, then debt, reserve, and yours to spend. 30 days free.
```
*(147 chars)*

Promo text can be updated anytime without resubmitting the binary. Use it for seasonal hooks (tax season, end-of-year), trial-end campaigns, or feature launches.

---

## Description (4000 char limit)

```
Built for the paycheck that doesn't follow a schedule.

Most budgeting apps assume a steady paycheck. Yours doesn't. Income arrives in deposits — a Stripe payout, a client invoice, a marketplace payment — and the gap between deposits is what makes traditional budgeting feel impossible.

Able is built for the way you actually get paid.

THE FLOOR-FIRST METHOD

Bills + tax = your Floor. Every deposit fills the Floor first. Once your bills in the planning window are reserved, anything left is split across four buckets you control: pay yourself, extra debt payoff, reserve, and free to spend.

You stop guessing whether you can afford a $200 expense, because Able shows what's truly safe to spend after every upcoming bill is already covered.

WHAT'S INCLUDED

• Per-deposit allocation. Every dollar gets a job.
• AI Coach that knows your real numbers. Not generic finance advice — your bills, your debts, your reserve, your income.
• Bank connection via Plaid. Reads twelve months of history to detect bills, debts, and recurring income automatically.
• Bill tracker with funded-this-month progress. Check off bills as you pay them.
• Debt payoff timeline. Avalanche (highest rate first) or Snowball (smallest balance first), with payoff date and interest cost.
• Tax bucket that comes off the top of every deposit, calibrated to your state.
• Monthly score. Watch your habits build over time.
• Sandbox / what-if mode. Test a hypothetical income before it lands.
• Tax export. Every transaction you marked deductible, grouped by category, ready for your accountant.

PRIVACY-FIRST

No ads. No selling your data. No tracking across other apps. Your financial information is used only to power Able's planning and shown only to you.

PRICING

30 days free. Then $14.99/month or $129/year. Cancel anytime in Settings.

WHO IT'S FOR

Freelancers, creators, contractors, consultants, and business owners with inconsistent income. If your income doesn't arrive on the 1st and the 15th, this app was built for you.

THE PROBLEM WAS NEVER YOU.

It was the advice you were handed. Every "budget your salary" framework assumed a paycheck you don't have. Able assumes the opposite — that the next deposit might be small, might be large, might arrive in three days or three weeks. The plan still works.

LEGAL

Read the Terms (becomeable.app/terms) and Privacy Policy (becomeable.app/privacy) before signing up. Subscriptions are handled by Stripe. Your card is required to start the trial. You'll receive a reminder email two days before the trial converts to paid.
```
*(~2,500 chars — leaves room for additions)*

---

## Keywords (100 char limit, comma-separated)

**Recommended:**
```
freelance,budget,income,taxes,debt,savings,1099,contractor,creator,gig,plaid,money,finance
```
*(96 chars)*

Apple ignores spaces between commas, so the format above maximizes char budget. "Able" doesn't need to appear in keywords — the app name already indexes it.

Avoid: any competitor names (Mint, YNAB, Copilot) — Apple rejects.

---

## URLs

| Field | Value |
|---|---|
| **Marketing URL** | https://becomeable.app |
| **Support URL** | https://becomeable.app/support.html |
| **Privacy Policy URL** | https://becomeable.app/privacy |

---

## Age Rating

Answer **None** for every category in the age rating questionnaire. The questionnaire produces an age rating of **4+** (suitable for all ages).

Specific answers:

| Category | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Gambling | None |
| Contests | None |
| Unrestricted Web Access | **No** — Able does not load arbitrary web content. The only outbound web view is Stripe Checkout / billing portal, both on stripe.com. |

---

## App Privacy (Nutrition Label)

Apple's wizard will ask the questions; this is what to answer. Pulled directly from `PrivacyInfo.xcprivacy` so the two stay in sync.

### Data Used to Track You

**None.** Able does not use any data for tracking across other companies' apps or websites. `NSPrivacyTracking` is `false` in the manifest.

### Data Linked to You

For each item below: **Linked to user identity = Yes; Used for tracking = No.**

| Apple Category | Specific Data Type | Purposes |
|---|---|---|
| Contact Info | **Email Address** | App Functionality, Customer Support |
| Contact Info | **Name** | App Functionality |
| Identifiers | **User ID** | App Functionality, Analytics |
| Financial Info | **Other Financial Info** *(transactions, balances, bills, debts)* | App Functionality |
| Financial Info | **Payment Info** *(Stripe customer ID, last 4 of card)* | App Functionality |
| Usage Data | **Product Interaction** | Analytics, App Functionality |
| Diagnostics | **Crash Data** | App Functionality |
| Diagnostics | **Performance Data** | Analytics, App Functionality |

### Data Not Linked to You

**None.**

---

## App Review Information

### Contact Information

| Field | Value |
|---|---|
| First name | Paul |
| Last name | Johnson |
| Phone | (208) 899-7499 |
| Email | hello@becomeable.app |

### Demo Account

| Field | Value |
|---|---|
| Username | `appreview+apple@becomeable.app` |
| Password | `applereviewer_1` |

Pre-seeded with:
- Confirmed email
- `subscription_status = 'active'` (skips paywall)
- Manually-entered sample bills + debts (so the dashboard renders meaningfully)
- A couple of seed Coach messages (so the panel isn't empty when reviewers open it)

### Notes for Reviewer

```
Hi Apple App Review,

Able is a budgeting app for people with inconsistent income — freelancers, creators, contractors, and business owners whose paychecks don't arrive on a fixed schedule. The core mechanic is per-deposit allocation: every time money lands, Able shows where each dollar goes (bills first, then debt, reserve, free spending) based on the user's plan.

WHAT TO TEST

1. Sign in with the demo credentials above. The account is pre-loaded with an active subscription so you'll skip the paywall and land directly on the dashboard.
2. Explore the four main tabs: Home (today's snapshot), Plan (bills/debt/forecast), Score (monthly progress), and More (Coach, Learn, Settings).
3. Tap the Coach floating button (bottom right) to chat. Coach has full context of the demo account's numbers.
4. Tap "Log income" on the home hero to walk through the allocation flow — type any amount, pick a source, and Able splits it across the buckets.

PLAID BANK CONNECTION

Connecting a real bank requires Plaid OAuth, which we do not ask reviewers to complete. The demo account has manual bills/debts pre-loaded so every screen renders meaningfully without a bank connection. If you want to see the bank-connect screen anyway, tap More → Settings → Connected accounts → Connect another bank. You can dismiss the Plaid sheet without completing.

BILLING (GUIDELINE 3.1.3(b) MULTIPLATFORM SERVICE)

Able is a Multiplatform Service used on the web (becomeable.app), iOS, and Android. Subscriptions purchased on the web are valid across platforms; subscriptions purchased in-app would be valid on the web. Per Guideline 3.1.3(b), this category is permitted to offer subscriptions outside of In-App Purchase. The app is free to download; signup and 30-day trial happen inside the app; the paywall opens Stripe Checkout in SFSafariViewController (via @capacitor/browser) and returns the user to the app via the able:// URL scheme. No In-App Purchase SKUs are used.

This matches the model used by Netflix, Spotify, and Notion in the same 3.1.3(b) bucket.

CONTACT

If anything is unclear or you need a different test path, please reach me at hello@becomeable.app and I'll respond within the hour.

Thanks for your time,
Paul
```

### Attachment

Optional but recommended: attach a short screen recording (15-30s) showing the signup → dashboard flow. App Review reviewers often skim attachments, and a visual makes the "this is a real budgeting app" point in 10 seconds.

---

## Version Information

### What's New in This Version (4000 char limit)

For v1.0 — first release:

```
Welcome to Able. Built for the paycheck that doesn't follow a schedule.

Connect your bank and Able reads twelve months of history to detect bills, debts, and recurring income. Every deposit gets a plan: bills first, then your four buckets — pay yourself, extra debt payoff, reserve, and free to spend. The AI Coach knows your real numbers, not generic advice. Watch your monthly score build over time.

30 days free. Cancel anytime.
```

For future updates, use the standard "What's new" format: bullet list of user-visible changes, written in Able's voice (no founder POV, no "we").

### Copyright

```
© 2026 Able LLC
```

### Routing App Coverage File

Not applicable (not a navigation app).

---

## Screenshots Checklist

### Required Sizes

| Display | Resolution | Required? | Notes |
|---|---|---|---|
| **6.7" iPhone Pro Max** | **1290 × 2796** *(portrait)* | **MANDATORY** | iPhone 15 Pro Max / 16 Pro Max. Apple uses these as the default. |
| 6.5" iPhone (legacy) | 1284 × 2778 or 1242 × 2688 | Recommended | Falls back when 6.7" not provided. |
| 5.5" iPhone | 1242 × 2208 | Deprecated June 2024 | Skip. |

iPad: only required if app supports iPad. Able is iPhone-only for v1.0 — skip.

### Capture Method

iPhone 15 Pro Max Simulator in Xcode:
1. Open Simulator → Device menu → choose **iPhone 15 Pro Max**
2. Run Able from Xcode (⌘R)
3. In Simulator, use `_devPlanReview()` from the JS console to populate the plan screen with realistic numbers (avoids "$0.00" everywhere)
4. Capture: ⌘S in Simulator → screenshot lands on Desktop as 1290 × 2796 PNG

### Scene List (5-8 recommended)

Pick which 5-8 best tell the story. My order:

1. **Splash / hero** — the animated "Able" wordmark with underline + "Built for inconsistent income" tagline. First impression.
2. **Onboarding step** — the "What brought you here?" multi-select, showing personalization is real.
3. **Home / dashboard** — money hero + score card + action chips. The most-used screen.
4. **Plan → Bills** — the funded-this-month progress bar with a real list of bills. The Floor-First proof.
5. **Coach panel** — open chat with a realistic example exchange ("How should I split this deposit?" → Coach's response with the user's actual numbers).
6. **Score page** — streak card + 6-month chart. Shows the progression payoff.
7. **Plan → Debt** — Avalanche timeline with payoff date. The "look what's possible" screen.
8. **Settings** — Subscription / Connected accounts card. Shows trust + control.

Skip the paywall in screenshots. Apple notices and is less generous when paywall is the first thing in the gallery.

### Optional: App Preview Video

15-30 second video that screen-records the app. Higher conversion than stills. Worth doing for v1.0 if you have an hour. Can be uploaded later as a v1.0.1 metadata update without resubmitting the binary.

---

## Pre-submission Checklist

Before you tap Submit for Review:

- [ ] Bundle ID `com.becomeable.app` matches the App Store Connect record
- [ ] Version number + build number set in Xcode (matches App Store Connect version)
- [ ] Release scheme configured (not Debug)
- [ ] Sign in with Apple capability checked in Signing & Capabilities
- [ ] PrivacyInfo.xcprivacy present and matches the App Privacy section above
- [ ] Demo account created in Supabase + subscription_status manually set to 'active' + sample data seeded
- [ ] Screenshots uploaded (at minimum 6.7" set)
- [ ] App Privacy section completed (matches PrivacyInfo)
- [ ] Review notes pasted (the long block above)
- [ ] Phone number filled in
- [ ] Test on a real iPhone one more time after archiving
- [ ] Archive in Xcode (Product → Archive) and upload via Organizer
- [ ] Build appears in App Store Connect under TestFlight → wait ~10-15 min for processing
- [ ] Smoke-test the TestFlight build on your own iPhone
- [ ] Add the build to the version, then Submit for Review

---

## Likely first-rejection causes and how to preempt

Apple reviewers most commonly reject fintech apps for:

1. **Privacy Manifest mismatch** — App Privacy in App Store Connect doesn't match `PrivacyInfo.xcprivacy`. Fixed by copying the table above verbatim into the wizard.

2. **Demo account missing or non-functional** — reviewer can't get past sign-in. Fixed by the demo account setup above. Test the demo creds on a fresh device before submitting.

3. **Plaid OAuth blocked in WebView** — known issue. We pre-empt by telling reviewers in notes that bank connection is optional and the demo account has manual sample data.

4. **Guideline 3.1.1 IAP avoidance** — accusation that the Stripe paywall circumvents IAP. Pre-empted by the 3.1.3(b) Multiplatform Service paragraph in review notes. If they reject anyway, respond by citing Guideline 3.1.3(b) explicitly and pointing to the post-Epic 2025 ruling (allowing external payment links in US with no Apple fee).

5. **Guideline 4.2 — minimum functionality** — accusation that the app is "just a website." Pre-empted by:
   - Native SIWA (Sign in with Apple)
   - Native push notifications (when wired)
   - Native deep-link handling
   - Bundled HTML/JS (not `server.url`)
   - Native Plaid Hosted Link (still TODO before launch — flag below)

6. **Metadata mismatch** — keywords/description claims something the app doesn't do. Pre-empted by writing the description entirely from `able-app-capabilities` SKILL — every claim above is true today.

---

## Known caveats (not blocking, but document)

- **Plaid Hosted Link** is deferred to v1.1. The current implementation uses Plaid Link JS inside the WebView, which Plaid technically does not allow for new customers. This works in Sandbox / on Paul's own production account, but real-bank OAuth (Chase, BoA, Wells, etc.) will fail for some users. App Review reviewers won't hit this because we tell them to skip bank connect. **End users will hit it.** Migrate to Hosted Link in v1.1.

- **Sign in with Google** not yet wired on iOS (web only). v1.1.

- **Push notifications** not yet wired on iOS native (web push only). Worth wiring before submission as it's a Guideline 4.2 "this is a real app" signal — Apple looks favorably on apps that use native iOS capabilities.
