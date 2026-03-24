# Organization Settings Inheritance — Design Document

> **Status:** NOT STARTED

## Goal

Consolidate scattered organization configuration into a structured, extensible settings system. Design the schema so that team-level overrides can be layered on top later (when Seal adds a teams concept) using a nullable-fields inheritance pattern. Settings should be grouped by category and managed from a unified settings UI.

## Current State

Organization settings are ad-hoc: a few fields on the `organizations` table (name, slug, plan) and some proposed additions in other design docs (e.g., `securitySettings` in the recipient auth design). There is no structured settings object, no inheritance pattern, and no clear strategy for how team-level overrides would work if teams are added in the future. Settings-related UI is split across multiple pages with no consistent structure.

## Design

### Settings Categories

Four groups, each treated as a cohesive unit:

| Category          | Fields                                                                                     | Description                                         |
| ----------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| **Branding**      | `logoStorageId`, `brandColor`, `companyName`, `companyWebsite`                             | Visual identity applied to emails and signing pages |
| **Signing**       | `defaultAuthMethod`, `allowedSignatureTypes`, `esignConsentText`, `defaultDeadlineDays`    | Default document signing behavior                   |
| **Notifications** | `reminderSchedule`, `expirationAlertDays`, `sendCompletionEmail`, `sendViewedNotification` | Email notification preferences                      |
| **Security**      | `requireMfa`, `ipAllowlist`, `sessionTimeoutMinutes`, `allowApiAccess`                     | Access control and security policies                |

### Inheritance Model

The core pattern: **org settings provide defaults, team settings override selectively**.

- **Organization level**: Every field is **required** with a sensible default. This is the source of truth.
- **Team level** (future): Every field is **optional/nullable**. A null value means "inherit from org." A non-null value means "override."
- **Resolution function**: `resolveSettings(orgSettings, teamSettings?)` spreads org settings first, then overwrites with any non-null team values.

```typescript
// Pseudocode
function resolveSettings(
  orgSettings: OrgSettings,
  teamSettings?: Partial<OrgSettings>,
): OrgSettings {
  if (!teamSettings) return orgSettings;

  const resolved = { ...orgSettings };
  for (const [key, value] of Object.entries(teamSettings)) {
    if (value !== null && value !== undefined) {
      resolved[key] = value;
    }
  }
  return resolved;
}
```

**Group inheritance** for branding: branding fields can be overridden individually at the team level. Teams commonly want to override just the company name while keeping the org's logo and colors. Atomic override was considered but rejected as too restrictive — partial branding overrides are a valid use case.

### Schema Changes

#### Modify: `organizations`

```typescript
// Add structured settings object
settings: v.optional(
  v.object({
    branding: v.object({
      logoStorageId: v.optional(v.id("_storage")), // null = no logo
      brandColor: v.string(), // Hex color, default "#000000"
      companyName: v.string(), // Display name
      companyWebsite: v.optional(v.string()), // URL
    }),
    signing: v.object({
      defaultAuthMethod: v.literal("email"), // Only "email" for v1. SMS and ID verification are future features — do NOT add them to the schema until they are implemented.
      allowedSignatureTypes: v.array(
        v.union(v.literal("draw"), v.literal("type"), v.literal("upload")),
      ), // Default ["draw", "type", "upload"]
      esignConsentText: v.optional(v.string()), // Custom consent text, null = Seal default
      defaultDeadlineDays: v.number(), // Default 30
    }),
    notifications: v.object({
      reminderSchedule: v.array(v.number()), // Days after send to remind, e.g., [3, 7, 14]
      expirationAlertDays: v.number(), // Days before expiry to alert, default 3
      sendCompletionEmail: v.boolean(), // Default true
      sendViewedNotification: v.boolean(), // Default true
    }),
    security: v.object({
      requireMfa: v.boolean(), // Default false
      ipAllowlist: v.optional(v.array(v.string())), // CIDR ranges, null = no restriction
      sessionTimeoutMinutes: v.number(), // Default 480 (8 hours)
      allowApiAccess: v.boolean(), // Default true
    }),
  }),
);
```

#### New Schema (future): `teams`

Not implemented in v1, but the pattern is documented here for reference:

```
teams:
  organizationId: Id<"organizations">
  name: string
  slug: string
  settings: v.optional(v.object({
    // Same shape as org settings, but every leaf field is v.optional()
    // null/undefined = inherit from org
    branding: v.optional(v.object({
      logoStorageId: v.optional(v.id("_storage")),
      brandColor: v.optional(v.string()),
      companyName: v.optional(v.string()),
      companyWebsite: v.optional(v.string()),
    })),
    // ... same pattern for signing, notifications, security
  }))
```

### Backend Implementation

#### Default Settings Factory

