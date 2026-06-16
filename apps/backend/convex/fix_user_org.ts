/**
 * One-time fix for users missing activeOrganizationId
 * Delete this file after use
 */

import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { resolveComponentMemberships } from "./lib/componentOrgReads";

/**
 * Fix a user who has a membership but no activeOrganizationId set
 * Run from Convex dashboard: fix_user_org:fixUserActiveOrganization({ email: "user@example.com" })
 */
export const fixUserActiveOrganization = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.activeOrganizationId) {
      return {
        success: false,
        error: "User already has activeOrganizationId set",
        activeOrganizationId: user.activeOrganizationId,
      };
    }

    // Find user's first Vortex Auth-owned membership.
    const membership = (await resolveComponentMemberships(ctx, user))[0];

    if (!membership) {
      return { success: false, error: "User has no organization memberships" };
    }

    // Get organization details
    const organization = await ctx.db.get(membership.organizationId);

    // Set activeOrganizationId
    await ctx.db.patch(user._id, {
      activeOrganizationId: membership.organizationId,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      userId: user._id,
      organizationId: membership.organizationId,
      organizationName: organization?.name,
      organizationSlug: organization?.slug,
    };
  },
});
