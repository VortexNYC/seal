/**
 * Organization/Workspace queries
 *
 * Query functions for retrieving organization data, member lists,
 * invitations, and workspace settings (AI, branding, signing,
 * notifications, and security).
 */

import { ConvexError, v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { authQuery } from "../auth";
import { DOCUMENT_SIGNING_PERMISSIONS, hasPermission } from "../auth.utils";

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

    // Verify user has access to this organization
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", org._id),
      )
      .first();

    if (!member) {
      throw new ConvexError("No access to this organization");
    }

    return {
      ...org,
      userRole: member.role,
      userStatus: member.status,
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
    // Verify user has access to this organization
    const userMember = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", args.organizationId),
      )
      .first();

    if (!userMember) {
      throw new ConvexError("No access to this organization");
    }

    // Get all members
    const members = await ctx.db
      .query("organization_members")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Fetch user details for each member
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        if (!user) {
          return null;
        }

        return {
          id: member._id,
          userId: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar,
          role: member.role,
          status: member.status,
          isPrimary: member.isPrimary,
          joinedAt: member._creationTime,
          permissions: member.permissions,
        };
      }),
    );

    // Filter out null values and sort by role hierarchy (owner first, then admin, etc.)
    const roleOrder = {
      owner: 0,
      admin: 1,
      member: 2,
      viewer: 3,
      system: 4,
    };

    return membersWithDetails
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => {
        const roleCompare = roleOrder[a.role] - roleOrder[b.role];
        if (roleCompare !== 0) return roleCompare;
        // If same role, sort by join date
        return a.joinedAt - b.joinedAt;
      });
  },
});

/**
 * Get pending invitations for an organization
 */
export const getPendingInvitations = authQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Verify user has access and can manage members
    const userMember = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", args.organizationId),
      )
      .first();

    if (!userMember) {
      throw new ConvexError("No access to this organization");
    }

    // Only admins and owners can view invitations
    if (!hasPermission(userMember, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_INVITE)) {
      throw new ConvexError("Insufficient permissions to view invitations");
    }

    // Get pending invitations
    const invitations = await ctx.db
      .query("organization_invitations")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    // Fetch inviter details
    const invitationsWithDetails = await Promise.all(
      invitations.map(async (invitation) => {
        const inviter = await ctx.db.get(invitation.invitedBy);

        return {
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          invitedAt: invitation._creationTime,
          expiresAt: invitation.expiresAt,
          inviterName: inviter?.name || "Unknown",
          inviterEmail: inviter?.email || "",
          clerkInvitationId: invitation.clerkInvitationId,
          clerkOrganizationId: invitation.clerkOrganizationId,
        };
      }),
    );

    // Sort by most recent first
    return invitationsWithDetails.sort((a, b) => b.invitedAt - a.invitedAt);
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
    // Get user's membership
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", args.organizationId),
      )
      .first();

    if (!member) {
      throw new ConvexError("No access to this organization");
    }

    // Return detailed permission information
    return {
      role: member.role,
      status: member.status,
      isPrimary: member.isPrimary,
      permissions: {
        // Organization management
        canManageOrganization: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_MANAGE),
        canViewSettings: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_SETTINGS_READ),
        canUpdateSettings: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_SETTINGS_UPDATE),

        // Member management
        canViewMembers: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_READ),
        canInviteMembers: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_INVITE),
        canRemoveMembers: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_REMOVE),
        canUpdateRoles: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_UPDATE_ROLE),

        // Subscription
        canManageBilling: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.SUBSCRIPTION_MANAGE),
        canViewBilling: hasPermission(
          member,
          DOCUMENT_SIGNING_PERMISSIONS.SUBSCRIPTION_BILLING_READ,
        ),

        // Documents
        canCreateDocuments: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_CREATE),
        canSendDocuments: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_SEND),
        canDeleteDocuments: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_DELETE),

        // Templates
        canCreateTemplates: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.TEMPLATES_CREATE),
        canManageTemplates: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.TEMPLATES_UPDATE),

        // API & Webhooks
        canManageAPIKeys: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.API_CREATE),
        canManageWebhooks: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.WEBHOOKS_CREATE),

        // Audit
        canViewAudit: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.AUDIT_READ),

        // Contacts
        canViewContacts: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.CONTACTS_VIEW),
        canCreateContacts: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.CONTACTS_CREATE),
        canDeleteContacts: hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.CONTACTS_DELETE),
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
    // Verify user has access to this organization
    const userMember = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", args.organizationId),
      )
      .first();

    if (!userMember) {
      throw new ConvexError("No access to this organization");
    }

    const members = await ctx.db
      .query("organization_members")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

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
        inactive: members.filter((m) => m.status === "inactive").length,
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
    memberId: v.id("organization_members"),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this organization
    const userMember = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", args.organizationId),
      )
      .first();

    if (!userMember) {
      throw new ConvexError("No access to this organization");
    }

    // Get the member
    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new ConvexError("Member not found");
    }

    // Verify member belongs to this organization
    if (member.organizationId !== args.organizationId) {
      throw new ConvexError("Member not found in this organization");
    }

    // Get user details
    const user = await ctx.db.get(member.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Get custom role if assigned
    let customRole = null;
    if (member.roleId) {
      customRole = await ctx.db.get(member.roleId);
    }

    return {
      id: member._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar,
      role: member.role,
      customRole: customRole
        ? {
            id: customRole._id,
            name: customRole.name,
            permissions: customRole.permissions,
          }
        : null,
      status: member.status,
      isPrimary: member.isPrimary,
      joinedAt: member._creationTime,
      permissions: member.permissions,
      permissionOverrides: member.permissionOverrides,
      clerkId: user.clerkId,
      timezone: user.timezone,
    };
  },
});

/**
 * Get invitation by ID (internal only)
 * Used by actions that need to lookup invitations without auth
 */
export const getInvitationById = internalQuery({
  args: {
    invitationId: v.id("organization_invitations"),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);

    if (!invitation) {
      return null;
    }

    return {
      _id: invitation._id,
      organizationId: invitation.organizationId,
      emailAddress: invitation.email,
      role: invitation.role,
      status: invitation.status,
      clerkInvitationId: invitation.clerkInvitationId,
    };
  },
});

/**
 * Get invitation by Clerk invitation ID (internal only)
 * Used by actions that need to lookup invitations without auth
 */
export const getInvitationByClerkId = internalQuery({
  args: {
    clerkInvitationId: v.string(),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("organization_invitations")
      .withIndex("by_clerk_invitation_id", (q) => q.eq("clerkInvitationId", args.clerkInvitationId))
      .first();

    if (!invitation) {
      return null;
    }

    return {
      _id: invitation._id,
      organizationId: invitation.organizationId,
      emailAddress: invitation.email,
      role: invitation.role,
      status: invitation.status,
      clerkInvitationId: invitation.clerkInvitationId,
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
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.aiSettings ?? AI_SETTINGS_DEFAULTS;
  },
});

/** Internal variant for use in pipeline actions. */
export const getAiSettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
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
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new ConvexError("Organization not found");
    return org.brandingSettings ?? BRANDING_DEFAULTS;
  },
});

/** Internal variant for use in email-sending actions. */
export const getBrandingSettingsInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) return BRANDING_DEFAULTS;
    return org.brandingSettings ?? BRANDING_DEFAULTS;
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
  ipAllowlist: undefined,
  allowApiAccess: true,
  requireMfa: false,
  sessionTimeoutMinutes: undefined,
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
// Unified settings query — aggregates all categories with defaults
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
