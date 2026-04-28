# Able — Access Control Policy

**Version:** 1.0
**Effective date:** 2026-04-27
**Owner:** Paul Johnson, Founder (security@becomeable.app)
**Review cadence:** Reviewed at minimum annually, and any time there is a material change to systems, vendors, personnel, or the scope of data processed. This policy is a companion to the Able Information Security Policy and inherits its definitions and roles.

---

## 1. Purpose and scope

This policy defines how Able controls and limits access to production systems, production data, source code, and any system that stores, processes, or transmits customer information. It applies to all personnel (currently a single founder), contractors, and automated service identities.

Able operates a deliberately small attack surface: a static web frontend hosted on Netlify, a managed Postgres + Auth backend on Supabase, and a small set of Edge Functions that broker requests to Plaid, Stripe, Resend, and Anthropic.

## 2. Guiding principles

- **Least privilege.** Every human and service identity is granted the minimum access required to perform its function, and no more.
- **Need to know.** Access to highly sensitive data (Plaid-derived financial data, authentication credentials, payment tokens) is restricted to the security owner and to service identities that require it to fulfill a user request.
- **Default deny.** Database access from end-user clients is mediated by Supabase Row-Level Security (RLS) policies that default to deny and grant per-user access only.
- **Separation of duties.** Production secrets are stored only in managed secret stores (Supabase Edge Function secrets, Netlify environment variables) and are never embedded in source code or frontend bundles.

## 3. Roles and identity types

- **Security owner (Paul Johnson):** Sole human with administrative access to production. Holds the master accounts for Supabase, Netlify, GitHub, Stripe, Resend, Plaid, the domain registrar, and the email/identity providers used to administer those accounts.
- **End users:** Authenticated via Supabase Auth (email + password, with MFA available and required before connecting a financial institution via Plaid Link). End users can read and write only their own rows, enforced by RLS.
- **Service identities:** Edge Functions authenticate to Supabase using a service role key stored as a server-side environment variable. Outbound integrations (Plaid, Stripe, Resend, Anthropic) use scoped API keys held only in managed secret stores.
- **Future personnel and contractors:** Granted access only after signing a confidentiality agreement, and only to the systems required for their work.

## 4. Access control mechanisms

- **Role-based access control (RBAC):** Implemented on every Supabase table via RLS policies that key off the authenticated user's ID. Administrative roles in Supabase, GitHub, Netlify, Stripe, Resend, and Plaid are limited to the security owner.
- **Authentication for administrators:** MFA is required on every administrative system that touches production or customer data, including Supabase, GitHub, Netlify, Stripe, Resend, Plaid, the domain registrar, and the email and identity providers used by the security owner.
- **Authentication for end users:** Supabase Auth with email + password and bcrypt-hashed credentials. MFA is offered to end users and required before connecting a financial institution via Plaid Link.
- **Service-to-service authentication:** OAuth and API-key based authentication for non-human actors. Keys are scoped to least privilege, stored only in managed secret stores, rotated immediately upon any suspected exposure, and rotated at least annually.
- **Network access:** Production data is reachable only over TLS 1.2 or higher. There is no public ingress to Supabase outside of the Supabase-managed gateway.
- **Endpoint controls:** Administrative access is performed only from endpoints that run a supported, patched OS with full-disk encryption (FileVault on macOS), automatic OS updates enabled, and the OS-vendor's built-in malware protection (XProtect) active.

## 5. Provisioning and de-provisioning

- **Provisioning:** Access is granted only after (a) the requesting individual has signed any required confidentiality agreement, and (b) the security owner has confirmed that the requested level of access is the minimum required for the role.
- **Modification:** When an individual's role changes, their access is reviewed and adjusted to match the new responsibilities within 24 hours.
- **De-provisioning:** Access is removed within 24 hours of role termination, contract end, or any event that ends the need for access. De-provisioning includes account disablement on every administrative system, revocation of any issued API keys, and rotation of any shared credentials the individual could have observed.
- **Service identities:** API keys and service role keys are revoked or rotated when the integration they support is decommissioned, when scope changes, or when exposure is suspected.

## 6. Access reviews

- The security owner reviews all administrative production access and the full list of issued API keys at least quarterly.
- Any access that is no longer required is removed at the time of review.
- Reviews are documented (date, systems reviewed, findings, actions taken) and retained for at least one year.

## 7. Privileged and emergency access

- There are no shared administrative accounts. Each administrative system is accessed under the security owner's individual identity.
- If emergency access is required (for example, recovery from a lockout), the action is logged, credentials and recovery codes used during the event are rotated immediately afterward, and a brief written record of the event is retained.

## 8. Logging and monitoring of access

- Supabase logs authentication events and database activity for the supported retention window of the Supabase plan in use.
- Netlify logs deployment and edge events.
- GitHub logs repository access, pushes, and administrative changes.
- Logs are reviewed in response to suspected incidents and on a periodic basis as part of the quarterly access review.

## 9. Exceptions

Exceptions to this policy must be documented, time-bound, and approved by the security owner. Each exception records the system involved, the rationale, the compensating controls in place, and an expiration date by which the exception must be re-evaluated or closed.

## 10. Policy review

This policy is reviewed at least annually and after any material change to systems, vendors, personnel, or the scope of data processed. Material changes are recorded in the change log below.

## Change log

- **2026-04-27 — v1.0** — Initial policy issued in connection with Plaid production-access onboarding.
