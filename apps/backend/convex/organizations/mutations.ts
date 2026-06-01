/**
 * Organization/Workspace mutations for Control Zero
 */

import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { logAction } from "../audit_logs/helpers";
import { adminMutation, authMutation } from "../auth";
import { ensureProFeature, ensureSeatLimit } from "../auth/subscription_guards";
import { seedSystemRoles } from "../organization_roles/helpers";
import { organizationBaseSchema } from "../validations/organizations";

// Type for organization update operations
type OrganizationUpdateData = Partial<
  Pick<
    Doc<"organizations">,
    "name" | "logo" | "metadata" | "timezone" | "isActive" | "currency" | "currencyKind"
  >
> & {
  updatedAt: number;
};

type EnsurePersonalOrganizationArgs = {
  clerkOrganizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
};

async function requireUserForPersonalOrganization(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user) {
    throw new ConvexError("User record not found");
  }

  return user;
}

async function findExistingOrganizationForPersonalWorkspace(
  ctx: MutationCtx,
  args: EnsurePersonalOrganizationArgs,
): Promise<Doc<"organizations"> | null> {
  if (args.clerkOrganizationId) {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkOrganizationId!))
      .first();

    if (organization) {
      return organization;
    }
  }

  if (!args.organizationSlug) {
    return null;
  }

  return ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", args.organizationSlug!))
    .first();
}

async function upsertPersonalOrganization(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: EnsurePersonalOrganizationArgs,
  preferredName: string,
): Promise<Doc<"organizations">> {
  const existingOrganization = await findExistingOrganizationForPersonalWorkspace(ctx, args);

  if (!existingOrganization) {
    const baseSlug = args.organizationSlug ?? slugify(preferredName);
    const uniqueSlug = await generateUniqueSlug(ctx.db, baseSlug);
    const organizationId = await ctx.db.insert("organizations", {
      name: args.organizationName || `${preferredName}'s Personal Workspace`,
      slug: uniqueSlug,
      type: "personal",
      timezone: user.timezone || "UTC",
      isActive: true,
      clerkId: args.clerkOrganizationId || undefined,
      updatedAt: Date.now(),
    });

    await seedSystemRoles(ctx.db, organizationId);

    const organization = await ctx.db.get(organizationId);
    if (!organization) {
      throw new ConvexError("Failed to upsert organization");
    }

    return organization;
  }

  await ctx.db.patch(existingOrganization._id, {
    name: args.organizationName || existingOrganization.name,
    slug: args.organizationSlug || existingOrganization.slug,
    clerkId: args.clerkOrganizationId || existingOrganization.clerkId,
    updatedAt: Date.now(),
  });

  const organization = await ctx.db.get(existingOrganization._id);
  if (!organization) {
    throw new ConvexError("Failed to upsert organization");
  }

  return organization;
}

