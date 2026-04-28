# Able — Information Security Policy

**Version:** 1.0
**Effective date:** 2026-04-27
**Owner:** Paul Johnson, Founder (security@becomeable.app)
**Review cadence:** Reviewed at minimum annually, and any time there is a material change to systems, vendors, or scope of data processed.

---

## 1. Purpose and scope

This policy defines how Able protects the confidentiality, integrity, and availability of customer information and the systems that process it. It applies to all production systems, code, vendors, and personnel (currently a single founder; the policy is written so it remains valid as the team and surface grow).

Able is a personal-finance application that helps users plan deposits across categories (taxes, bills, smoothing, debt, free spending) and connects to user-authorized financial institutions via Plaid for read-only transaction data.

## 2. Roles and responsibilities

- **Security owner:** Paul Johnson, Founder. Responsible for setting, communicating, and enforcing this policy; for vendor due diligence; for incident response; and for reviewing this policy at least annually.
- **All personnel (current and future):** Required to follow this policy, complete any assigned training, and report suspected security incidents to the security owner without delay.
- **Contractors and third parties:** Bound by equivalent obligations through written agreements before being granted access to any production system or customer data.

## 3. Risk management

Able operates a deliberately small attack surface: a static web frontend hosted on Netlify, a managed Postgres + Auth backend on Supabase, and a small set of Edge Functions that broker requests to Plaid, Stripe, and Resend. Risks are reviewed at least annually and any time a new vendor or category of data is added. Identified risks are documented along with mitigations or accepted-risk rationale.

## 4. Data classification and handling

Data Able processes is classified as follows:

- **Highly sensitive:** Financial account data retrieved via Plaid (account identifiers, balances, transactions), authentication credentials, payment tokens.
- **Sensitive:** User-entered budgeting data (bills, debts, categories), email addresses, profile data.
- **Internal:** Operational metrics, application logs.

Highly sensitive data is never stored in source code, build artifacts, frontend bundles, browser localStorage, or analytics destinations. It resides only in the Supabase Postgres database (encrypted at rest) and is transmitted only over TLS 1.2 or higher.

## 5. Access control

- **Production data and systems:** Access is restricted to the security owner using role-based access control (RLS policies on every Supabase table; principle of least privilege).
- **Service-to-service authentication:** Edge Functions authenticate to Supabase using a service role key stored only as a server-side environment variable. The key is never exposed to the browser.
- **OAuth / token-based authentication** is used for non-human actors (Edge Functions to Supabase, Edge Functions to Plaid/Stripe/Resend). API keys are rotated immediately upon any suspected exposure and at least annually.
- **Least privilege:** New systems and integrations are configured with the minimum permissions required.
- **Provisioning and de-provisioning:** Any future contractor or employee is granted access only after signing a confidentiality agreement and only to the systems required for their work. Access is removed within 24 hours of role change or termination.
- **Access reviews:** The security owner reviews all production access and the list of issued API keys at least quarterly and removes anything no longer required.

## 6. Authentication

- **End-user authentication:** Supabase Auth with email + password. Passwords are stored only as Supabase-managed bcrypt hashes; Able never sees plaintext passwords. Email verification is required before sensitive actions.
- **Multi-factor authentication for end users:** Multi-factor authentication is offered to end users and is required before connecting a financial institution via Plaid Link.
- **Multi-factor authentication for administrators:** MFA is required on every administrative system that touches production or customer data, including Supabase, GitHub, Netlify, Stripe, Resend, the registrar, and the email and identity providers used by the security owner.
- **Session management:** Supabase issues short-lived access tokens with refresh tokens; sessions are invalidated on logout and on password change.

## 7. Encryption

- **In transit:** All traffic between clients, Able's frontend, Edge Functions, Supabase, Plaid, Stripe, and Resend uses TLS 1.2 or higher. HTTP is redirected to HTTPS at the edge.
- **At rest:** All consumer data, including data retrieved from the Plaid API, is stored in Supabase Postgres, which encrypts data at rest with AES-256. Object storage is likewise encrypted at rest. Backups inherit encryption from the underlying storage.
- **Secrets:** Application secrets (API keys, service role keys, webhook signing secrets) are stored only in managed secret stores (Supabase Edge Function secrets, Netlify environment variables) and are never committed to source control.

