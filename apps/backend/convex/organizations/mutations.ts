/**
 * Organization/Workspace mutations for Control Zero
 */

import { ConvexError, v } from "convex/values";

import { components } from "../_generated/api";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
} from "../_generated/server";
import { logAction } from "../audit_logs/helpers";
import { adminAction, adminMutation, authMutation } from "../auth";
import { ensureProFeature } from "../auth/subscription_guards";
import {
  getComponentMemberById,
  getComponentMemberRefForUserOrganization,
  listComponentMembersByOrganization,
} from "../lib/componentOrgReads";
import {
  mirrorBrandIntoBrandingSettings,
  syncSuiteOrgDetailsToVortexAuth,
} from "../lib/suiteOrgPolicy";
import {
  anchorNewOrganizationOwner,
  ensureComponentRoleForTemplate,
  upsertVortexAuthMember,
} from "../lib/vortexAuthOrganizations";
import { organizationBaseSchema } from "../validations/organizations";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

// Type for organization update operations
type OrganizationUpdateData = Partial<
  Pick<
    Doc<"organizations">,
    | "name"
    | "logo"
    | "metadata"
    | "timezone"
    | "isActive"
    | "currency"
    | "currencyKind"
    | "brandingSettings"
  >
> & {
  updatedAt: number;
};

type EnsurePersonalOrganizationArgs = {
  organizationName?: string;
  organizationSlug?: string;
};

async function requireUserForPersonalOrganization(
  ctx: MutationCtx
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
    .first();

  if (!user) {
    throw new ConvexError("User record not found");
  }

  return user;
}

async function findExistingOrganizationForPersonalWorkspace(
  ctx: MutationCtx,
  args: EnsurePersonalOrganizationArgs
): Promise<Doc<"organizations"> | null> {
  if (!args.organizationSlug) {
    return null;
  }

  return ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) =>
      q.eq("slug", sealAssertPresent(args.organizationSlug))
    )
    .first();
}

async function upsertPersonalOrganization(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: EnsurePersonalOrganizationArgs,
  preferredName: string
): Promise<Doc<"organizations">> {
  const existingOrganization =
    await findExistingOrganizationForPersonalWorkspace(ctx, args);

  if (!existingOrganization) {
    const baseSlug = args.organizationSlug ?? slugify(preferredName);
    const uniqueSlug = await generateUniqueSlug(ctx.db, baseSlug);
    const organizationId = await ctx.db.insert("organizations", {
      name: args.organizationName || `${preferredName}'s Personal Workspace`,
      slug: uniqueSlug,
      type: "personal",
      timezone: user.timezone || "UTC",
      isActive: true,
      updatedAt: Date.now(),
    });

    const organization = await ctx.db.get("organizations", organizationId);
    if (!organization) {
      throw new ConvexError("Failed to upsert organization");
    }

    return organization;
  }

  await ctx.db.patch("organizations", existingOrganization._id, {
    name: args.organizationName || existingOrganization.name,
    slug: args.organizationSlug || existingOrganization.slug,
    updatedAt: Date.now(),
  });

  const organization = await ctx.db.get(
    "organizations",
    existingOrganization._id
  );
  if (!organization) {
    throw new ConvexError("Failed to upsert organization");
  }

  return organization;
}

async function ensurePrimaryOwnerMembership(
  ctx: MutationCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">
): Promise<void> {
  await upsertVortexAuthMember(ctx, {
    organizationId,
    userId,
    role: "owner",
    status: "active",
  });
}

async function clearOtherPrimaryMemberships(
  _ctx: MutationCtx,
  _userId: Id<"users">,
  _organizationId: Id<"organizations">
): Promise<void> {
  // Component auth owns membership truth. Active organization is stored on the
  // local user anchor, so no per-membership primary flag is maintained here.
}

type ComponentMemberStatus = "active" | "invited" | "suspended";
type ComponentMemberMutationCtx = Pick<
  MutationCtx,
  "db" | "runQuery" | "runMutation"
