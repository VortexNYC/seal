/**
 * Organization Helper Queries
 *
 * Internal queries used by actions and other parts of the system
 */

import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import {
  listComponentMembersByOrganization,
  resolveComponentMembershipForOrganization,
} from "../lib/componentOrgReads";

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
 * Get user by auth subject (internal query for actions)
 */
export const getUserByAuthSubject = internalQuery({
  args: {
    authSubject: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", args.authSubject))
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
    const [user, organization] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db.get(args.organizationId),
    ]);
    if (!user || !organization) {
      return null;
    }
    const membership = await resolveComponentMembershipForOrganization(ctx, user, organization);

    if (!membership || membership.status !== "active") {
      return null;
    }

    return {
      userId: args.userId,
      organizationId: args.organizationId,
      role: membership.role,
      status: membership.status,
      roleId: membership.roleId,
    };
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
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      return 0;
    }
    const members = await listComponentMembersByOrganization(ctx, organization, {
      status: "active",
    });
    return members.length;
  },
});
