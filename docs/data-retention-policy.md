# Able — Data Retention and Disposal Policy

**Version:** 1.0
**Effective date:** 2026-04-27
**Owner:** Paul Johnson, Founder (security@becomeable.app)
**Review cadence:** Reviewed at minimum annually, and any time there is a material change to systems, vendors, applicable law, or the scope of data processed. This policy is a companion to the Able Information Security Policy and the Able Privacy Policy.

---

## 1. Purpose and scope

This policy defines how long Able retains the data it collects, when that data is deleted, how deletion is performed so that it cannot be reconstructed, and how the schedule is reviewed for compliance with applicable law (including the Gramm-Leach-Bliley Act, the California Consumer Privacy Act / CPRA, and other state-level US privacy laws that apply to Able's customers).

It applies to all data Able processes, including data retrieved from Plaid on behalf of an end user.

## 2. Data categories and retention periods

| Category | Examples | Retention period |
| --- | --- | --- |
| **Highly sensitive — financial account data** | Plaid account identifiers, balances, transactions, item access tokens | Retained while the user has an active connection to the institution. Purged within 30 days of (a) the user disconnecting the institution, (b) the user deleting their account, or (c) the access token becoming invalid and not being re-authorized. |
| **Highly sensitive — authentication and payment** | Supabase Auth records, Stripe customer and subscription identifiers, payment tokens | Retained for the lifetime of the user's account. Authentication records are deleted within 30 days of account deletion. Payment records may be retained longer where required for tax, accounting, or anti-fraud obligations (typically up to 7 years), and only the minimum necessary fields are kept. |
| **Sensitive — user-entered budgeting data** | Bills, debts, categories, allocations, free-spending settings | Retained for the lifetime of the user's account. Deleted within 30 days of account deletion. |
| **Sensitive — profile and contact data** | Email address, display name, preferences | Retained for the lifetime of the user's account. Deleted within 30 days of account deletion, except where the email address must be retained on a suppression list to honor an unsubscribe or do-not-contact request, in which case the minimum necessary record is retained. |
| **Internal — operational logs** | Application logs, error events, edge logs | Retained for the supported retention window of the underlying platform (Supabase, Netlify) and not exported elsewhere. Personally identifying fields are minimized in logs wherever practical. |
| **Internal — backups** | Managed backups of Supabase Postgres | Overwritten on a rolling basis, typically within 30 days. Deletion of a record from production results in deletion from backups within the rolling backup window. |
| **Business records** | Contracts, vendor agreements, invoices, security and incident records | Retained for at least the duration required by applicable law and good business practice (typically 7 years for financial records and contracts; at least 1 year for security review records). |

## 3. Triggers for deletion

The following events trigger deletion of the corresponding data within the periods stated above:

- **User-initiated account deletion.** The user requests deletion via in-product controls or by contacting security@becomeable.app. The request is honored within 30 days.
- **User-initiated institution disconnect.** Plaid-derived data for that institution is purged within 30 days of disconnect.
- **Inactive accounts.** Accounts that have been inactive (no sign-in and no programmatic activity) for an extended period may be deleted after notice to the user; the schedule for inactivity-based deletion is reviewed annually.
- **Vendor change or service decommissioning.** Data held by a sub-processor that is no longer in use is migrated or deleted, and the sub-processor is required to confirm deletion in line with its contract.
- **Legal requirement.** Where applicable law requires earlier deletion (for example, a verifiable consumer deletion request under CCPA/CPRA), the legal requirement controls.

## 4. Deletion and disposal methods

- **Database records (Supabase Postgres):** Deleted via SQL `DELETE` against production tables under the security owner's account. Deletion cascades through related rows via foreign-key relationships and RLS-aware application logic so that no orphaned personal data remains.
- **Object storage:** Objects associated with a deleted user are deleted from Supabase Storage at the same time as the corresponding database rows.
- **Backups:** Backups inherit encryption from the underlying storage and are overwritten on a rolling basis, typically within 30 days. Able does not produce or retain offline backups outside the managed platforms.
- **Logs:** Operational logs age out under the supported retention window of the underlying platform. Logs are not exported to third-party long-term storage.
- **Endpoint copies:** Customer data is not stored on developer endpoints. Any incidental local copy created during incident response or debugging is deleted promptly and the endpoint is encrypted at rest (FileVault on macOS).
- **Paper records:** Able does not maintain paper records of customer data.

## 5. Holds and exceptions

- **Legal hold.** If Able receives a lawful request to preserve data (for example, a litigation hold or a regulatory request), affected data is preserved for the duration of the hold, and routine deletion is suspended for that data only.
- **Anti-fraud and security.** A minimum amount of data may be retained beyond the periods above where required to investigate, prevent, or respond to fraud, abuse, or security incidents, and only for as long as that purpose requires.
- **Documented exceptions.** All exceptions are documented (system, scope, rationale, expiration) and approved by the security owner.

## 6. User rights

Users may, at any time:

- Export the data Able holds about them.
- Request correction of inaccurate data.
- Request deletion of their account and associated data.
- Disconnect a linked financial institution, which triggers purge of the related Plaid-derived data.

Requests are honored within 30 days. Where applicable law (for example, CCPA/CPRA) provides a shorter window or additional rights, that law controls.

## 7. Vendor obligations

Sub-processors that store or process Able customer data are required, by contract, to:

- Delete or return customer data on termination of the agreement.
- Honor deletion requests propagated by Able within a reasonable period.
- Notify Able of any change to retention or deletion practices that materially affects this policy.

The current sub-processor list is maintained in the Able Information Security Policy (§12) and reviewed at least annually.

## 8. Verification and review

- The security owner reviews this retention schedule at least annually for continued compliance with applicable law and for alignment with actual practice.
- Periodic spot checks confirm that deletion has occurred for a sample of accounts that requested deletion.
- Findings and corrective actions are documented and retained.

## 9. Policy review

This policy is reviewed at least annually and after any material change to systems, vendors, applicable law, or the scope of data processed. Material changes are recorded in the change log below.

## Change log

- **2026-04-27 — v1.0** — Initial policy issued in connection with Plaid production-access onboarding.