>;
type SealComponentMember = NonNullable<
  Awaited<ReturnType<typeof getComponentMemberById>>
> & {
  userId: Id<"users">;
  role: "system" | "owner" | "admin" | "member" | "viewer";
};

function toComponentMemberStatus(
  status: "active" | "inactive" | "suspended" | "pending"
): ComponentMemberStatus {
  if (status === "pending") {
    return "invited";
  }
  if (status === "inactive") {
    return "suspended";
  }
  return status;
}

async function requireComponentMemberInOrganization(
  ctx: ComponentMemberMutationCtx,
  organization: Doc<"organizations">,
  memberId: string
): Promise<SealComponentMember> {
  const membership = await getComponentMemberById(ctx, memberId);
  if (
    !membership ||
    membership.organizationId !== organization._id ||
    !membership.userId
  ) {
    throw new ConvexError("Member not found");
  }
  if (!membership.role) {
    throw new ConvexError("Member role is not supported by Seal");
  }
  return {
    ...membership,
    userId: membership.userId,
    role: membership.role,
  };
}

async function setComponentMemberStatus(
  ctx: ComponentMemberMutationCtx,
  memberId: string,
  status: ComponentMemberStatus
): Promise<void> {
  await ctx.runMutation(components.vortexAuth.organizations.setMemberStatus, {
    memberId,
    status,
  });
}

async function setComponentMemberRole(
  ctx: ComponentMemberMutationCtx,
  organization: Doc<"organizations">,
  memberId: string,
  role: "owner" | "admin" | "member" | "viewer",
  assignedByVortexAuthUserId?: string
): Promise<void> {
  if (!organization.vortexAuthOrganizationId) {
    throw new ConvexError("Organization is not anchored to Vortex Auth");
  }
  const roleId = await ensureComponentRoleForTemplate(
    ctx,
    organization._id,
    role
  );
  await ctx.runMutation(components.vortexAuth.organizations.setMemberRole, {
    memberId,
    organizationId: organization.vortexAuthOrganizationId,
    roleId,
    assignedBy: assignedByVortexAuthUserId,
  });
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
  }
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

function validateReminderSchedule(
  reminderSchedule: number[] | undefined
): void {
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

  const sorted = reminderSchedule.toSorted((a, b) => a - b);
  if (JSON.stringify(sorted) !== JSON.stringify(reminderSchedule)) {
    throw new ConvexError("Reminder schedule must be in ascending order");
  }
}

/**
 * Create or get personal organization for user
 */
