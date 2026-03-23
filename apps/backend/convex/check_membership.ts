/**
 * Check if user has organization membership
 * This is a lightweight query that doesn't require organization context
 */

import { createClerkClient } from "@clerk/backend";
import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";

interface OrganizationSyncRepairResult {
  success: boolean;
  activeOrganizationSlug: string | null;
  reason?: string;
}

function getPrimaryEmailAddress(clerkUser: {
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification?: { status?: string | null } | null;
  }>;
}): { email: string; isVerified: boolean } | null {
  const primaryEmail =
    clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId) ??
    clerkUser.emailAddresses[0];
  const email = primaryEmail?.emailAddress?.toLowerCase();

  if (!email) {
    return null;
  }

  return {
    email,
    isVerified: primaryEmail?.verification?.status === "verified",
  };
}

/**
 * Check if current user has any organization memberships
 * Returns true if user has at least one membership, false otherwise
 *
 * NOTE: This is a query and cannot update the user's activeOrganizationId.
 * Use ensureActiveOrganization mutation if you need to fix missing activeOrganizationId.
 */
export const hasOrganization = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Get user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      // User doesn't exist yet (webhook might not have synced)
      return { hasOrganization: false, userId: null, needsActiveOrgFix: false };
    }

    // Check if user has any organization memberships
    const membership = await ctx.db
      .query("organization_members")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    let activeOrganizationId = user.activeOrganizationId ?? null;
    let activeOrganizationSlug: string | null = null;
    let needsActiveOrgFix = false;

    // If user has no activeOrganizationId but has a membership, flag it for fix
    if (!activeOrganizationId && membership) {
      activeOrganizationId = membership.organizationId;
      needsActiveOrgFix = true;
    }

    if (activeOrganizationId) {
      const activeOrganization = await ctx.db.get(activeOrganizationId);

      if (activeOrganization) {
        activeOrganizationSlug = activeOrganization.slug;
      } else {
        activeOrganizationId = null;
        if (membership) {
          needsActiveOrgFix = true;
        }
      }
    }

    return {
      hasOrganization: !!membership,
      userId: user._id,
      activeOrganizationId,
      activeOrganizationSlug,
      needsActiveOrgFix,
    };
  },
});

/**
 * Ensure user has an active organization set
 * If user has memberships but no activeOrganizationId, set the first one as active
 */
export const ensureActiveOrganization = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Get user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return { success: false, reason: "User not found" };
    }

    // If user already has an active organization, verify it still exists
    if (user.activeOrganizationId) {
      const activeOrg = await ctx.db.get(user.activeOrganizationId);
      if (activeOrg) {
        return {
          success: true,
          activeOrganizationId: user.activeOrganizationId,
          activeOrganizationSlug: activeOrg.slug,
          wasFixed: false,
        };
      }
      // Active org doesn't exist, fall through to find a new one
    }

    // Find user's first membership
    const membership = await ctx.db
      .query("organization_members")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!membership) {
      return { success: false, reason: "No organization memberships found" };
    }

    // Get the organization
    const organization = await ctx.db.get(membership.organizationId);
    if (!organization) {
      return { success: false, reason: "Organization not found" };
    }

    // Update user's active organization
    await ctx.db.patch(user._id, {
      activeOrganizationId: organization._id,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      activeOrganizationId: organization._id,
      activeOrganizationSlug: organization.slug,
      wasFixed: true,
    };
  },
});

/**
 * Set the user's active organization based on the current Clerk organization.
 * This is used by the frontend recovery flow when Clerk is ahead of Convex sync.
 */
export const setActiveOrganizationFromClerk = mutation({
  args: {
    clerkOrganizationId: v.string(),
  },
  handler: async (ctx, args): Promise<OrganizationSyncRepairResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return { success: false, activeOrganizationSlug: null, reason: "User not found" };
    }

    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkOrganizationId))
      .first();

    if (!organization) {
      return { success: false, activeOrganizationSlug: null, reason: "Organization not found" };
    }

    const membership = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", user._id).eq("organizationId", organization._id),
      )
      .first();

    if (!membership) {
      return {
        success: false,
        activeOrganizationSlug: null,
        reason: "Organization membership not found",
      };
    }

    await ctx.db.patch(user._id, {
      activeOrganizationId: organization._id,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      activeOrganizationSlug: organization.slug,
    };
  },
});

/**
 * Repair the current signed-in Clerk user/org/membership in Convex.
 * This gives the app a self-heal path when webhook sync is delayed or broken.
 */
export const recoverOrganizationSyncFromClerk = action({
  args: {
    clerkOrganizationId: v.string(),
  },
  handler: async (ctx, args): Promise<OrganizationSyncRepairResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      return {
        success: false,
        activeOrganizationSlug: null,
        reason: "CLERK_SECRET_KEY environment variable is not set",
      };
    }

    const clerk = createClerkClient({ secretKey });
    const clerkUser = await clerk.users.getUser(identity.subject);
    const primaryEmail = getPrimaryEmailAddress(clerkUser);

    if (!primaryEmail) {
      return {
        success: false,
        activeOrganizationSlug: null,
        reason: "Current Clerk user has no primary email address",
      };
    }

    const fullName = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || undefined;

    await ctx.runMutation(api.clerk_webhooks.syncUser, {
      clerkId: clerkUser.id,
      name: fullName,
      email: primaryEmail.email,
      avatar: clerkUser.imageUrl || undefined,
      isEmailVerified: primaryEmail.isVerified,
      locale: clerkUser.locale ?? undefined,
    });

    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: identity.subject,
      limit: 100,
    });

    const membership = memberships.data.find(
      (candidate) => candidate.organization.id === args.clerkOrganizationId,
    );

    if (!membership) {
      return {
        success: false,
        activeOrganizationSlug: null,
        reason: "Current Clerk organization membership was not found",
      };
    }

    await ctx.runMutation(api.clerk_webhooks.syncOrganization, {
      clerkId: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug || undefined,
      logo: membership.organization.imageUrl || undefined,
      metadata: membership.organization.publicMetadata
        ? JSON.stringify(membership.organization.publicMetadata)
        : undefined,
    });

    await ctx.runMutation(internal.clerk_webhooks.upsertMembershipFromClerk, {
      clerkUserId: identity.subject,
      clerkOrgId: membership.organization.id,
      clerkMembershipId: membership.id,
      role: membership.role || "org:member",
    });

    return await ctx.runMutation(api.check_membership.setActiveOrganizationFromClerk, {
      clerkOrganizationId: membership.organization.id,
    });
  },
});

export const listUserOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return [];
    }

    const memberships = await ctx.db
      .query("organization_members")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const organizations = await Promise.all(
      memberships.map(async (membership) => {
        const organization = await ctx.db.get(membership.organizationId);
        if (!organization) {
          return null;
        }

        return {
          organizationId: membership.organizationId,
          organizationName: organization.name,
          organizationSlug: organization.slug,
          role: membership.role,
        };
      }),
    );

    return organizations.filter((org) => org !== null);
  },
});