async function ensurePrimaryOwnerMembership(
  ctx: MutationCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<void> {
  const membership = await ctx.db
    .query("organization_members")
    .withIndex("by_user_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();

  if (!membership) {
    await ctx.db.insert("organization_members", {
      organizationId,
      userId,
      role: "owner",
      status: "active",
      isPrimary: true,
      permissions: [],
    });
    return;
  }

  const updates: Partial<Doc<"organization_members">> = {};
  if (!membership.isPrimary) {
    updates.isPrimary = true;
  }
  if (membership.status !== "active") {
    updates.status = "active";
  }
  if (Object.keys(updates).length > 0) {
    await ctx.db.patch(membership._id, updates);
  }
}

async function clearOtherPrimaryMemberships(
  ctx: MutationCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<void> {
  const otherMemberships = await ctx.db
    .query("organization_members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  await Promise.all(
    otherMemberships
      .filter((membership) => membership.organizationId !== organizationId && membership.isPrimary)
      .map((membership) => ctx.db.patch(membership._id, { isPrimary: false })),
  );
}

async function resolveBrandingLogoState(
  storage: MutationCtx["storage"],
  current: {
    logoUrl?: string;
    logoStorageId?: Id<"_storage">;
  },
  args: {
    logoStorageId?: Id<"_storage">;
    removeLogo?: boolean;
  },
): Promise<{ logoUrl?: string; logoStorageId?: Id<"_storage"> }> {
  if (args.removeLogo) {
    if (current.logoStorageId) {
      await storage.delete(current.logoStorageId);
    }

    return {
      logoUrl: undefined,
      logoStorageId: undefined,
    };
  }

  if (!args.logoStorageId) {
    return {
      logoUrl: current.logoUrl,
      logoStorageId: current.logoStorageId,
    };
  }

  if (current.logoStorageId && current.logoStorageId !== args.logoStorageId) {
    await storage.delete(current.logoStorageId);
  }

  return {
    logoStorageId: args.logoStorageId,
    logoUrl: (await storage.getUrl(args.logoStorageId)) ?? undefined,
  };
}

function validateReminderSchedule(reminderSchedule: number[] | undefined): void {
  if (reminderSchedule === undefined) {
    return;
  }

  if (reminderSchedule.length > 10) {
    throw new ConvexError("Reminder schedule cannot have more than 10 entries");
  }

  for (const day of reminderSchedule) {
    if (!Number.isInteger(day) || day < 1) {
      throw new ConvexError("Reminder days must be positive integers");
    }
  }

  const sorted = [...reminderSchedule].sort((a, b) => a - b);
  if (JSON.stringify(sorted) !== JSON.stringify(reminderSchedule)) {
    throw new ConvexError("Reminder schedule must be in ascending order");
  }
}

/**
 * Create or get personal organization for user
 */
export const ensurePersonalOrganization = mutation({
  args: {
    clerkOrganizationId: v.optional(v.string()),
    organizationName: v.optional(v.string()),
    organizationSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserForPersonalOrganization(ctx);
    const preferredName =
      args.organizationName?.trim() || user.name?.trim() || user.email.split("@")[0] || "user";
    const organization = await upsertPersonalOrganization(ctx, user, args, preferredName);

    await ensurePrimaryOwnerMembership(ctx, user._id, organization._id);
    await clearOtherPrimaryMemberships(ctx, user._id, organization._id);

    await ctx.db.patch(user._id, {
      activeOrganizationId: organization._id,
      updatedAt: Date.now(),
    });

    return { organizationId: organization._id };
  },
});

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Return non-empty slug or fallback
  return slug || `user-${Date.now()}`;
}

async function generateUniqueSlug(db: MutationCtx["db"], desiredSlug: string): Promise<string> {
  let slug = desiredSlug;
  let suffix = 0;

  while (true) {
    const existing = await db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (!existing) {
      return slug;
    }

    suffix += 1;
    slug = `${desiredSlug}-${suffix}`;
  }
}

/**
 * Create a new workspace/organization
 */
export const createWorkspace = authMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    type: v.union(v.literal("personal"), v.literal("group"), v.literal("company")),
    logo: v.optional(v.string()),
    metadata: v.optional(v.string()),
    currency: v.optional(v.string()),
    currencyKind: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = ctx.auth;

    // Validate with Zod schema
    const validatedData = organizationBaseSchema.parse({
      name: args.name,
      slug: args.slug,
      type: args.type,
      logo: args.logo,
      metadata: args.metadata,
      currency: args.currency || "USD",
      currencyKind: args.currencyKind || "normal",
      timezone: args.timezone || "UTC",
    });

    // Check if slug is already taken
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", validatedData.slug))
      .first();

    if (existingOrg) {
      throw new ConvexError("An organization with this slug already exists");
    }

    // Create organization
    const organizationId = await ctx.db.insert("organizations", {
      name: validatedData.name,
      slug: validatedData.slug,
      type: validatedData.type,
      logo: validatedData.logo,
      metadata: validatedData.metadata,
      timezone: validatedData.timezone,
      isActive: true,
      updatedAt: Date.now(),
    });

    // Seed system roles for the new organization
    await seedSystemRoles(ctx.db, organizationId);

    // Add creator as owner
    await ctx.db.insert("organization_members", {
      organizationId,
      userId: user._id,
      role: "owner",
      status: "active",
      isPrimary: true,
      permissions: [],
    });

    return { id: organizationId };
  },
});

/**
 * Update workspace/organization
 */