export const ensurePersonalOrganization = mutation({
  args: {
    organizationName: v.optional(v.string()),
    organizationSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserForPersonalOrganization(ctx);
    const preferredName =
      args.organizationName?.trim() ||
      user.name?.trim() ||
      user.email.split("@")[0] ||
      "user";
    const organization = await upsertPersonalOrganization(
      ctx,
      user,
      args,
      preferredName
    );

    await ensurePrimaryOwnerMembership(ctx, user._id, organization._id);
    await clearOtherPrimaryMemberships(ctx, user._id, organization._id);

    // Mirror the org + owner into the vortexAuth component immediately so
    // component-truth consumers (MCP OAuth, /api/v1) see it without waiting.
    await anchorNewOrganizationOwner(ctx, {
      organizationId: organization._id,
      ownerUserId: user._id,
    });

    await ctx.db.patch("users", user._id, {
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

async function generateUniqueSlug(
  db: MutationCtx["db"],
  desiredSlug: string
): Promise<string> {
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
    type: v.union(
      v.literal("personal"),
      v.literal("group"),
      v.literal("company")
    ),
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

    // Mirror the org + owner into the vortexAuth component immediately so
    // component-truth consumers (MCP OAuth, /api/v1) see it without waiting.
    await anchorNewOrganizationOwner(ctx, {
      organizationId,
      ownerUserId: user._id,
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
    brand: v.optional(
      v.object({
        primaryColor: v.optional(v.union(v.string(), v.null())),
        accentColor: v.optional(v.union(v.string(), v.null())),
        website: v.optional(v.union(v.string(), v.null())),
        emailFromName: v.optional(v.union(v.string(), v.null())),
        emailReplyTo: v.optional(v.union(v.string(), v.null())),
      })
    ),
    security: v.optional(
      v.object({
        requireMfa: v.optional(v.union(v.boolean(), v.null())),
        sessionTimeoutMinutes: v.optional(v.union(v.number(), v.null())),
      })
    ),
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
    if (args.currencyKind !== undefined)
      updateData.currencyKind = args.currencyKind;
    if (args.isActive !== undefined) updateData.isActive = args.isActive;

    if (args.brand !== undefined) {
      const org = await ctx.db.get("organizations", organization._id);
      if (!org) throw new ConvexError("Organization not found");
      updateData.brandingSettings = mirrorBrandIntoBrandingSettings(
        org.brandingSettings,
        args.brand
      );
    }

    await ctx.db.patch("organizations", organization._id, updateData);

    const fresh = await ctx.db.get("organizations", organization._id);
    if (!fresh) throw new ConvexError("Organization not found");

    if (
      args.name !== undefined ||
      args.logo !== undefined ||
      args.brand !== undefined ||
      args.security !== undefined
    ) {
      await syncSuiteOrgDetailsToVortexAuth(ctx, fresh, {
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.logo !== undefined ? { imageUrl: args.logo } : {}),
        ...(args.brand !== undefined ? { brand: args.brand } : {}),
        ...(args.security !== undefined ? { security: args.security } : {}),
      });
    }

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
    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    if (
      ctx.auth.organization._id !== args.organizationId ||
      ctx.auth.member.role !== "owner"
    ) {
      throw new ConvexError(
        "Only organization owners can delete the organization"
      );
    }

    if (organization.vortexAuthOrganizationId) {
      await ctx.runMutation(
        components.vortexAuth.organizations.setOrganizationStatus,
        {
          organizationId: organization.vortexAuthOrganizationId,
          status: "deleted",
        }
      );
    }

    // Delete organization
    await ctx.db.delete("organizations", args.organizationId);

    return { success: true };
  },
});

export const addMemberCore = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    userType: v.optional(v.union(v.literal("personal"), v.literal("business"))),
    assignedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    const existingMembership = await getComponentMemberRefForUserOrganization(
      ctx,
      user,
      organization
    );
    if (existingMembership !== null) {
      throw new ConvexError("User is already a member of this organization");
    }

    const membershipId = await upsertVortexAuthMember(ctx, {
      organizationId: args.organizationId,
      userId: args.userId,
      role: args.role,
      status: "active",
      assignedBy: args.assignedBy,
    });

    return { id: membershipId };
  },
});

/**
 * Add member to organization
 */
export const addMember = adminAction({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    userType: v.optional(v.union(v.literal("personal"), v.literal("business"))),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.auth.subscription_guards.ensureSeatLimitD1, {
      organizationId: ctx.auth.organizationId,
    });

    return await ctx.runMutation(
      internal.organizations.mutations.addMemberCore,
      {
        organizationId: ctx.auth.organizationId,
        userId: args.userId,
        role: args.role,
        userType: args.userType,
        assignedBy: ctx.auth.userId,
      }
    );
  },
});

/**
 * Update member role
 */
