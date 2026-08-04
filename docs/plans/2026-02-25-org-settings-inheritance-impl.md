# Org Settings Inheritance — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add three new organization settings categories (Signing, Notifications, Security) following the existing `aiSettings`/`brandingSettings` pattern, plus a unified `getOrgSettings` query that aggregates all settings with defaults.

**Architecture:** The codebase already has `aiSettings` and `brandingSettings` as optional top-level objects on the `organizations` table, each with a defaults constant, `authQuery`, `internalQuery`, and `adminMutation`. We follow this exact pattern for three new categories. No migration of existing settings. Future team-level inheritance is handled by the null-means-inherit design documented in the design doc — not built in v1.

**Source design doc:** `docs/plans/2026-02-25-org-settings-inheritance-design.md`

---

## Critical Reference Files

| File                                                       | Why It Matters                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/backend/convex/schemas/organizations.ts`             | Add new settings validators + fields to `organizationsTable`                                      |
| `apps/backend/convex/organizations/queries.ts`             | Pattern: `AI_SETTINGS_DEFAULTS`, `getAiSettings` authQuery, `getAiSettingsInternal` internalQuery |
| `apps/backend/convex/organizations/mutations.ts`           | Pattern: `updateAiSettings` adminMutation with `args.field ?? current.field` merging              |
| `apps/web/src/routes/_authenticated/$slug/settings/ai.tsx` | Frontend pattern: `useQuery` → `useEffect` sync → `useState` form → `useMutation` submit          |
| `apps/web/src/components/app-sidebar.tsx:195-233`          | `settingsItems` array — add new nav entries here                                                  |

---

## Task 1: Schema — Add Signing, Notification, Security Settings Validators

**Files:**

- Modify: `apps/backend/convex/schemas/organizations.ts`

**What to do:**

Add three new validators and their types after `brandingSettingsValidator` (line 29), then add the fields to `organizationsTable`.

```typescript
// Add after line 29 (after brandingSettingsValidator)

export const signingSettingsValidator = v.object({
  defaultAuthMethod: v.literal("email"), // Only "email" for v1
  allowedSignatureTypes: v.array(
    v.union(v.literal("draw"), v.literal("type"), v.literal("upload"))
  ),
  esignConsentText: v.optional(v.string()), // null = use Seal default
  defaultDeadlineDays: v.number(), // Default 30
});
export type SigningSettings = Infer<typeof signingSettingsValidator>;

export const notificationSettingsValidator = v.object({
  reminderSchedule: v.array(v.number()), // Days after send, e.g., [3, 7, 14]
  expirationAlertDays: v.number(), // Days before expiry to alert, default 3
  sendCompletionEmail: v.boolean(), // Default true
  sendViewedNotification: v.boolean(), // Default true
});
export type NotificationSettings = Infer<typeof notificationSettingsValidator>;

export const securitySettingsValidator = v.object({
  requireMfa: v.boolean(), // Default false
  ipAllowlist: v.optional(v.array(v.string())), // CIDR ranges, null = no restriction
  sessionTimeoutMinutes: v.number(), // Default 480 (8 hours)
  allowApiAccess: v.boolean(), // Default true
});
export type SecuritySettings = Infer<typeof securitySettingsValidator>;
```

Add to `organizationsTable` (after `brandingSettings` field, before `updatedAt`):

```typescript
  // Signing defaults for documents
  signingSettings: v.optional(signingSettingsValidator),

  // Notification preferences
  notificationSettings: v.optional(notificationSettingsValidator),

  // Security policies
  securitySettings: v.optional(securitySettingsValidator),
```

**Verify:** Run `bun --bun run typecheck` from root. Convex schema should regenerate without errors.

**Commit:** `git add apps/backend/convex/schemas/organizations.ts && git commit -m "feat(schema): add signing, notification, security settings to organizations"`

---

## Task 2: Backend — Default Constants + Queries

**Files:**

- Modify: `apps/backend/convex/organizations/queries.ts`

**What to do:**

Add defaults and queries following the exact `AI_SETTINGS_DEFAULTS` / `getAiSettings` / `getAiSettingsInternal` pattern. Add after the branding section (after line 481).

```typescript
// ---------------------------------------------------------------------------
// Signing settings
// ---------------------------------------------------------------------------

