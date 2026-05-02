# Able — App Store Launch Plan

Decision document for getting Able into the Apple App Store and Google Play Store. Written 2026-04-30.

## Decision

**Path:** Capacitor wrap (one HTML/JS codebase → iOS + Android shells), bundled assets (not remote URL load), Stripe billing via external link (no Apple IAP / Google Play Billing).

**Fallback (Android only):** Bubblewrap TWA if Capacitor Android stalls.

**Rejected:**
- React Native / Flutter rewrite — 4–6 months solo, no payoff for current feature set.
- PWA-only — loses store discovery + the trust badge financial buyers explicitly look for.
- Native Swift + Kotlin — 8–12 months, two codebases, out of scope.

## The billing decision (most consequential)

Able is a **Multiplatform Service under Apple Guideline 3.1.3(b)** — same bucket as Notion, Spotify, Netflix. Not a "reader app." This bucket has always allowed external sign-up + sub purchase outside IAP.

Combined with the post-Epic 2025 rulings (Apple ordered to allow external payment links with no fee in US; Google opened alternative billing US-wide Oct 29, 2025 with no fee currently collected), the right setup is:

- App is free to download.
- Sign-up + 30-day trial happens in-app, paywall opens **Stripe Checkout in a system browser** (`SFSafariViewController` / Chrome Custom Tab).
- Deep link back to the app on success.
- **No IAP SKUs.** ~97% kept vs ~85% (Apple Small Business) or ~70%.

**Hedge:** Wire an IAP feature flag but leave it off. If SCOTUS reverses Apple's external-link rule in 2026–2027, flip config instead of refactoring.

## The Plaid landmine

Plaid's docs explicitly state webview-based Plaid Link is **not permitted for new customers**. The existing JS Plaid Link inside a Capacitor WebView will fail OAuth banks (Chase, Capital One, BoA, Wells, USAA) in production even if Sandbox works.

**v1 path: Plaid Hosted Link.** Edge Function mints a Hosted Link URL, app opens it in `ASWebAuthenticationSession` / Chrome Custom Tab, Plaid handles bank OAuth, deep links back with the public token. Plaid-blessed, easier than the native SDK, slightly worse UX.

**Migrate later** to the native SDK (community Capacitor plugin or thin self-written bridge ~1 day) once conversion data justifies it.

Configure URL scheme `able://plaid-callback`.

## Google's 12-tester / 14-day rule

Personal Google Play accounts created after 2023-11-13 must run Closed Testing with ≥12 active testers for ≥14 calendar days before promoting to Production. Reduced from 20 to 12 on 2024-12-11. Still active in 2026.

**Organization accounts are exempt.** This is the single biggest reason to enroll Google as Org if Able LLC/Inc exists.

## Apple Guideline 4.2 — minimum-functionality rejection

A Capacitor app is rejected as "just a website" if it loads a remote URL with no native code. Avoided by:

1. **Bundle HTML/JS with the binary** (no `server.url` to becomeable.app in production). Use Capacitor Live Updates (Capgo) for OTA fixes if needed — never load remote.
2. **Native push notifications** — the strongest "this is an app" signal; iOS Safari web-push is weak.
3. **Native biometrics** (Face ID / Touch ID app-open gate) — half-day to ship.
4. **Native Plaid** (Hosted Link or SDK, not the JS Link in the WebView).

## Apple Privacy Manifest

`PrivacyInfo.xcprivacy` mandatory since May 2024. Must declare:
- Every third-party SDK: Supabase, Plaid, Stripe.
- Required-reason API codes: UserDefaults, file timestamps, system boot time, disk space.
- Data types: Financial Info, Identifiers, Usage Data — all "linked to identity," none "used for tracking."

Most common first-rejection cause for fintech.

## Other Apple gotchas

- **Sign in with Apple required (4.8)** if you offer Google sign-in. Half-day via Supabase's existing Apple OAuth provider.
- **Always provide demo login + Plaid Sandbox credentials** in App Review notes. Reviewers will not link a real bank.
- **App Privacy nutrition label** in App Store Connect itemized to match the Privacy Manifest.

