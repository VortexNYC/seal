/**
 * Organization/Workspace queries
 *
 * Provides read access to organization data, members, and invitations
 */

import { ConvexError, v } from "convex/values";

import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { authQuery } from "../auth";
import { DOCUMENT_SIGNING_PERMISSIONS, hasPermission } from "../auth.utils";
import {
  getComponentMemberById,
  listComponentMembersByOrganization,
  resolveComponentMembershipForOrganization,
} from "../lib/componentOrgReads";
import {
  loadEffectiveBrandingSettings,
  loadSuiteOrgBrandAndSecurity,
} from "../lib/suiteOrgPolicy";
import type { OrganizationMemberRole } from "../schema";

const roleOrder: Record<OrganizationMemberRole, number> = {
  owner: 0,
  admin: 1,
  member: 2,
  viewer: 3,
  system: 4,
};

type OrganizationQueryCtx = {
  db: QueryCtx["db"];
  auth: {
    user: Doc<"users">;
  };
  runQuery: QueryCtx["runQuery"];
};

async function requireComponentMembership(
  ctx: OrganizationQueryCtx,
  organizationId: Id<"organizations">
) {
  const organization = await ctx.db.get("organizations", organizationId);
  if (!organization) {
    throw new ConvexError("Organization not found");
  }
  const membership = await resolveComponentMembershipForOrganization(
    ctx,
    ctx.auth.user,
    organization
  );
  if (!membership) {
    throw new ConvexError("No access to this organization");
  }
  return { organization, membership };
}

/**
 * Get current organization details by slug
 */
export const getOrganization = authQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!org) {
      throw new ConvexError("Organization not found");
    }

    const membership = await resolveComponentMembershipForOrganization(
      ctx,
      ctx.auth.user,
      org
    );
    if (!membership) {
      throw new ConvexError("No access to this organization");
    }

    const suitePolicy = await loadSuiteOrgBrandAndSecurity(ctx, org);

    return {
      ...org,
      userRole: membership.role,
      userStatus: membership.status,
      suiteBrand: suitePolicy.brand,
      suiteSecurity: suitePolicy.security,
    };
  },
});

/**
 * Get all members of an organization with user details
 */
export const getOrganizationMembers = authQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireComponentMembership(
      ctx,
      args.organizationId
    );
    const members = await listComponentMembersByOrganization(ctx, organization);

    // Fetch user details for each member
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        if (!member.userId) {
          return null;
        }
        const user = await ctx.db.get("users", member.userId);
        if (!user) {
          return null;
        }

        return {
          id: member.memberId,
          userId: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar,
          role: member.role,
          status: member.status,
          isPrimary: user.activeOrganizationId === args.organizationId,
          joinedAt: member.createdAt,
          permissions: [],
        };
      })
    );

    // Filter out null values and sort by role hierarchy (owner first, then admin, etc.)
    return membersWithDetails
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .toSorted((a, b) => {
        const roleCompare = roleOrder[a.role] - roleOrder[b.role];
        if (roleCompare !== 0) return roleCompare;
        // If same role, sort by join date
        return a.joinedAt - b.joinedAt;
      });
  },
});

/**
 * Get user's permissions for the current organization
 */
export const getUserPermissions = authQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const { membership } = await requireComponentMembership(
      ctx,
      args.organizationId
    );

    // Return detailed permission information
    return {
      role: membership.role,
      status: membership.status,
      isPrimary: ctx.auth.organizationId === args.organizationId,
      permissions: {
        // Organization management
        canManageOrganization: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.ORG_MANAGE
        ),
        canViewSettings: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.ORG_SETTINGS_READ
        ),
        canUpdateSettings: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.ORG_SETTINGS_UPDATE
        ),

        // Member management
        canViewMembers: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_READ
        ),
        canInviteMembers: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_INVITE
        ),
        canRemoveMembers: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_REMOVE
        ),
        canUpdateRoles: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_UPDATE_ROLE
        ),

        // Subscription
        canManageBilling: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.SUBSCRIPTION_MANAGE
        ),
        canViewBilling: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.SUBSCRIPTION_BILLING_READ
        ),

        // Documents
        canCreateDocuments: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_CREATE
        ),
        canSendDocuments: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_SEND
        ),
        canDeleteDocuments: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_DELETE
        ),

        // Templates
        canCreateTemplates: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.TEMPLATES_CREATE
        ),
        canManageTemplates: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.TEMPLATES_UPDATE
        ),

        // API & Webhooks
        canManageAPIKeys: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.API_CREATE
        ),
        canManageWebhooks: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.WEBHOOKS_CREATE
        ),

        // Audit
        canViewAudit: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.AUDIT_READ
        ),

        // Contacts
        canViewContacts: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.CONTACTS_VIEW
        ),
        canCreateContacts: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.CONTACTS_CREATE
        ),
        canDeleteContacts: hasPermission(
          membership,
          DOCUMENT_SIGNING_PERMISSIONS.CONTACTS_DELETE
        ),
      },
    };
  },
});

/**
 * Get organization member count
 */