const SIGNING_SETTINGS_DEFAULTS = {
  defaultAuthMethod: "email" as const,
  allowedSignatureTypes: ["draw", "type", "upload"] as const,
  esignConsentText: undefined,
  defaultDeadlineDays: 30,
} as const;

export const getSigningSettings = authQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.signingSettings ?? SIGNING_SETTINGS_DEFAULTS;
  },
});

export const getSigningSettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) return SIGNING_SETTINGS_DEFAULTS;
    return org.signingSettings ?? SIGNING_SETTINGS_DEFAULTS;
  },
});

// ---------------------------------------------------------------------------
// Notification settings
// ---------------------------------------------------------------------------

const NOTIFICATION_SETTINGS_DEFAULTS = {
  reminderSchedule: [3, 7, 14],
  expirationAlertDays: 3,
  sendCompletionEmail: true,
  sendViewedNotification: true,
} as const;

export const getNotificationSettings = authQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.notificationSettings ?? NOTIFICATION_SETTINGS_DEFAULTS;
  },
});

export const getNotificationSettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) return NOTIFICATION_SETTINGS_DEFAULTS;
    return org.notificationSettings ?? NOTIFICATION_SETTINGS_DEFAULTS;
  },
});

// ---------------------------------------------------------------------------
// Security settings
// ---------------------------------------------------------------------------

const SECURITY_SETTINGS_DEFAULTS = {
  requireMfa: false,
  ipAllowlist: undefined,
  sessionTimeoutMinutes: 480,
  allowApiAccess: true,
} as const;

export const getSecuritySettings = authQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.securitySettings ?? SECURITY_SETTINGS_DEFAULTS;
  },
});

export const getSecuritySettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) return SECURITY_SETTINGS_DEFAULTS;
    return org.securitySettings ?? SECURITY_SETTINGS_DEFAULTS;
  },
});

// ---------------------------------------------------------------------------
// Unified settings query — aggregates all settings with defaults
// ---------------------------------------------------------------------------

export const getOrgSettings = authQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return {
      ai: org.aiSettings ?? AI_SETTINGS_DEFAULTS,
      branding: org.brandingSettings ?? BRANDING_DEFAULTS,
      signing: org.signingSettings ?? SIGNING_SETTINGS_DEFAULTS,
      notifications: org.notificationSettings ?? NOTIFICATION_SETTINGS_DEFAULTS,
      security: org.securitySettings ?? SECURITY_SETTINGS_DEFAULTS,
    };
  },
});
```

**Verify:** `bun --bun run typecheck` from root. The new queries should appear in `_generated/api.ts`.

**Commit:** `git add apps/backend/convex/organizations/queries.ts && git commit -m "feat(backend): add signing, notification, security settings queries with defaults"`

---

## Task 3: Backend — Admin Mutations for New Settings

**Files:**

- Modify: `apps/backend/convex/organizations/mutations.ts`

**What to do:**

Add three new `adminMutation` functions after `updateBrandingSettings` (after line 944). Follow the exact pattern of `updateAiSettings` — partial args, merge with current using `??`.

```typescript
// ---------------------------------------------------------------------------
// Signing settings (admin-only)
// ---------------------------------------------------------------------------