## 8. Vulnerability and patch management

- **Dependency scanning:** GitHub Dependabot is enabled on the production repository and produces alerts for vulnerable dependencies.
- **Endpoint protection:** Developer endpoints run a supported, patched OS with full-disk encryption (FileVault on macOS), automatic OS updates enabled, and the OS-vendor's built-in malware protection (XProtect) active.
- **Managed infrastructure:** OS- and platform-level patching for Netlify and Supabase is handled by those vendors under their security programs.
- **End-of-life software:** Dependencies and runtimes are monitored via Dependabot and vendor advisories; end-of-life components are upgraded or replaced before their support window ends.
- **Patch SLAs:** Critical vulnerabilities are remediated within 7 days of disclosure; high within 30 days; medium and low within 90 days. SLAs run from the date the vulnerability becomes known to the security owner.

## 9. Secure software development

- All production code is reviewed by the security owner before deployment.
- Source is stored in a private GitHub repository protected by MFA.
- Secrets are never committed; pre-commit and code review checks are used to catch accidental disclosure.
- Server-side input validation is used for all data crossing trust boundaries.
- Database access from clients is mediated by Supabase RLS policies that enforce per-user data isolation.

## 10. Logging and monitoring

- Supabase logs authentication events and database activity for the supported retention window of the Supabase plan in use.
- Netlify logs deployment and edge events.
- Application errors and unexpected events are surfaced to the security owner.
- Logs are reviewed in response to suspected incidents and on a periodic basis.

## 11. Incident response

In the event of a confirmed or suspected security incident:

1. The security owner contains the incident (rotate credentials, disable affected accounts, isolate affected systems).
2. Scope and impact are assessed, including whether customer data was accessed or disclosed.
3. Affected customers are notified without undue delay where required by applicable law.
4. Plaid and any other affected vendors are notified per their incident-reporting requirements.
5. A post-incident review is documented and corrective actions are tracked to closure.

## 12. Vendor and third-party management

Able relies on the following sub-processors. Each is reviewed for an established security program (SOC 2, ISO 27001, or equivalent) before integration and at least annually thereafter:

- **Supabase** — managed Postgres, Auth, Edge Functions, and storage
- **Netlify** — static frontend hosting and edge delivery
- **Plaid** — financial data connectivity
- **Stripe** — payments and subscription billing
- **Resend** — transactional email
- **Anthropic** — AI Coach inference (only the data required for a coaching turn is sent; raw Plaid data is not transmitted)

Vendor changes that materially affect data handling trigger a review of this policy.

## 13. Privacy and consent

- A privacy policy is published at https://becomeable.app/privacy.html and describes data collection, processing, storage, sharing, retention, and user rights.
- Consent to the privacy policy and terms of service is required at signup.
- Plaid Link is invoked only after the user takes an explicit action to connect a financial institution; the in-product consent disclosures meet Plaid's End User Privacy Policy requirements.

## 14. Data retention and deletion

- Active account data is retained for the lifetime of the user's account.
- Users may request export or deletion at any time.
- On account deletion, personal data is removed from production systems within 30 days, except where retention is legally required (for example, billing records).
- Backups are overwritten on a rolling basis, typically within 30 days.
- Plaid-derived data is purged when the user disconnects an institution or deletes their account.
- This retention schedule is reviewed at least annually for continued compliance with applicable law.

## 15. Personnel security

- The security owner has reviewed and accepted this policy.
- Future personnel and contractors must sign a confidentiality agreement and acknowledge this policy in writing before being granted access.
- Security awareness expectations (phishing recognition, password hygiene, MFA, secret handling) are communicated as part of onboarding.

## 16. Business continuity

- Production data is hosted on managed services (Supabase, Netlify) with vendor-provided durability and backup guarantees.
- Source code is mirrored to GitHub and developer endpoints.
- Deployment is automated from the main branch on GitHub; the application can be redeployed from source within minutes.

## 17. Policy review and exceptions

- This policy is reviewed at least annually and after any material change to systems, vendors, or scope of data processed.
- Exceptions to this policy must be documented, time-bound, and approved by the security owner.
- Material changes are recorded in the change log below.

## Change log

- **2026-04-27 — v1.0** — Initial policy issued in connection with Plaid production-access onboarding.