export const updateWorkspace = adminMutation({
  args: {
    name: v.optional(v.string()),
    logo: v.optional(v.string()),
    metadata: v.optional(v.string()),
    currency: v.optional(v.string()),
    currencyKind: v.optional(v.string()),
    timezone: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;

    const updateData: OrganizationUpdateData = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updateData.name = args.name;
    if (args.logo !== undefined) updateData.logo = args.logo;
    if (args.metadata !== undefined) updateData.metadata = args.metadata;
    if (args.timezone !== undefined) updateData.timezone = args.timezone;
    if (args.currency !== undefined) updateData.currency = args.currency;
    if (args.currencyKind !== undefined) updateData.currencyKind = args.currencyKind;
    if (args.isActive !== undefined) updateData.isActive = args.isActive;

    await ctx.db.patch(organization._id, updateData);

    return { success: true };
  },
});

/**
 * Delete workspace/organization (owner only)
 */
export const deleteWorkspace = authMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const { user } = ctx.auth;

    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    // Check if user is owner
    const membership = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", user._id).eq("organizationId", args.organizationId),
      )
      .first();

    if (!membership || membership.role !== "owner") {
      throw new ConvexError("Only organization owners can delete the organization");
    }

    // Get all members and related data
    const [members, invitations] = await Promise.all([
      ctx.db
        .query("organization_members")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .collect(),
      ctx.db
        .query("organization_invitations")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .collect(),
    ]);

    // Delete all related data
    await Promise.all([
      ...members.map((member) => ctx.db.delete(member._id)),
      ...invitations.map((invitation) => ctx.db.delete(invitation._id)),
    ]);

    // Delete organization
    await ctx.db.delete(args.organizationId);

    return { success: true };
  },
});

/**
 * Add member to organization
 */
export const addMember = adminMutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    userType: v.optional(v.union(v.literal("personal"), v.literal("business"))),
  },
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;

    await ensureSeatLimit(ctx.db, organization._id);

    // Check if user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", organization._id),
      )
      .first();

    if (existingMembership) {
      throw new ConvexError("User is already a member of this organization");
    }

    // Create membership
    const membershipId = await ctx.db.insert("organization_members", {
      organizationId: organization._id,
      userId: args.userId,
      role: args.role,
      status: "active",
      isPrimary: false,
      permissions: [],
    });

    return { id: membershipId };
  },
});

/**
 * Update member role
 */
export const updateMemberRole = adminMutation({
  args: {
    memberId: v.id("organization_members"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;

    const membership = await ctx.db.get(args.memberId);
    if (!membership) {
      throw new ConvexError("Member not found");
    }

    if (membership.organizationId !== organization._id) {
      throw new ConvexError("Member not found");
    }

    // Don't allow changing own role
    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot change your own role");
    }

    // Don't allow changing owner role unless current user is owner
    const currentMembership = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", currentUser._id).eq("organizationId", organization._id),
      )
      .first();

    if (membership.role === "owner" && currentMembership?.role !== "owner") {
      throw new ConvexError("Only owners can change owner roles");
    }

    if (args.role === "owner" && currentMembership?.role !== "owner") {
      throw new ConvexError("Only owners can assign owner roles");
    }

    const previousRole = membership.role;

    await ctx.db.patch(args.memberId, {
      role: args.role,
    });

    await logAction(ctx, {
      organizationId: organization._id,
      userId: currentUser.clerkId,
      actorType: "user",
      actorId: currentUser.clerkId,
      action: "member.role_changed",
      resourceType: "member",
      resourceId: membership.userId,
      oldValues: { role: previousRole },
      newValues: { role: args.role },
      metadata: { description: `Role changed from ${previousRole} to ${args.role}` },
      ipAddress: "web-authenticated",
    });

    return { success: true };
  },
});

/**
 * Remove member from organization
 */
export const removeMember = adminMutation({
  args: {
    memberId: v.id("organization_members"),
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;

    const membership = await ctx.db.get(args.memberId);
    if (!membership) {
      throw new ConvexError("Member not found");
    }

    if (membership.organizationId !== organization._id) {
      throw new ConvexError("Member not found");
    }

    // Don't allow removing self
    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot remove yourself from the organization");
    }

    // Don't allow removing owner unless current user is owner
    const currentMembership = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", currentUser._id).eq("organizationId", organization._id),
      )
      .first();

    if (membership.role === "owner" && currentMembership?.role !== "owner") {
      throw new ConvexError("Only owners can remove other owners");
    }

    // Check if this is the last owner
    if (membership.role === "owner") {
      const ownerCount = await ctx.db
        .query("organization_members")
        .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
        .filter((q) => q.eq(q.field("role"), "owner"))
        .collect();

      if (ownerCount.length <= 1) {
        throw new ConvexError("Cannot remove the last owner of the organization");
      }
    }

    const removedUserId = membership.userId;
    const removedRole = membership.role;

    await ctx.db.delete(args.memberId);

    await logAction(ctx, {
      organizationId: organization._id,
      userId: currentUser.clerkId,
      actorType: "user",
      actorId: currentUser.clerkId,
      action: "member.removed",
      resourceType: "member",
      resourceId: removedUserId,
      oldValues: { role: removedRole },
      metadata: { description: `Member removed from organization` },
      ipAddress: "web-authenticated",
    });

    return { success: true };
  },
});