export const getOrganizationMemberCount = authQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireComponentMembership(
      ctx,
      args.organizationId
    );
    const members = await listComponentMembersByOrganization(ctx, organization);

    const activeMembers = members.filter((m) => m.status === "active");

    return {
      total: members.length,
      active: activeMembers.length,
      byRole: {
        owner: members.filter((m) => m.role === "owner").length,
        admin: members.filter((m) => m.role === "admin").length,
        member: members.filter((m) => m.role === "member").length,
        viewer: members.filter((m) => m.role === "viewer").length,
      },
      byStatus: {
        active: activeMembers.length,
        suspended: members.filter((m) => m.status === "suspended").length,
        pending: members.filter((m) => m.status === "pending").length,
      },
    };
  },
});

/**
 * Get details of a specific organization member
 */
export const getOrganizationMember = authQuery({
  args: {
    organizationId: v.id("organizations"),
    memberId: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireComponentMembership(
      ctx,
      args.organizationId
    );
    const member = await getComponentMemberById(ctx, args.memberId);
    if (!member) {
      throw new ConvexError("Member not found");
    }

    if (member.organizationId !== args.organizationId) {
      throw new ConvexError("Member not found in this organization");
    }
    if (!member.userId || !member.role) {
      throw new ConvexError("Member not found");
    }

    // Get user details
    const user = await ctx.db.get("users", member.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Get custom role if assigned
    let customRole: null | { id: string; name: string; permissions: string[] } =
      null;
    if (organization.betterAuthOrganizationId) {
      const role = await ctx.runQuery(
        components.betterAuthConsumer.organizations.getRole,
        {
          roleId: member.roleId,
          organizationId: organization.betterAuthOrganizationId,
        }
      );
      customRole = role
        ? {
            id: role._id,
            name: role.name,
            permissions: role.permissions,
          }
        : null;
    }

    return {
      id: member.memberId,
      userId: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar,
      role: member.role,
      customRole,
      status: member.status,
      isPrimary: user.activeOrganizationId === args.organizationId,
      joinedAt: member.createdAt,
      permissions: [],
      permissionOverrides: undefined,
      authSubject: user.authSubject,
      timezone: user.timezone,
    };
  },
});

// ---------------------------------------------------------------------------
// AI workspace settings
// ---------------------------------------------------------------------------

const AI_SETTINGS_DEFAULTS = {
  aiEnabled: true,
  aiAutoAnalyze: true,
  aiShowRedlinesToSigners: false,
} as const;

/**
 * Get AI settings for the current organization.
 * Returns sensible defaults when no settings have been saved.
 */
export const getAiSettings = authQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.aiSettings ?? AI_SETTINGS_DEFAULTS;
  },
});

/** Internal variant for use in pipeline actions. */
export const getAiSettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) return AI_SETTINGS_DEFAULTS;
    return org.aiSettings ?? AI_SETTINGS_DEFAULTS;
  },
});

// ---------------------------------------------------------------------------
// Branding settings
// ---------------------------------------------------------------------------

const BRANDING_DEFAULTS = {
  enabled: false,
  logoStorageId: undefined,
  logoUrl: undefined,
  brandColor: undefined,
  accentColor: undefined,
  emailFromName: undefined,
  emailReplyTo: undefined,
  hideSealBranding: false,
  customFooterText: undefined,
  companyName: undefined,
  companyWebsite: undefined,
} as const;

export const getBrandingSettings = authQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.brandingSettings ?? BRANDING_DEFAULTS;
  },
});

/** Internal variant for email-sending actions — Core brand + Seal chrome. */
export const getBrandingSettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) return BRANDING_DEFAULTS;
    return await loadEffectiveBrandingSettings(ctx, org);
  },
});

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
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.signingSettings ?? SIGNING_SETTINGS_DEFAULTS;
  },
});

export const getSigningSettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);
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
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.notificationSettings ?? NOTIFICATION_SETTINGS_DEFAULTS;
  },
});

export const getNotificationSettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) return NOTIFICATION_SETTINGS_DEFAULTS;
    return org.notificationSettings ?? NOTIFICATION_SETTINGS_DEFAULTS;
  },
});

// ---------------------------------------------------------------------------
// Security settings
// ---------------------------------------------------------------------------

const SECURITY_SETTINGS_DEFAULTS = {
  ipAllowlist: undefined,
  allowApiAccess: true,
  requireMfa: false,
  sessionTimeoutMinutes: undefined,
} as const;

export const getSecuritySettings = authQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.securitySettings ?? SECURITY_SETTINGS_DEFAULTS;
  },
});

export const getSecuritySettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) return SECURITY_SETTINGS_DEFAULTS;
    return org.securitySettings ?? SECURITY_SETTINGS_DEFAULTS;
  },
});

// ---------------------------------------------------------------------------
// Unified settings query — aggregates all categories with defaults
// ---------------------------------------------------------------------------

export const getOrgSettings = authQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return {
      ai: org.aiSettings ?? AI_SETTINGS_DEFAULTS,
      branding: await loadEffectiveBrandingSettings(ctx, org),
      signing: org.signingSettings ?? SIGNING_SETTINGS_DEFAULTS,
      notifications: org.notificationSettings ?? NOTIFICATION_SETTINGS_DEFAULTS,
      security: org.securitySettings ?? SECURITY_SETTINGS_DEFAULTS,
    };
  },
});
