# Custom Email Sending Domain — Design Document

> **Status:** NOT STARTED

## Goal

Allow organizations to send document signature emails from their own domain (e.g., `notifications@acme.com`) instead of Seal's default sending address. This builds brand trust, improves email deliverability, and reduces the chance of signature request emails landing in spam.

## Current State

All transactional emails (document invitations, reminders, completion notifications) are sent via Resend from a single Seal-owned domain. There is no per-organization email customization beyond the sender name. Organizations cannot configure their own sending domain or DKIM records.

> **Key insight from competitor analysis**: Documenso uses raw AWS SES BYODKIM with self-managed RSA key generation and encrypted private key storage. **We do NOT need any of that complexity.** Resend's Domain API fully handles DKIM key generation, DNS record provisioning, and verification internally. We call Resend's API, display the DNS records to the user, and Resend handles everything else. Zero AWS SES involvement.

## Design

### User Flow

1. Admin navigates to **Settings > Email > Custom Sending Domain**
2. Enters their domain (e.g., `acme.com`) and clicks **"Add Domain"**
3. Seal calls the Resend "Create Domain" API, which returns a set of DNS records (DKIM, SPF, MX)
4. The UI displays a **DNS Records table** with columns: Type, Name, Value, Status (pending/verified)
5. Admin adds the DNS records to their domain registrar
6. Admin clicks **"Verify"** to trigger an on-demand check, or waits for the hourly cron to detect verification
7. Once all records are verified, the domain status changes to **Verified** and emails for that org start sending from `notifications@acme.com`
8. Admin can delete a domain, which reverts the org to the default Seal sending address

### Schema Changes

#### New Schema: `email_domains`

```
email_domains:
  organizationId: Id<"organizations">
  domain: string                          // e.g., "acme.com"
  status: "pending" | "verified" | "failed"
  resendDomainId: string                  // Resend API domain ID
  dnsRecords: array of objects:
    type: string                          // "TXT", "MX", "CNAME"
    name: string                          // DNS record name
    value: string                         // DNS record value
    status: "pending" | "verified"        // Per-record verification status
  verifiedAt: number?                     // Timestamp when fully verified
  createdBy: Id<"users">
  createdAt: number
  updatedAt: number

  Indexes: by_organization, by_domain, by_status
```

#### Modify: `organizations`

```typescript
// Add optional field
emailDomainId: v.optional(v.id("email_domains")); // Active verified domain for sending
```

### Backend Implementation

#### Resend API Integration

All calls go through Convex actions (external HTTP calls not allowed in queries/mutations).

- **`addEmailDomain`** (action) — calls `POST https://api.resend.com/domains` with `{ name: domain, region: "us-east-1" }`. Resend handles all DKIM key generation internally. Returns `resendDomainId` and DNS records (DKIM CNAME records, SPF TXT, MX for bounce handling). Stores in `email_domains` table with status `pending`.
- **`verifyEmailDomain`** (action) — calls `POST https://api.resend.com/domains/{id}/verify` to trigger Resend-side DNS check. Then calls `GET https://api.resend.com/domains/{id}` to read updated status and per-record verification. Updates `email_domains` record.
- **`removeEmailDomain`** (action) — calls `DELETE https://api.resend.com/domains/{id}`. Removes from `email_domains` table. Clears `emailDomainId` on the organization.
- **`getEmailDomain`** (query) — returns the org's email domain record with current status and DNS records.

> **No AWS SES, no key management, no encryption**: Resend owns the entire DKIM lifecycle. We never touch private keys. This is a massive simplification over the competitor's approach.

#### Verification Cron

A Convex cron job runs every hour:

1. Query all `email_domains` with status `pending`
2. For each, call `GET https://api.resend.com/domains/{resendDomainId}` to check verification status
3. If all DNS records verified, update status to `verified`, set `verifiedAt`
4. If domain has been pending for more than 7 days, update status to `failed` (admin can re-add)

#### Email Sending Resolution

Modify the existing email sending logic to resolve the "from" address:

```
// Pseudocode — in the email sending action
function resolveFromAddress(orgId):
  org = getOrg(orgId)
  if org.emailDomainId:
    domain = getEmailDomain(org.emailDomainId)
    if domain.status === "verified":
      return `notifications@${domain.domain}`
  return DEFAULT_SEAL_FROM_ADDRESS
```

This affects all email-sending actions: `sendDocumentEmailsInternal`, `sendReminderEmailDirect`, `sendCancellationEmails`, and team invitation emails.

#### Validation

- Domain format validation (must be a valid domain, not a subdomain of Seal's own domain). Subdomains like `mail.acme.com` are supported — Resend handles them natively, and many companies prefer subdomains to protect their root domain's reputation.
- Uniqueness check: no two orgs can register the same domain
- Max 1 domain per organization for v1 (simplifies the UX — one verified domain, one sending address)

### Frontend

#### Settings Page: `/{slug}/settings/email`

New section within the existing settings area (or a new settings tab if one doesn't exist for email):

- **No domain configured**: Show an empty state with "Add Custom Sending Domain" button
- **Domain pending**: Show DNS records table with copy-to-clipboard buttons for each value. Show a "Verify Now" button and a note about the hourly auto-check. Status badge: yellow "Pending"
- **Domain verified**: Show the domain with a green "Verified" checkmark, the date verified, and a "Remove Domain" button (with confirmation dialog)
- **Domain failed**: Show the domain with a red "Failed" badge, explanation text, and options to retry or remove

**DNS Records Table Columns:**
| Type | Name | Value | Status |
|------|------|-------|--------|

Each row has a copy button for the Value field.

### Permissions

- Requires `organization:admin` or `organization:owner` role — no new permissions needed
- Domain management is an admin-level settings operation

### Plan Gating

| Feature               | Free | Pro |
| --------------------- | ---- | --- |
| Custom sending domain | No   | Yes |

Free plan users see the setting grayed out with an upgrade prompt.

### What We Skip (v1)

- No custom "from name" configuration (always uses `notifications@domain`) — can be added later
- No custom reply-to address — replies still go to the Seal default or sender's email
- No per-document or per-template domain selection (org-wide only)
- No email template customization (logo, colors in email body) — separate feature
- No DMARC policy management — admin handles that on their own DNS
- No domain transfer between organizations

### Key Files to Modify/Create

| File                                                          | Action                                               |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/backend/convex/schemas/email_domains.ts`                | Create — new table schema                            |
| `apps/backend/convex/schema.ts`                               | Modify — register `email_domains` table              |
| `apps/backend/convex/email_domains/queries.ts`                | Create — `getEmailDomain`                            |
| `apps/backend/convex/email_domains/mutations.ts`              | Create — internal mutations for status updates       |
| `apps/backend/convex/email_domains/actions.ts`                | Create — Resend API calls (add, verify, remove)      |
| `apps/backend/convex/crons.ts`                                | Modify — add hourly domain verification cron         |
| `apps/backend/convex/documents/actions.ts`                    | Modify — `resolveFromAddress` logic in email sending |
| `apps/backend/convex/schemas/organizations.ts`                | Modify — add `emailDomainId` field                   |
| `apps/web/src/routes/_authenticated/$slug/settings/email.tsx` | Create — domain management UI                        |
| `apps/web/src/components/settings/dns-records-table.tsx`      | Create — DNS record display component                |
