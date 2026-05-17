# Privacy Policy

**Effective date:** 2026-04-23
**Last updated:** 2026-05-16

Able App ("Able," "we," "us," or "our") operates the Able application at https://becomeable.app and the Able web app at https://becomeable.app/app.html (together, the "Service"). This Privacy Policy explains what information we collect, how we use it, who we share it with, and the rights you have over it.

By using the Service you agree to the handling of information as described here.

---

## 1. Information we collect

### 1.1 Account information
When you sign up we collect:
- Email address and password (or Google account ID if you sign in with Google)
- The timestamp of your account creation and most recent activity

### 1.2 Financial data you enter
Able is a budgeting tool, so most of what you put into it is financial information. This can include:
- Bills, debts, income sources, and forecast items
- Balances, interest rates, and due dates
- Your allocation preferences (percentages across debt, savings, and spending)
- Goals, notes, and any other content you choose to save

You can enter this data manually, or you can connect a bank account through Plaid (see Section 1.7) to import balances and transactions.

### 1.3 Usage and product analytics
We collect basic product analytics to understand how the Service is used and to improve it. This may include:
- Pages viewed, features used, and interactions with the app
- Device and browser type, operating system, approximate location (country/region) derived from IP
- Referral source

Inside the Able web app (the signed-in product at `/app.html`), our general-purpose product analytics is limited to PostHog, used to improve the Service. The advertising and conversion-tracking tags described in Section 1.3.1 also fire on a small number of in-app moments — primarily the post-checkout confirmation page — so we can attribute paid subscriptions back to the ad campaign that brought you in. They do not track your day-to-day app usage.

### 1.3.1 Advertising and conversion tracking on our marketing pages
On our public marketing pages (the home page and our landing pages) we also run advertising and conversion-tracking tags so that we can measure the performance of our ads and reach you with relevant ads on other platforms. These include:
- **Meta Pixel** (Facebook and Instagram) — page views, content views, sign-ups, and purchases, plus a hashed copy of your email if you sign up, so Meta can match conversions back to ads you saw.
- **Google Ads / Google Analytics 4 (gtag)** — page views and conversion events for ad measurement and retargeting.

These tags set cookies that Meta and Google use to build behavioral profiles for advertising. Under California law (CCPA/CPRA) this counts as *sharing your personal information for cross-context behavioral advertising*. See Section 9 for how to opt out.

### 1.4 Payment information
Payments for the Service are processed by Stripe. We do not collect or store your full credit card number. We receive and store:
- Your subscription status (trial, active, canceled, past due)
- The last 4 digits of your card and card brand (from Stripe)
- Billing country and postal code (for tax)

Stripe's privacy policy: https://stripe.com/privacy

### 1.5 AI Coach interactions
If you use the AI Coach feature, the messages you send and the Coach's replies are stored in our database so the Coach can maintain conversation history for you. Your messages and a snapshot of your current in-app numbers are also sent to our AI provider, Anthropic, to generate responses.

Anthropic's privacy policy: https://www.anthropic.com/legal/privacy
Anthropic's commercial terms state that API content is not used to train their models.

### 1.6 Cookies and local storage
We use cookies and browser local storage to keep you signed in, remember your preferences, and cache your app state for offline reliability. We also allow third-party advertising cookies (Meta Pixel, Google Ads) on our public marketing pages — see Section 1.3.1 and Section 9. You can clear cookies at any time through your browser settings; doing so will sign you out.

### 1.7 Bank connections via Plaid
If you choose to connect a bank account, we use **Plaid Inc.** to establish that connection. You authenticate with your bank directly inside Plaid's interface; we never see your bank username or password. Once you authorize the connection, Plaid sends us:
- The name and type of each connected account, masked account number, and current/available balance
- Recent transactions (date, amount, merchant, category) for the lookback window you select when connecting
- For credit and loan accounts, the balance, minimum payment, and statement information

We store this information so Able can detect bills, track buffer balances, and surface recurring debts. You can disconnect a bank at any time from inside the app; disconnecting stops future data pulls and you can also request deletion of previously imported transactions by emailing us.

Plaid's privacy policy: https://plaid.com/legal/#end-user-privacy-policy

---

## 2. How we use your information

We use what we collect to:
- Provide the Service and your account
- Process payments and manage your subscription
- Send transactional email (e.g. password reset, trial expiration, billing)
- Send product and marketing email if you have opted in
- Generate AI Coach replies
- Analyze product usage and improve the Service
- Detect fraud, abuse, and security issues
- Comply with our legal obligations