/**
 * Update member status
 */
export const updateMemberStatus = adminMutation({
  args: {
    memberId: v.id("organization_members"),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("suspended"),
      v.literal("pending"),
    ),
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;

    const membership = await ctx.db.get(args.memberId);
    if (!membership) {
      throw new ConvexError("Member not found");
    }

    if (membership.organizationId !== organization._id) {
      throw new ConvexError("Member not found");
    }

    // Don't allow changing own status
    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot change your own status");
    }

    // Don't allow suspending or deactivating owners
    if (membership.role === "owner" && args.status !== "active") {
      throw new ConvexError("Cannot suspend or deactivate organization owner");
    }

    await ctx.db.patch(args.memberId, {
      status: args.status,
    });

    return { success: true };
  },
});

/**
 * Activate a pending member
 */
export const activateMember = adminMutation({
  args: {
    memberId: v.id("organization_members"),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;

    const membership = await ctx.db.get(args.memberId);
    if (!membership) {
      throw new ConvexError("Member not found");
    }

    if (membership.organizationId !== organization._id) {
      throw new ConvexError("Member not found");
    }

    if (membership.status === "active") {
      throw new ConvexError("Member is already active");
    }

    await ctx.db.patch(args.memberId, {
      role: args.role,
      status: "active",
    });

    return { success: true };
  },
});

/**
 * Suspend a member
 */
export const suspendMember = adminMutation({
  args: {
    memberId: v.id("organization_members"),
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;

    const membership = await ctx.db.get(args.memberId);
    if (!membership) {
      throw new ConvexError("Member not found");
    }

    if (membership.organizationId !== organization._id) {
      throw new ConvexError("Member not found");
    }

    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot suspend yourself");
    }

    if (membership.role === "owner") {
      throw new ConvexError("Cannot suspend organization owner");
    }

    await ctx.db.patch(args.memberId, {
      status: "suspended",
    });

    return { success: true };
  },
});

/**
 * Reactivate a suspended or inactive member
 */
export const reactivateMember = adminMutation({
  args: {
    memberId: v.id("organization_members"),
  },
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;

    const membership = await ctx.db.get(args.memberId);
    if (!membership) {
      throw new ConvexError("Member not found");
    }

    if (membership.organizationId !== organization._id) {
      throw new ConvexError("Member not found");
    }

    await ctx.db.patch(args.memberId, {
      status: "active",
    });

    return { success: true };
  },
});

/**
 * Bulk activate members
 */