export const updateMemberRole = adminMutation({
  args: {
    memberId: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;

    const membership = await requireComponentMemberInOrganization(
      ctx,
      organization,
      args.memberId
    );

    // Don't allow changing own role
    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot change your own role");
    }

    if (membership.role === "owner" && ctx.auth.member.role !== "owner") {
      throw new ConvexError("Only owners can change owner roles");
    }

    if (args.role === "owner" && ctx.auth.member.role !== "owner") {
      throw new ConvexError("Only owners can assign owner roles");
    }

    const previousRole = membership.role;

    await setComponentMemberRole(
      ctx,
      organization,
      args.memberId,
      args.role,
      currentUser.vortexAuthUserId
    );

    await logAction(ctx, {
      organizationId: organization._id,
      userId: currentUser.authSubject,
      actorType: "user",
      actorId: currentUser.authSubject,
      action: "member.role_changed",
      resourceType: "member",
      resourceId: membership.userId,
      oldValues: { role: previousRole },
      newValues: { role: args.role },
      metadata: {
        description: `Role changed from ${previousRole} to ${args.role}`,
      },
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
    memberId: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;

    const membership = await requireComponentMemberInOrganization(
      ctx,
      organization,
      args.memberId
    );

    // Don't allow removing self
    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot remove yourself from the organization");
    }

    if (membership.role === "owner" && ctx.auth.member.role !== "owner") {
      throw new ConvexError("Only owners can remove other owners");
    }

    // Check if this is the last owner
    if (membership.role === "owner") {
      const ownerCount = (
        await listComponentMembersByOrganization(ctx, organization)
      ).filter(
        (member) => member.role === "owner" && member.status === "active"
      );

      if (ownerCount.length <= 1) {
        throw new ConvexError(
          "Cannot remove the last owner of the organization"
        );
      }
    }

    const removedUserId = membership.userId;
    const removedRole = membership.role;

    await setComponentMemberStatus(ctx, args.memberId, "suspended");

    await logAction(ctx, {
      organizationId: organization._id,
      userId: currentUser.authSubject,
      actorType: "user",
      actorId: currentUser.authSubject,
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
    memberId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("suspended"),
      v.literal("pending")
    ),
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;

    const membership = await requireComponentMemberInOrganization(
      ctx,
      organization,
      args.memberId
    );

    // Don't allow changing own status
    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot change your own status");
    }

    // Don't allow suspending or deactivating owners
    if (membership.role === "owner" && args.status !== "active") {
      throw new ConvexError("Cannot suspend or deactivate organization owner");
    }

    await setComponentMemberStatus(
      ctx,
      args.memberId,
      toComponentMemberStatus(args.status)
    );

    return { success: true };
  },
});

/**
 * Activate a pending member
 */
export const activateMember = adminMutation({
  args: {
    memberId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;

    const membership = await requireComponentMemberInOrganization(
      ctx,
      organization,
      args.memberId
    );

    if (membership.status === "active") {
      throw new ConvexError("Member is already active");
    }

    await setComponentMemberRole(
      ctx,
      organization,
      args.memberId,
      args.role,
      ctx.auth.user.vortexAuthUserId
    );
    await setComponentMemberStatus(ctx, args.memberId, "active");

    return { success: true };
  },
});

/**
 * Suspend a member
 */
export const suspendMember = adminMutation({
  args: {
    memberId: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;

    const membership = await requireComponentMemberInOrganization(
      ctx,
      organization,
      args.memberId
    );

    if (membership.userId === currentUser._id) {
      throw new ConvexError("Cannot suspend yourself");
    }

    if (membership.role === "owner") {
      throw new ConvexError("Cannot suspend organization owner");
    }

    await setComponentMemberStatus(ctx, args.memberId, "suspended");

    return { success: true };
  },
});

/**
 * Reactivate a suspended or inactive member
 */