We do not sell your personal information for money. However, our use of Meta Pixel and Google advertising tags on our marketing pages may be considered "sharing for cross-context behavioral advertising" under California law. You can opt out at any time — see Section 9.

---

## 3. Who we share information with

We share information only with the following categories of service providers, and only what they need to do their job:

| Vendor | Purpose | Data shared |
|---|---|---|
| Supabase | Database, authentication, serverless functions | Account data, app data, coach messages, imported bank data |
| Stripe | Payments and subscription management | Email, subscription status, billing country |
| Plaid | Bank account connections (if you choose to connect) | Bank credentials you enter directly into Plaid; Plaid returns balances and transactions to us |
| Anthropic | AI Coach responses | Your coach message and a snapshot of your in-app numbers |
| Resend | Transactional and marketing email | Email address, name |
| PostHog (US cloud) | Product analytics | Usage events, device/browser metadata |
| Meta Platforms (Facebook/Instagram) | Advertising measurement and retargeting on marketing pages | Page-view and conversion events, cookie identifiers, hashed email on sign-up/purchase |
| Google (Google Ads, GA4) | Advertising measurement and retargeting on marketing pages | Page-view and conversion events, cookie identifiers |

We may also disclose information if required by law, subpoena, or court order, or when we believe in good faith that disclosure is necessary to protect our rights, your safety, or the safety of others.

If Able App is acquired or merges with another company, your information may be transferred to that company as part of the transaction. We will notify you before that happens.

---

## 4. Where your information is stored

Your data is stored with Supabase, which hosts on Amazon Web Services. Data may be stored in or transferred to data centers in the United States or other countries. By using the Service you consent to this.

---

## 5. Security

We use industry-standard measures to protect your information:
- Data is encrypted in transit (TLS) and at rest
- Authentication uses Supabase's session management with short-lived tokens
- Database access is restricted with row-level security so each user can only access their own data
- Payment processing is delegated to Stripe, who is PCI-DSS Level 1 certified

No system is perfectly secure. If you believe your account has been compromised, contact us immediately at hello@becomeable.app.

---

## 6. Your rights

Depending on where you live, you have the right to:
- **Access** a copy of the personal information we hold about you
- **Correct** information that is inaccurate
- **Delete** your account and associated personal information
- **Export** your data in a portable format
- **Object to or restrict** certain uses of your information
- **Withdraw consent** for marketing email at any time (use the unsubscribe link in any email)

To exercise these rights, email us at hello@becomeable.app. We will respond within 30 days.

---

## 7. Children

The Service is not intended for children under 13 (or under 16 in the EEA/UK). We do not knowingly collect information from children. If you believe a child has given us personal information, contact us at hello@becomeable.app and we will delete it.

---

## 8. Data retention

- Active account data is retained for as long as your account is open.
- If you delete your account, we delete your personal information within 30 days, except where we are legally required to retain it (for example, billing records for tax purposes).
- Backups that include your data are overwritten on a rolling basis, typically within 30 days.

---

## 9. California, EU, and UK residents

If you are in California, the EU, or the UK, you have additional rights under the CCPA/CPRA, GDPR, or UK GDPR respectively. The rights listed in Section 6 satisfy most of these, but you also have the right to lodge a complaint with your local data protection authority.

Our legal basis for processing your information under GDPR/UK GDPR is (1) performance of our contract with you to provide the Service, (2) your consent (for marketing email and advertising cookies), and (3) our legitimate interest in operating and improving the Service.

### 9.1 Do Not Sell or Share My Personal Information (California)
California residents have the right to opt out of the sale or sharing of their personal information for cross-context behavioral advertising. To opt out:
- **Browser-level:** Enable the Global Privacy Control (GPC) signal in your browser or extension. We honor GPC on our marketing pages and will disable Meta Pixel and Google advertising tags for that browser.
- **Email request:** Send a request to hello@becomeable.app with the subject "Do Not Sell or Share." We will confirm and act within 15 business days.
- **Platform-level:** You can also opt out of Meta advertising through Meta's ad preferences (https://www.facebook.com/settings?tab=ads) and Google advertising through Google's My Ad Center (https://myadcenter.google.com).

Opting out does not affect the analytics we run inside the signed-in product (PostHog), which is used for product improvement, not advertising.

---

## 10. Changes to this policy

We will update this policy when our practices change or when required by law. If we make material changes we will notify you by email and by a notice in the app at least 14 days before the changes take effect.

---

## 11. Contact

Questions or requests about this policy:

Able App
7548 E Savanna River St, Nampa, Idaho, United States
hello@becomeable.app
