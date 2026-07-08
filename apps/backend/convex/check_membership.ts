/**
 * Check if user has organization membership
 * This is a lightweight query that doesn't require organization context
 */

import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { resolveComponentMemberships } from "./lib/componentOrgReads";

/**
 * Check if current user has any organization memberships
 * Returns true if user has at least one membership, false otherwise
 *
 * NOTE: This is a query and cannot update the user's activeOrganizationId.
 * Use ensureActiveOrganization mutation if you need to fix missing activeOrganizationId.
 */
/** Returns whether the current user belongs to any organization. */
export const hasOrganization = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Auth token not yet attached (race during page load before the auth provider attaches it).
      // Returning null lets the React caller treat this as a loading state instead of
      // tripping the error boundary on every fresh navigation.
      return null;
    }

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
      .first();

    if (!user) {
      // User doesn't exist yet (webhook might not have synced)
      return { hasOrganization: false, userId: null, needsActiveOrgFix: false };
    }

    const memberships = await resolveComponentMemberships(ctx, user);
    const membership = memberships[0] ?? null;

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

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
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
    const memberships = await resolveComponentMemberships(ctx, user);
    const membership = memberships[0] ?? null;

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

export const setActiveOrganizationBySlug = mutation({
  args: {
    organizationSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.organizationSlug))
      .first();

    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    if (!organization.vortexAuthOrganizationId) {
      throw new ConvexError("Organization is not anchored to Vortex Auth");
    }

    const memberships = await resolveComponentMemberships(ctx, user);
    const membership = memberships.find(
      (candidate) =>
        candidate.organizationId === organization._id && candidate.status === "active",
    );

    if (!membership) {
      throw new ConvexError("Organization mismatch");
    }

    await ctx.db.patch(user._id, {
      activeOrganizationId: organization._id,
      activeVortexAuthOrganizationId: organization.vortexAuthOrganizationId,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      activeOrganizationId: organization._id,
      activeOrganizationSlug: organization.slug,
    };
  },
});

export const listUserOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Same race as hasOrganization — return null so callers treat it as loading.
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
      .first();

    if (!user) {
      return [];
    }

    const memberships = await resolveComponentMemberships(ctx, user);

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