export const updateSigningSettings = adminMutation({
  args: {
    allowedSignatureTypes: v.optional(
      v.array(
        v.union(v.literal("draw"), v.literal("type"), v.literal("upload"))
      )
    ),
    esignConsentText: v.optional(v.string()),
    defaultDeadlineDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(ctx.auth.organization._id);
    if (!org) throw new ConvexError("Organization not found");

    const current = org.signingSettings ?? {
      defaultAuthMethod: "email" as const,
      allowedSignatureTypes: [
        "draw" as const,
        "type" as const,
        "upload" as const,
      ],
      esignConsentText: undefined,
      defaultDeadlineDays: 30,
    };

    // Validate deadline days
    if (args.defaultDeadlineDays !== undefined) {
      if (args.defaultDeadlineDays < 1 || args.defaultDeadlineDays > 365) {
        throw new ConvexError("Deadline days must be between 1 and 365");
      }
    }

    // Validate at least one signature type
    if (
      args.allowedSignatureTypes !== undefined &&
      args.allowedSignatureTypes.length === 0
    ) {
      throw new ConvexError("At least one signature type must be allowed");
    }

    await ctx.db.patch(org._id, {
      signingSettings: {
        defaultAuthMethod: "email", // Hardcoded for v1
        allowedSignatureTypes:
          args.allowedSignatureTypes ?? current.allowedSignatureTypes,
        esignConsentText: args.esignConsentText ?? current.esignConsentText,
        defaultDeadlineDays:
          args.defaultDeadlineDays ?? current.defaultDeadlineDays,
      },
      updatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Notification settings (admin-only)
// ---------------------------------------------------------------------------

export const updateNotificationSettings = adminMutation({
  args: {
    reminderSchedule: v.optional(v.array(v.number())),
    expirationAlertDays: v.optional(v.number()),
    sendCompletionEmail: v.optional(v.boolean()),
    sendViewedNotification: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(ctx.auth.organization._id);
    if (!org) throw new ConvexError("Organization not found");

    const current = org.notificationSettings ?? {
      reminderSchedule: [3, 7, 14],
      expirationAlertDays: 3,
      sendCompletionEmail: true,
      sendViewedNotification: true,
    };

    // Validate reminder schedule
    if (args.reminderSchedule !== undefined) {
      if (args.reminderSchedule.length > 10) {
        throw new ConvexError(
          "Reminder schedule cannot have more than 10 entries"
        );
      }
      for (const day of args.reminderSchedule) {
        if (!Number.isInteger(day) || day < 1) {
          throw new ConvexError("Reminder days must be positive integers");
        }
      }
      // Ensure sorted ascending
      const sorted = [...args.reminderSchedule].sort((a, b) => a - b);
      if (JSON.stringify(sorted) !== JSON.stringify(args.reminderSchedule)) {
        throw new ConvexError("Reminder schedule must be in ascending order");
      }
    }

    // Validate expiration alert days
    if (args.expirationAlertDays !== undefined) {
      if (args.expirationAlertDays < 1 || args.expirationAlertDays > 30) {
        throw new ConvexError("Expiration alert days must be between 1 and 30");
      }
    }

    await ctx.db.patch(org._id, {
      notificationSettings: {
        reminderSchedule: args.reminderSchedule ?? current.reminderSchedule,
        expirationAlertDays:
          args.expirationAlertDays ?? current.expirationAlertDays,
        sendCompletionEmail:
          args.sendCompletionEmail ?? current.sendCompletionEmail,
        sendViewedNotification:
          args.sendViewedNotification ?? current.sendViewedNotification,
      },
      updatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Security settings (owner-only — higher impact)
// ---------------------------------------------------------------------------

export const updateSecuritySettings = ownerMutation({
  args: {
    requireMfa: v.optional(v.boolean()),
    ipAllowlist: v.optional(v.array(v.string())),
    sessionTimeoutMinutes: v.optional(v.number()),
    allowApiAccess: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(ctx.auth.organization._id);
    if (!org) throw new ConvexError("Organization not found");

    const current = org.securitySettings ?? {
      requireMfa: false,
      ipAllowlist: undefined,
      sessionTimeoutMinutes: 480,
      allowApiAccess: true,
    };

    // Validate IP allowlist entries (basic CIDR format check)
    if (args.ipAllowlist !== undefined) {
      for (const cidr of args.ipAllowlist) {
        if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/.test(cidr)) {
          throw new ConvexError(`Invalid CIDR format: ${cidr}`);
        }
      }
    }

    // Validate session timeout
    if (args.sessionTimeoutMinutes !== undefined) {
      if (
        args.sessionTimeoutMinutes < 15 ||
        args.sessionTimeoutMinutes > 1440
      ) {
        throw new ConvexError(
          "Session timeout must be between 15 minutes and 24 hours"
        );
      }
    }

    await ctx.db.patch(org._id, {
      securitySettings: {
        requireMfa: args.requireMfa ?? current.requireMfa,
        ipAllowlist: args.ipAllowlist ?? current.ipAllowlist,
        sessionTimeoutMinutes:
          args.sessionTimeoutMinutes ?? current.sessionTimeoutMinutes,
        allowApiAccess: args.allowApiAccess ?? current.allowApiAccess,
      },
      updatedAt: Date.now(),
    });
  },
});
```

**Note:** `updateSecuritySettings` uses `ownerMutation` (not `adminMutation`) because security settings are higher impact. Make sure `ownerMutation` is imported from `"../auth"` — check imports at top of file. The existing file already imports `adminMutation` from there, so just add `ownerMutation` to the import.

**Verify:** `bun --bun run typecheck` from root. The new mutations should appear in `_generated/api.ts`.

**Commit:** `git add apps/backend/convex/organizations/mutations.ts && git commit -m "feat(backend): add signing, notification, security settings mutations"`

---

## Task 4: Frontend — Signing Settings Page

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/settings/signing.tsx`
- Modify: `apps/web/src/components/app-sidebar.tsx`

**What to do:**

Create the signing settings page following the exact `ai.tsx` pattern. Add sidebar nav entry.

**Signing settings page** — copy `ai.tsx` structure, change to:

```typescript
/**
 * Signing Settings Page
 *
 * Organization signing defaults (admin-only mutations)
 * Route: /{slug}/settings/signing
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { PenTool, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/settings/signing")({
  component: SigningSettings,
  pendingComponent: FormSkeleton,
});

function SigningSettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, { slug });

  const signingSettings = useQuery(
    api.organizations.queries.getSigningSettings,
    organization ? { organizationId: organization._id } : "skip",
  );

  const updateSigningSettings = useMutation(
    api.organizations.mutations.updateSigningSettings,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    allowedSignatureTypes: ["draw", "type", "upload"] as string[],
    esignConsentText: "",
    defaultDeadlineDays: 30,
  });

  useEffect(() => {
    if (signingSettings) {
      setFormData({
        allowedSignatureTypes: [...signingSettings.allowedSignatureTypes],
        esignConsentText: signingSettings.esignConsentText ?? "",
        defaultDeadlineDays: signingSettings.defaultDeadlineDays,
      });
    }
  }, [signingSettings]);

  const handleSignatureTypeToggle = (type: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      allowedSignatureTypes: checked
        ? [...prev.allowedSignatureTypes, type]
        : prev.allowedSignatureTypes.filter((t) => t !== type),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.allowedSignatureTypes.length === 0) {
      toast.error("At least one signature type must be allowed");
      return;
    }

    if (formData.defaultDeadlineDays < 1 || formData.defaultDeadlineDays > 365) {
      toast.error("Deadline must be between 1 and 365 days");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateSigningSettings({
        allowedSignatureTypes: formData.allowedSignatureTypes as Array<
          "draw" | "type" | "upload"
        >,
        esignConsentText: formData.esignConsentText || undefined,
        defaultDeadlineDays: formData.defaultDeadlineDays,
      });
      toast.success("Signing settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update signing settings",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization || !signingSettings) {
    return null;
  }

  return (
    <PageWrapper title="Signing Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PenTool className="size-5" />
              <CardTitle>Signature Types</CardTitle>
            </div>
            <CardDescription>
              Choose which signature methods recipients can use when signing documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["draw", "type", "upload"] as const).map((type) => (
              <div key={type} className="flex items-center gap-3">
                <Checkbox
                  id={`sig-${type}`}
                  checked={formData.allowedSignatureTypes.includes(type)}
                  onCheckedChange={(checked) =>
                    handleSignatureTypeToggle(type, checked === true)
                  }
                />
                <Label htmlFor={`sig-${type}`} className="text-sm font-medium capitalize">
                  {type === "draw" ? "Draw signature" : type === "type" ? "Type signature" : "Upload signature image"}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default Deadline</CardTitle>
            <CardDescription>
              Default number of days recipients have to sign after a document is sent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                value={formData.defaultDeadlineDays}
                onChange={(e) =>
                  setFormData({ ...formData, defaultDeadlineDays: Number(e.target.value) })
                }
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">days</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>E-Sign Consent Text</CardTitle>
            <CardDescription>
              Custom text shown in the e-sign consent dialog. Leave blank to use the Seal
              default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.esignConsentText}
              onChange={(e) =>
                setFormData({ ...formData, esignConsentText: e.target.value })
              }
              placeholder="By signing this document electronically..."
              rows={4}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
```

**Sidebar nav** — add after the "Branding" entry (line 221 in `app-sidebar.tsx`):

```typescript
    {
      title: "Signing",
      url: buildOrganizationPath(slug, "/settings/signing"),
      visible: canView(permissionFlags?.canViewSettings),
    },
```

**Verify:** Start dev server (`bun --bun run start` from root), navigate to `/{slug}/settings/signing`. Page should render with defaults. Save should persist.

**Commit:** `git add apps/web/src/routes/_authenticated/\$slug/settings/signing.tsx apps/web/src/components/app-sidebar.tsx && git commit -m "feat(ui): add signing settings page"`

---

## Task 5: Frontend — Notifications Settings Page

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/settings/notifications.tsx`
- Modify: `apps/web/src/components/app-sidebar.tsx`

**What to do:**

Same pattern as Task 4. Key UI elements:

- Reminder schedule: list of day chips with add/remove. Input field + "Add" button. Each chip shows "Day N" with an X to remove.
- Expiration alert days: number input (1-30)
- Send completion email: Switch toggle
- Send viewed notification: Switch toggle

```typescript
/**
 * Notification Settings Page
 *
 * Organization notification preferences (admin-only mutations)
 * Route: /{slug}/settings/notifications
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Bell, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/settings/notifications")({
  component: NotificationSettings,
  pendingComponent: FormSkeleton,
});

function NotificationSettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, { slug });

  const notificationSettings = useQuery(
    api.organizations.queries.getNotificationSettings,
    organization ? { organizationId: organization._id } : "skip",
  );

  const updateNotificationSettings = useMutation(
    api.organizations.mutations.updateNotificationSettings,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newReminderDay, setNewReminderDay] = useState("");
  const [formData, setFormData] = useState({
    reminderSchedule: [3, 7, 14] as number[],
    expirationAlertDays: 3,
    sendCompletionEmail: true,
    sendViewedNotification: true,
  });

  useEffect(() => {
    if (notificationSettings) {
      setFormData({
        reminderSchedule: [...notificationSettings.reminderSchedule],
        expirationAlertDays: notificationSettings.expirationAlertDays,
        sendCompletionEmail: notificationSettings.sendCompletionEmail,
        sendViewedNotification: notificationSettings.sendViewedNotification,
      });
    }
  }, [notificationSettings]);

  const addReminderDay = () => {
    const day = Number.parseInt(newReminderDay, 10);
    if (Number.isNaN(day) || day < 1) {
      toast.error("Enter a positive number");
      return;
    }
    if (formData.reminderSchedule.includes(day)) {
      toast.error(`Day ${day} is already in the schedule`);
      return;
    }
    if (formData.reminderSchedule.length >= 10) {
      toast.error("Maximum 10 reminder days");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      reminderSchedule: [...prev.reminderSchedule, day].sort((a, b) => a - b),
    }));
    setNewReminderDay("");
  };

  const removeReminderDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      reminderSchedule: prev.reminderSchedule.filter((d) => d !== day),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateNotificationSettings({
        reminderSchedule: formData.reminderSchedule,
        expirationAlertDays: formData.expirationAlertDays,
        sendCompletionEmail: formData.sendCompletionEmail,
        sendViewedNotification: formData.sendViewedNotification,
      });
      toast.success("Notification settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update notification settings",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization || !notificationSettings) {
    return null;
  }

  return (
    <PageWrapper title="Notification Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="size-5" />
              <CardTitle>Reminder Schedule</CardTitle>
            </div>
            <CardDescription>
              Send automatic reminders to recipients who haven't signed. Specify the number
              of days after the document is sent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {formData.reminderSchedule.map((day) => (
                <Badge key={day} variant="secondary" className="gap-1 px-3 py-1.5">
                  Day {day}
                  <button
                    type="button"
                    onClick={() => removeReminderDay(day)}
                    className="ml-1 hover:text-destructive"
                    aria-label={`Remove day ${day}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              {formData.reminderSchedule.length === 0 && (
                <p className="text-muted-foreground text-sm">No reminders configured</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Add day..."
                value={newReminderDay}
                onChange={(e) => setNewReminderDay(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReminderDay();
                  }
                }}
                className="w-32"
              />
              <Button type="button" variant="outline" size="sm" onClick={addReminderDay}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiration Alert</CardTitle>
            <CardDescription>
              Notify the sender this many days before a document expires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={30}
                value={formData.expirationAlertDays}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    expirationAlertDays: Number(e.target.value),
                  })
                }
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">days before expiry</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Control which automatic emails are sent for document events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="completion-email" className="text-sm font-medium">
                  Send completion email
                </Label>
                <p className="text-muted-foreground text-xs">
                  Notify the sender when all recipients have signed.
                </p>
              </div>
              <Switch
                id="completion-email"
                checked={formData.sendCompletionEmail}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, sendCompletionEmail: checked })
                }
              />
            </div>
            <div className="border-t pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="viewed-notification" className="text-sm font-medium">
                    Send viewed notification
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Notify the sender when a recipient views the document.
                  </p>
                </div>
                <Switch
                  id="viewed-notification"
                  checked={formData.sendViewedNotification}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, sendViewedNotification: checked })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
```

**Sidebar nav** — add after "Signing" entry:

```typescript
    {
      title: "Notifications",
      url: buildOrganizationPath(slug, "/settings/notifications"),
      visible: canView(permissionFlags?.canViewSettings),
    },
```

**Verify:** Navigate to `/{slug}/settings/notifications`. Add/remove reminder days. Toggle switches. Save.

**Commit:** `git add apps/web/src/routes/_authenticated/\$slug/settings/notifications.tsx apps/web/src/components/app-sidebar.tsx && git commit -m "feat(ui): add notification settings page"`

---

## Task 6: Frontend — Security Settings Page

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/settings/security.tsx`
- Modify: `apps/web/src/components/app-sidebar.tsx`

**What to do:**

Same pattern. Key UI differences:

- This page should show a warning that changes are owner-only
- MFA toggle, API access toggle
- IP allowlist: textarea (one CIDR per line)
- Session timeout: dropdown with preset values (15min, 30min, 1hr, 4hr, 8hr, 24hr)

```typescript
/**
 * Security Settings Page
 *
 * Organization security policies (owner-only mutations)
 * Route: /{slug}/settings/security
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Save, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/settings/security")({
  component: SecuritySettings,
  pendingComponent: FormSkeleton,
});

const SESSION_TIMEOUT_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "480", label: "8 hours" },
  { value: "1440", label: "24 hours" },
];

function SecuritySettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, { slug });

  const securitySettings = useQuery(
    api.organizations.queries.getSecuritySettings,
    organization ? { organizationId: organization._id } : "skip",
  );

  const updateSecuritySettings = useMutation(
    api.organizations.mutations.updateSecuritySettings,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    requireMfa: false,
    ipAllowlistText: "",
    sessionTimeoutMinutes: 480,
    allowApiAccess: true,
  });

  useEffect(() => {
    if (securitySettings) {
      setFormData({
        requireMfa: securitySettings.requireMfa,
        ipAllowlistText: securitySettings.ipAllowlist?.join("\n") ?? "",
        sessionTimeoutMinutes: securitySettings.sessionTimeoutMinutes,
        allowApiAccess: securitySettings.allowApiAccess,
      });
    }
  }, [securitySettings]);

  const isOwner = organization?.userRole === "owner";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const ipAllowlist = formData.ipAllowlistText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      await updateSecuritySettings({
        requireMfa: formData.requireMfa,
        ipAllowlist: ipAllowlist.length > 0 ? ipAllowlist : undefined,
        sessionTimeoutMinutes: formData.sessionTimeoutMinutes,
        allowApiAccess: formData.allowApiAccess,
      });
      toast.success("Security settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update security settings",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization || !securitySettings) {
    return null;
  }

  return (
    <PageWrapper title="Security Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        {!isOwner && (
          <Card className="border-amber-200 bg-amber-50 md:col-span-2 dark:border-amber-900 dark:bg-amber-950">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Security settings can only be modified by organization owners. Contact your
                organization owner to make changes.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="size-5" />
              <CardTitle>Access Controls</CardTitle>
            </div>
            <CardDescription>
              Configure authentication and access policies for your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="require-mfa" className="text-sm font-medium">
                  Require multi-factor authentication
                </Label>
                <p className="text-muted-foreground text-xs">
                  All organization members must have MFA enabled to access the workspace.
                </p>
              </div>
              <Switch
                id="require-mfa"
                checked={formData.requireMfa}
                disabled={!isOwner}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requireMfa: checked })
                }
              />
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="allow-api" className="text-sm font-medium">
                    Allow API access
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Enable programmatic access via API keys. Disabling revokes all existing
                    API key access.
                  </p>
                </div>
                <Switch
                  id="allow-api"
                  checked={formData.allowApiAccess}
                  disabled={!isOwner}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allowApiAccess: checked })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Timeout</CardTitle>
            <CardDescription>
              Automatically sign out inactive users after this period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={String(formData.sessionTimeoutMinutes)}
              disabled={!isOwner}
              onValueChange={(value) =>
                setFormData({ ...formData, sessionTimeoutMinutes: Number(value) })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TIMEOUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>IP Allowlist</CardTitle>
            <CardDescription>
              Restrict workspace access to specific IP addresses or CIDR ranges. Leave empty
              for no restriction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.ipAllowlistText}
              disabled={!isOwner}
              onChange={(e) =>
                setFormData({ ...formData, ipAllowlistText: e.target.value })
              }
              placeholder={"192.168.1.0/24\n10.0.0.0/8"}
              rows={4}
            />
            <p className="text-muted-foreground mt-2 text-xs">One CIDR range per line</p>
          </CardContent>
        </Card>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting || !isOwner}>
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
```

**Sidebar nav** — add after "Notifications" entry:

```typescript
    {
      title: "Security",
      url: buildOrganizationPath(slug, "/settings/security"),
      visible: canView(permissionFlags?.canViewSettings),
    },
```

**Verify:** Navigate to `/{slug}/settings/security`. Owner should see editable form. Non-owner should see warning + disabled controls.

**Commit:** `git add apps/web/src/routes/_authenticated/\$slug/settings/security.tsx apps/web/src/components/app-sidebar.tsx && git commit -m "feat(ui): add security settings page (owner-only)"`

---

## Task 7: Verification + Static Analysis

**What to do:**

1. Run full static analysis: `bun --bun run verify`
2. Fix any lint/format/type errors
3. Verify all settings pages load and save correctly via the dev server
4. Verify the unified `getOrgSettings` query returns all categories

**Commit:** Fix any issues found, then: `git commit -m "chore: fix lint/type issues in org settings"`

---

## Summary

| Task | What                              | Files                                           |
| ---- | --------------------------------- | ----------------------------------------------- |
| 1    | Schema validators + fields        | `schemas/organizations.ts`                      |
| 2    | Default constants + queries       | `organizations/queries.ts`                      |
| 3    | Admin/owner mutations             | `organizations/mutations.ts`                    |
| 4    | Signing settings page + nav       | `settings/signing.tsx`, `app-sidebar.tsx`       |
| 5    | Notifications settings page + nav | `settings/notifications.tsx`, `app-sidebar.tsx` |
| 6    | Security settings page + nav      | `settings/security.tsx`, `app-sidebar.tsx`      |
| 7    | Static analysis + verification    | All files                                       |
