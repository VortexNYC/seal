# User Security Audit Logs — Design Document

> **Status:** NOT STARTED

## Goal

Add a user-facing security audit log that tracks account-level and organization-level security events — logins, password changes, API key management, member changes, and other sensitive actions. This is distinct from the existing document audit trail (which tracks per-document actions for compliance). The security audit log gives organization admins visibility into who did what across their workspace for security monitoring and incident investigation.

## Current State

Seal has an `audit_logs` table that tracks document-level actions (created, sent, signed, etc.) for legal compliance. This table is scoped to documents and is used for the certificate of completion and per-document audit trail. However, there is no user-facing page to view account security events like logins, API key creation, member role changes, or data exports. Clerk handles authentication events (login, logout, password changes) via webhooks, but these are not stored or surfaced to users. The existing `audit_logs` schema already has `user.login` and `user.logout` action types defined but they are not populated.

## Design

### User Flow

1. Admin navigates to **Settings → Security → Audit Log** in their workspace
2. They see a paginated table of security events with columns:
   - **Date** — timestamp of the event
   - **User** — who performed the action (name + avatar)
   - **Action** — human-readable label (e.g., "Signed in," "Created API key," "Changed member role")
   - **IP Address** — source IP (when available)
   - **Details** — expandable row with additional metadata (user agent, affected resource, etc.)
3. Filters:
   - **Date range** picker (default: last 30 days)
   - **Action type** dropdown (multi-select)
   - **User** dropdown (filter by specific team member)
4. "Export CSV" button to download filtered results

### Schema Changes

#### New Schema: `user_security_audit_logs`

We create a separate table rather than overloading the existing `audit_logs` table. The existing table is optimized for document compliance (immutable, per-document, used in certificates). Security audit logs have different retention policies, query patterns, and access controls.

```
user_security_audit_logs:
  organizationId: v.id("organizations")
  userId: v.optional(v.string())                // Clerk user ID of the actor
  userName: v.optional(v.string())               // Denormalized for display without joins
  userEmail: v.optional(v.string())              // Denormalized for display
  action: securityAuditActionTuple               // See enum below
  ipAddress: v.optional(v.string())              // Source IP address
  userAgent: v.optional(v.string())              // Browser/device string
  metadata: v.optional(v.object({
    targetUserId: v.optional(v.string()),         // Affected user (for member actions)
    targetUserEmail: v.optional(v.string()),
    resourceId: v.optional(v.string()),           // Affected resource ID
    resourceType: v.optional(v.string()),         // "api_key" | "member" | "document" etc.
    oldValue: v.optional(v.string()),             // Previous state (e.g., old role)
    newValue: v.optional(v.string()),             // New state (e.g., new role)
    description: v.optional(v.string()),          // Human-readable detail
  }))
  createdAt: v.number()

  Indexes:
    by_organization_created: ["organizationId", "createdAt"]
    by_organization_action: ["organizationId", "action"]
    by_user: ["userId"]
```

#### Security Audit Action Enum

```typescript
export const securityAuditActionTuple = v.union(
  // Authentication (populated from Clerk webhooks)
  v.literal("user.signed_in"),
  v.literal("user.signed_out"),
  v.literal("user.password_changed"),
  v.literal("user.email_changed"),
  v.literal("user.two_factor_enabled"),
  v.literal("user.two_factor_disabled"),

  // API Keys (populated from in-app mutations)
  v.literal("api_key.created"),
  v.literal("api_key.revoked"),

  // Organization Members
  v.literal("member.invited"),
  v.literal("member.removed"),
  v.literal("member.role_changed"),

  // Documents (high-impact actions only)
  v.literal("document.deleted"),
  v.literal("document.bulk_deleted"),

  // Data & Privacy
  v.literal("data.exported"),

  // Organization Settings
  v.literal("settings.updated"),
);
```

### Backend Implementation

#### Clerk Webhook Extension

The existing Clerk webhook handler (`apps/backend/convex/webhooks.ts`) already processes `user.created`, `user.updated`, and session events. Extend it to log security events:

- **`session.created`** → log `user.signed_in`. **Note**: Clerk webhook payloads do NOT include the client's IP address (they come from Clerk's servers). IP address will be `null` for Clerk-sourced events. Client IP is only available for in-app actions where Seal's HTTP handler receives the request directly.
- **`session.ended` / `session.removed`** → log `user.signed_out`
- **`user.updated`** → inspect changed fields:
  - If `password_enabled` changed → log `user.password_changed`
  - If `primary_email_address_id` changed → log `user.email_changed`
  - If `two_factor_enabled` changed → log `user.two_factor_enabled` or `user.two_factor_disabled`

#### In-App Mutation Logging

For actions that happen inside Seal (not via Clerk webhooks), add a `logSecurityEvent` helper and call it within existing mutations:

