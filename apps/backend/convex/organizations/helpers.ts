/**
 * Organization Helper Queries
 *
 * Internal queries used by actions and other parts of the system
 */

import { v } from "convex/values";

import { internalQuery } from "../_generated/server";

/**
 * Get organization by ID (internal query for actions)
 */
export const getOrganizationById = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId);
  },
});

/**
 * Get user by ID (internal query for actions)
 */
export const getUserById = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get user by Clerk ID (internal query for actions)
 */
export const getUserByClerkId = internalQuery({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

/**
 * Get active membership for a user within an organization
 */
export const getActiveMembershipByUserAndOrganization = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();

    if (!membership || membership.status !== "active") {
      return null;
    }

    return membership;
  },
});

/**
 * Count active members in an organization (for per-seat billing)
 */
export const getActiveMemberCount = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("organization_members")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    return members.length;
  },
});