export const reactivateMember = adminMutation({
  args: {
    memberId: v.string(),
  },
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;

    await requireComponentMemberInOrganization(
      ctx,
      organization,
      args.memberId
    );
    await setComponentMemberStatus(ctx, args.memberId, "active");

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
        memberId: v.string(),
        role: v.union(
          v.literal("admin"),
          v.literal("member"),
          v.literal("viewer")
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;

    const results = [];

    for (const update of args.memberUpdates) {
      try {
        const membership = await requireComponentMemberInOrganization(
          ctx,
          organization,
          update.memberId
        );

        if (membership.status === "active") {
          results.push({
            memberId: update.memberId,
            success: false,
            error: "Member is already active",
          });
          continue;
        }

        await setComponentMemberRole(
          ctx,
          organization,
          update.memberId,
          update.role,
          ctx.auth.user.vortexAuthUserId
        );
        await setComponentMemberStatus(ctx, update.memberId, "active");

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
    void ctx;
    const expiredCount = 0;

    console.info(
      `[cleanupExpiredInvitations] Marked ${expiredCount} invitations as expired`
    );

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
    const org = await ctx.db.get("organizations", ctx.auth.organization._id);
    if (!org) throw new ConvexError("Organization not found");

    const current = org.aiSettings ?? {
      aiEnabled: true,
      aiAutoAnalyze: true,
      aiShowRedlinesToSigners: false,
    };

    await ctx.db.patch("organizations", org._id, {
      aiSettings: {
        aiEnabled: args.aiEnabled ?? current.aiEnabled,
        aiAutoAnalyze: args.aiAutoAnalyze ?? current.aiAutoAnalyze,
        aiShowRedlinesToSigners:
          args.aiShowRedlinesToSigners ?? current.aiShowRedlinesToSigners,
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
    await ensureProFeature(
      ctx.db,
      ctx.auth.organization._id,
      "Custom branding"
    );
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
    await ensureProFeature(
      ctx.db,
      ctx.auth.organization._id,
      "Custom branding"
    );

    const org = await ctx.db.get("organizations", ctx.auth.organization._id);
    if (!org) throw new ConvexError("Organization not found");

    const current = org.brandingSettings ?? {
      enabled: false,
    };

    const { logoUrl, logoStorageId } = await resolveBrandingLogoState(
      ctx.storage,
      current,
      args
    );

    await ctx.db.patch("organizations", org._id, {
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
      v.array(
        v.union(v.literal("draw"), v.literal("type"), v.literal("upload"))
      )
    ),
    esignConsentText: v.optional(v.string()),
    defaultDeadlineDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", ctx.auth.organization._id);
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

    if (args.defaultDeadlineDays !== undefined) {
      if (args.defaultDeadlineDays < 1 || args.defaultDeadlineDays > 365) {
        throw new ConvexError("Deadline days must be between 1 and 365");
      }
    }

    if (
      args.allowedSignatureTypes !== undefined &&
      args.allowedSignatureTypes.length === 0
    ) {
      throw new ConvexError("At least one signature type must be allowed");
    }

    await ctx.db.patch("organizations", org._id, {
      signingSettings: {
        defaultAuthMethod: "email",
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
    const org = await ctx.db.get("organizations", ctx.auth.organization._id);
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

    await ctx.db.patch("organizations", org._id, {
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

export const updateSecuritySettings = adminMutation({
  args: {
    ipAllowlist: v.optional(v.array(v.string())),
    allowApiAccess: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Security settings require owner role — stricter than admin
    if (ctx.auth.member.role !== "owner") {
      throw new ConvexError(
        "Only organization owners can modify security settings"
      );
    }

    const org = await ctx.db.get("organizations", ctx.auth.organization._id);
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

    // SEA-604: requireMfa / sessionTimeoutMinutes are Core (VOR-183). Preserve
    // any legacy stored values; Seal only writes API access + IP allowlist.
    await ctx.db.patch("organizations", org._id, {
      securitySettings: {
        ipAllowlist: args.ipAllowlist ?? current.ipAllowlist,
        allowApiAccess: args.allowApiAccess ?? current.allowApiAccess,
        requireMfa: current.requireMfa,
        sessionTimeoutMinutes: current.sessionTimeoutMinutes,
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

export const resetOrgSettings = adminMutation({
  args: {
    category: v.union(
      v.literal("branding"),
      v.literal("signing"),
      v.literal("notifications"),
      v.literal("security")
    ),
  },
  handler: async (ctx, args) => {
    // Security category requires owner role
    if (args.category === "security") {
      if (ctx.auth.member.role !== "owner") {
        throw new ConvexError(
          "Only organization owners can reset security settings"
        );
      }
    }

    const field = settingsCategoryField[args.category];

    await ctx.db.patch("organizations", ctx.auth.organization._id, {
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
    await ctx.db.patch("organizations", ctx.auth.organization._id, {
      delegateOwnership: args.enabled,
      updatedAt: Date.now(),
    });
  },
});