```typescript
// Helper function
async function logSecurityEvent(
  ctx,
  { organizationId, userId, userName, userEmail, action, ipAddress, userAgent, metadata },
);
```

Mutations to instrument:

- `createApiKey` → log `api_key.created` with key prefix in metadata
- `revokeApiKey` → log `api_key.revoked` with key prefix
- `inviteOrganizationMember` → log `member.invited` with target email
- `removeOrganizationMember` → log `member.removed` with target user
- `changeOrganizationMemberRole` → log `member.role_changed` with old/new role
- `deleteDocument` / bulk delete → log `document.deleted` or `document.bulk_deleted`
- `exportData` → log `data.exported`
- `updateOrganizationSettings` → log `settings.updated`

#### Queries

- **`listSecurityAuditLogs`** — Paginated query with filters for date range, action type, and userId. Returns newest first. Uses `by_organization_created` index for efficient pagination. Requires admin or owner role.
- **`exportSecurityAuditLogs`** — Action that generates a CSV of filtered logs and returns a storage URL for download.

#### Retention

- **Free plan**: Logs are retained for 90 days. A scheduled cron job runs daily and deletes logs older than 90 days for free-tier organizations.
- **Pro plan**: Unlimited retention (no automatic deletion).

The retention cron:

```
// In crons.ts
crons.daily("cleanupSecurityAuditLogs", { hourUTC: 3 }, internal.security_audit.cleanupExpiredLogs)
```

### Frontend

#### New Route: `/{slug}/settings/security/audit-log`

Nested under the existing settings layout. Accessible from the Settings sidebar under "Security" section.

#### Audit Log Table Component

- Paginated table using Convex paginated queries
- Columns: Date (relative + absolute on hover), User (avatar + name), Action (badge with color coding), IP Address, Details (expand icon)
- Expandable row detail: shows user agent (parsed with `ua-parser-js` into OS + Browser), full metadata object
- Color-coded action badges:
  - Green: sign-in, two-factor enabled
  - Red: sign-out, member removed, document deleted, two-factor disabled
  - Blue: API key created, member invited, settings updated
  - Gray: other

#### Filters Bar

- Date range: preset buttons (Today, 7 days, 30 days, 90 days) + custom date picker
- Action type: multi-select dropdown with all action types
- User: searchable user dropdown (org members only)
- "Export CSV" button (triggers the export action)

#### Empty State

- If no logs exist yet: "No security events recorded yet. Events like sign-ins, API key changes, and member management will appear here."
- If Pro feature and user is on Free: upgrade prompt explaining audit log retention limits

### Permissions

- **View audit logs**: Admin and Owner roles only (uses `adminQuery` wrapper)
- **Export audit logs**: Admin and Owner roles only
- No new permission entries needed — leverages existing admin/owner role checks

### Plan Gating

| Feature                  | Free                         | Pro       |
| ------------------------ | ---------------------------- | --------- |
| View security audit logs | No (upgrade prompt)          | Yes       |
| Log retention            | 90 days (background cleanup) | Unlimited |
| Export CSV               | No                           | Yes       |

### What We Skip (v1)

- No real-time alerts or notifications for suspicious activity (e.g., login from new country)
- No geolocation lookup for IP addresses (just raw IP display)
- No aggregated analytics (e.g., "logins per day" chart)
- No SIEM integration or log forwarding (Splunk, Datadog, etc.)
- No per-user security page (only org-wide audit log)
- No webhook/API access to security audit logs
- No log search (text search across metadata) — filter by action type and user only
- No SSO/SAML event logging (Seal does not support SSO yet)

### Key Files to Modify/Create

| File                                                                       | Action                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| `apps/backend/convex/schemas/user_security_audit_logs.ts`                  | Create — new table schema                                |
| `apps/backend/convex/schema.ts`                                            | Modify — register new table                              |
| `apps/backend/convex/security_audit/mutations.ts`                          | Create — `logSecurityEvent` helper                       |
| `apps/backend/convex/security_audit/queries.ts`                            | Create — `listSecurityAuditLogs` paginated query         |
| `apps/backend/convex/security_audit/actions.ts`                            | Create — CSV export action                               |
| `apps/backend/convex/webhooks.ts`                                          | Modify — extend Clerk webhook handler to log auth events |
| `apps/backend/convex/crons.ts`                                             | Modify — add retention cleanup cron                      |
| `apps/backend/convex/api_keys/mutations.ts`                                | Modify — add security audit logging                      |
| `apps/backend/convex/organizations/mutations.ts`                           | Modify — add security audit logging for member actions   |
| `apps/web/src/routes/_authenticated/$slug/settings/security.audit-log.tsx` | Create — audit log page                                  |
| `apps/web/src/components/settings/security-audit-table.tsx`                | Create — table component with filters                    |
| `apps/web/src/components/settings/security-audit-filters.tsx`              | Create — filter bar component                            |