```typescript
// helpers/settings.ts
const DEFAULT_SETTINGS: OrgSettings = {
  branding: {
    logoStorageId: undefined,
    brandColor: "#000000",
    companyName: "", // Set from org name on creation
    companyWebsite: undefined,
  },
  signing: {
    defaultAuthMethod: "email",
    allowedSignatureTypes: ["draw", "type", "upload"],
    esignConsentText: undefined,
    defaultDeadlineDays: 30,
  },
  notifications: {
    reminderSchedule: [3, 7, 14],
    expirationAlertDays: 3,
    sendCompletionEmail: true,
    sendViewedNotification: true,
  },
  security: {
    requireMfa: false,
    ipAllowlist: undefined,
    sessionTimeoutMinutes: 480,
    allowApiAccess: true,
  },
};
```

#### Mutations

- **`updateOrgSettings`** (mutation) — accepts a partial settings object, deep-merges with existing settings. Validates each field (e.g., `brandColor` must be valid hex, `reminderSchedule` must be an array of positive integers sorted ascending with max 10 entries, `ipAllowlist` entries must be valid CIDR).
- **`resetOrgSettings`** (mutation) — resets a specific category to defaults (e.g., "Reset branding to defaults").

#### Queries

- **`getOrgSettings`** (query) — returns the resolved settings for the current org. If `settings` is null/undefined on the org record, returns `DEFAULT_SETTINGS` with `companyName` filled from the org name. Every consumer of settings should call this query rather than reading `org.settings` directly — this ensures the fallback logic is centralized.
- **`getResolvedSettings`** (query, future) — accepts optional `teamId`, resolves inheritance chain.

#### Settings Consumption

Other backend code that currently hardcodes values (e.g., reminder schedules, default deadlines) should read from `getOrgSettings` instead. This is a gradual migration — each feature can adopt the settings as it's touched.

### Frontend

#### Settings Page: `/{slug}/settings/`

Restructure the settings area into tabbed sections:

- **General** (existing) — org name, slug, members
- **Branding** (new) — logo upload, brand color picker, company name, website URL
- **Signing** (new) — default auth method dropdown, signature type checkboxes, consent text textarea, deadline days input
- **Notifications** (new) — reminder schedule builder (add/remove day chips), toggle switches for completion and viewed emails, expiration alert days input
- **Security** (new) — MFA toggle, IP allowlist textarea (one CIDR per line), session timeout dropdown, API access toggle

Each setting shows its current value. Future: when teams exist, inherited values show an "Organization default" badge with an "Override" button.

#### Settings Form Pattern

Each category is a separate form with independent save/reset buttons. This prevents accidental changes to unrelated settings and keeps the save scope clear.

```
// Each category section:
[Category Title]
[Field 1] [Field 2] ...
[Reset to Defaults] [Save Changes]
```

### Permissions

- **Branding, Notifications**: `organization:admin` or `organization:owner`
- **Signing, Security**: `organization:owner` only (higher impact changes)
- No new permission types — uses existing role checks

### Plan Gating

| Setting Category             | Free                          | Pro  |
| ---------------------------- | ----------------------------- | ---- |
| Branding (logo, color)       | No                            | Yes  |
| Signing defaults             | Basic (auth method only)      | Full |
| Notifications                | Basic (completion email only) | Full |
| Security (MFA, IP allowlist) | No                            | Yes  |

Free plan users see gated settings with upgrade prompts. Basic settings that affect all plans (like default deadline days) are available to everyone.

### What We Skip (v1)

- No team-level settings (teams don't exist yet) — schema is designed for it but implementation is org-only
- No per-document settings override (documents use org defaults, sender can change per-document in the editor)
- No settings audit log (who changed what when) — can be added via the existing audit_logs system later
- No settings import/export
- No settings templates ("Apply Enterprise Security preset")
- No webhook notifications when settings change
- No custom email templates (separate feature from branding)

### Key Files to Modify/Create

| File                                                                  | Action                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/backend/convex/schemas/organizations.ts`                        | Modify — add `settings` object                             |
| `apps/backend/convex/organizations/settings_mutations.ts`             | Create — `updateOrgSettings`, `resetOrgSettings`           |
| `apps/backend/convex/organizations/settings_queries.ts`               | Create — `getOrgSettings`, `getResolvedSettings`           |
| `apps/backend/convex/organizations/helpers/settings.ts`               | Create — `DEFAULT_SETTINGS`, `resolveSettings`, validators |
| `apps/backend/convex/validations/settings.ts`                         | Create — Zod schemas for settings validation               |
| `apps/web/src/routes/_authenticated/$slug/settings/branding.tsx`      | Create — branding settings UI                              |
| `apps/web/src/routes/_authenticated/$slug/settings/signing.tsx`       | Create — signing defaults UI                               |
| `apps/web/src/routes/_authenticated/$slug/settings/notifications.tsx` | Create — notification preferences UI                       |
| `apps/web/src/routes/_authenticated/$slug/settings/security.tsx`      | Create or modify — security settings UI                    |
| `apps/web/src/components/settings/settings-form.tsx`                  | Create — reusable settings form wrapper                    |