## Action checklist (in order)

1. **Decide entity status.** If Able is LLC/Inc → get D-U-N-S (free via Apple's tool, ~5 days) → enroll Apple as Org + Google as Org (skips 12-tester rule). If no entity, enroll both Individual now and convert later.
2. **Pay Apple ($99/yr) + Google ($25 one-time)** today — verification takes up to a week.
3. **Start recruiting 12 Android testers** from email list / X / community NOW (parallel to all dev). Real Android devices, not emulators.
4. **Add PWA manifest + service worker** to becomeable.app. Hour of work; gives Bubblewrap TWA as Android fallback and "Add to Home Screen" on the marketing site.
5. **Split `app.html` from `index.html`** into separate deploy targets — Capacitor bundle should not include marketing pages.
6. **Capacitor init** in a new repo, copy `app.html` + assets into `www/`, run on simulator.
7. **Wire native Plaid Hosted Link** — Edge Function for URL minting, `@capacitor/browser` to open + deep-link callback.
8. **Wire Stripe Checkout** — same pattern, `@capacitor/browser` opens checkout, deep link back on success.
9. **Native plugins:** `@capacitor/push-notifications`, biometric auth, `@capacitor/app` for deep links, `@capacitor/preferences` for secure storage.
10. **iOS:** Privacy Manifest (`PrivacyInfo.xcprivacy`), Sign in with Apple, APNs key in Apple Developer + Supabase Edge Function for push.
11. **Android:** target SDK 35, fill data safety form, FCM, adaptive icon (foreground + background).
12. **Store listings:** screenshots in 6.7" + 6.5" + 5.5" (iOS), phone + 7" tablet (Android). Use existing `/brand/*.html` mocks; phone-frame static library work-in-progress.
13. **Submit to TestFlight** for internal/external testing. Public TestFlight link works *without* full App Store review — usable as "iOS beta" channel.
14. **Submit Android to Closed Testing** (start 14-day clock immediately).
15. **Submit App Store Review** with demo login + Plaid Sandbox credentials + a one-paragraph "what makes this an app" pre-emptive note.
16. **Promote Google Play to Production** after 14 days of valid closed testing.

## Timeline + cost

| Phase | Duration |
|---|---|
| Account setup + D-U-N-S (parallel with code) | 1 week |
| Capacitor scaffold + bundle existing app | 1 week |
| Native Plaid + Stripe + push + biometrics | 1.5 weeks |
| Store listing assets + screenshots | 0.5 weeks |
| Android Closed Testing (mostly waiting) | 14 days |
| iOS first review | 3–7 days |
| 1–2 iOS rejection cycles (assume one) | 1–2 weeks |
| **Total elapsed to live in both stores** | **~6–9 weeks** |

**Year-1 cash:** ~$125–150 (Apple $99, Google $25). Optional Capgo Live Updates ~$14/mo.

## Where surprises hit

1. **First Apple rejection** — almost guaranteed. Most likely: Privacy Manifest missing an SDK declaration, or 4.2 because Plaid Sandbox isn't usable by reviewer.
2. **Plaid OAuth in WebView** — works in Sandbox, fails Chase/BoA in production. Must use Hosted Link or native SDK.
3. **Android 12-tester rule** — 14-day stall per attempt if testers aren't recruited early.
4. **Sign in with Apple** — required by 4.8 if Google sign-in offered.

## Key sources

- Apple App Review Guidelines (current)
- Epic v Apple — Apple guideline update 2025-05-01, 9th Circuit partial reversal 2025-12-11, SCOTUS petition pending as of 2026-04
- Google alternative billing US-wide opened 2025-10-29, no fee currently collected
- Google Closed Testing 12-tester rule confirmed active 2026
- Plaid Hosted Link docs (the recommended mobile path when SDK isn't shipped)

Full research transcript and citations in conversation history (2026-04-30 session).