export const bulkActivateMembers = adminMutation({
  args: {
    memberUpdates: v.array(
      v.object({
        memberId: v.id("organization_members"),
        role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;

    const results = [];

    for (const update of args.memberUpdates) {
      try {
        const membership = await ctx.db.get(update.memberId);
        if (!membership) {
          results.push({
            memberId: update.memberId,
            success: false,
            error: "Member not found",
          });
          continue;
        }

        if (membership.organizationId !== organization._id) {
          results.push({
            memberId: update.memberId,
            success: false,
            error: "Member not found",
          });
          continue;
        }

        if (membership.status === "active") {
          results.push({
            memberId: update.memberId,
            success: false,
            error: "Member is already active",
          });
          continue;
        }

        await ctx.db.patch(update.memberId, {
          role: update.role,
          status: "active",
        });

        results.push({
          memberId: update.memberId,
          success: true,
        });
      } catch (error) {
        results.push({
          memberId: update.memberId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { results };
  },
});

/**
 * Clean up expired invitations
 * Called periodically via cron job to mark expired invitations
 */
export const cleanupExpiredInvitations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all pending invitations that have expired
    const expiredInvitations = await ctx.db
      .query("organization_invitations")
      .filter((q) => q.and(q.eq(q.field("status"), "pending"), q.lt(q.field("expiresAt"), now)))
      .collect();

    // Mark each as expired
    let expiredCount = 0;
    for (const invitation of expiredInvitations) {
      await ctx.db.patch(invitation._id, {
        status: "expired",
      });
      expiredCount++;
    }

    console.info(`[cleanupExpiredInvitations] Marked ${expiredCount} invitations as expired`);

    return { expiredCount };
  },
});

// ---------------------------------------------------------------------------
// AI workspace settings (admin-only)
// ---------------------------------------------------------------------------

export const updateAiSettings = adminMutation({
  args: {
    aiEnabled: v.optional(v.boolean()),
    aiAutoAnalyze: v.optional(v.boolean()),
    aiShowRedlinesToSigners: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(ctx.auth.organization._id);
    if (!org) throw new ConvexError("Organization not found");

    const current = org.aiSettings ?? {
      aiEnabled: true,
      aiAutoAnalyze: true,
      aiShowRedlinesToSigners: false,
    };

    await ctx.db.patch(org._id, {
      aiSettings: {
        aiEnabled: args.aiEnabled ?? current.aiEnabled,
        aiAutoAnalyze: args.aiAutoAnalyze ?? current.aiAutoAnalyze,
        aiShowRedlinesToSigners: args.aiShowRedlinesToSigners ?? current.aiShowRedlinesToSigners,
      },
      updatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Branding settings (admin-only)
// ---------------------------------------------------------------------------

export const generateLogoUploadUrl = adminMutation({
  args: {},
  handler: async (ctx) => {
    await ensureProFeature(ctx.db, ctx.auth.organization._id, "Custom branding");
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateBrandingSettings = adminMutation({
  args: {
    logoStorageId: v.optional(v.id("_storage")),
    removeLogo: v.optional(v.boolean()),
    brandColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    emailFromName: v.optional(v.string()),
    emailReplyTo: v.optional(v.string()),
    hideSealBranding: v.optional(v.boolean()),
    customFooterText: v.optional(v.string()),
    companyName: v.optional(v.string()),
    companyWebsite: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ensureProFeature(ctx.db, ctx.auth.organization._id, "Custom branding");

    const org = await ctx.db.get(ctx.auth.organization._id);
    if (!org) throw new ConvexError("Organization not found");

    const current = org.brandingSettings ?? {
      enabled: false,
    };

    const { logoUrl, logoStorageId } = await resolveBrandingLogoState(ctx.storage, current, args);

    await ctx.db.patch(org._id, {
      brandingSettings: {
        logoStorageId,
        logoUrl,
        brandColor: args.brandColor ?? current.brandColor,
        accentColor: args.accentColor ?? current.accentColor,
        emailFromName: args.emailFromName ?? current.emailFromName,
        emailReplyTo: args.emailReplyTo ?? current.emailReplyTo,
        hideSealBranding: args.hideSealBranding ?? current.hideSealBranding,
        customFooterText: args.customFooterText ?? current.customFooterText,
        companyName: args.companyName ?? current.companyName,
        companyWebsite: args.companyWebsite ?? current.companyWebsite,
        enabled: args.enabled ?? current.enabled,
      },
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// Signing settings (admin-only)
// ---------------------------------------------------------------------------

export const updateSigningSettings = adminMutation({
  args: {
    allowedSignatureTypes: v.optional(
      v.array(v.union(v.literal("draw"), v.literal("type"), v.literal("upload"))),
    ),
    esignConsentText: v.optional(v.string()),
    defaultDeadlineDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(ctx.auth.organization._id);
    if (!org) throw new ConvexError("Organization not found");

    const current = org.signingSettings ?? {
      defaultAuthMethod: "email" as const,
      allowedSignatureTypes: ["draw" as const, "type" as const, "upload" as const],
      esignConsentText: undefined,
      defaultDeadlineDays: 30,
    };

    if (args.defaultDeadlineDays !== undefined) {
      if (args.defaultDeadlineDays < 1 || args.defaultDeadlineDays > 365) {
        throw new ConvexError("Deadline days must be between 1 and 365");
      }
    }

    if (args.allowedSignatureTypes !== undefined && args.allowedSignatureTypes.length === 0) {
      throw new ConvexError("At least one signature type must be allowed");
    }

    await ctx.db.patch(org._id, {
      signingSettings: {
        defaultAuthMethod: "email",
        allowedSignatureTypes: args.allowedSignatureTypes ?? current.allowedSignatureTypes,
        esignConsentText: args.esignConsentText ?? current.esignConsentText,
        defaultDeadlineDays: args.defaultDeadlineDays ?? current.defaultDeadlineDays,
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

    validateReminderSchedule(args.reminderSchedule);

    if (args.expirationAlertDays !== undefined) {
      if (args.expirationAlertDays < 1 || args.expirationAlertDays > 30) {
        throw new ConvexError("Expiration alert days must be between 1 and 30");
      }
    }

    await ctx.db.patch(org._id, {
      notificationSettings: {
        reminderSchedule: args.reminderSchedule ?? current.reminderSchedule,
        expirationAlertDays: args.expirationAlertDays ?? current.expirationAlertDays,
        sendCompletionEmail: args.sendCompletionEmail ?? current.sendCompletionEmail,
        sendViewedNotification: args.sendViewedNotification ?? current.sendViewedNotification,
      },
      updatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Security settings (owner-only — higher impact)
// ---------------------------------------------------------------------------

export const updateSecuritySettings = adminMutation({
  args: {
    ipAllowlist: v.optional(v.array(v.string())),
    allowApiAccess: v.optional(v.boolean()),
    requireMfa: v.optional(v.boolean()),
    sessionTimeoutMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Security settings require owner role — stricter than admin
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", ctx.auth.organization._id),
      )
      .first();

    if (!member || member.role !== "owner") {
      throw new ConvexError("Only organization owners can modify security settings");
    }

    const org = await ctx.db.get(ctx.auth.organization._id);
    if (!org) throw new ConvexError("Organization not found");

    const current = org.securitySettings ?? {
      ipAllowlist: undefined,
      allowApiAccess: true,
      requireMfa: false,
      sessionTimeoutMinutes: undefined,
    };

    if (args.ipAllowlist !== undefined) {
      for (const cidr of args.ipAllowlist) {
        if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/.test(cidr)) {
          throw new ConvexError(`Invalid CIDR format: ${cidr}`);
        }
      }
    }

    if (args.sessionTimeoutMinutes !== undefined) {
      if (args.sessionTimeoutMinutes < 15 || args.sessionTimeoutMinutes > 10080) {
        throw new ConvexError("Session timeout must be between 15 and 10080 minutes");
      }
    }

    await ctx.db.patch(org._id, {
      securitySettings: {
        ipAllowlist: args.ipAllowlist ?? current.ipAllowlist,
        allowApiAccess: args.allowApiAccess ?? current.allowApiAccess,
        requireMfa: args.requireMfa ?? current.requireMfa,
        sessionTimeoutMinutes: args.sessionTimeoutMinutes ?? current.sessionTimeoutMinutes,
      },
      updatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Reset settings to defaults (admin, owner for security)
// ---------------------------------------------------------------------------

const settingsCategoryField = {
  branding: "brandingSettings",
  signing: "signingSettings",
  notifications: "notificationSettings",
  security: "securitySettings",
} as const;

type SettingsCategory = keyof typeof settingsCategoryField;

export const resetOrgSettings = adminMutation({
  args: {
    category: v.union(
      v.literal("branding"),
      v.literal("signing"),
      v.literal("notifications"),
      v.literal("security"),
    ),
  },
  handler: async (ctx, args) => {
    // Security category requires owner role
    if (args.category === "security") {
      const member = await ctx.db
        .query("organization_members")
        .withIndex("by_user_organization", (q) =>
          q.eq("userId", ctx.auth.user._id).eq("organizationId", ctx.auth.organization._id),
        )
        .first();

      if (!member || member.role !== "owner") {
        throw new ConvexError("Only organization owners can reset security settings");
      }
    }

    const field = settingsCategoryField[args.category as SettingsCategory];

    await ctx.db.patch(ctx.auth.organization._id, {
      [field]: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// Delegate ownership setting (admin-only)
// ---------------------------------------------------------------------------

export const updateDelegateOwnership = adminMutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.auth.organization._id, {
      delegateOwnership: args.enabled,
      updatedAt: Date.now(),
    });
  },
});
