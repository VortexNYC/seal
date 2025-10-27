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
 * Get organization member by ID (internal query for actions)
 */
export const getOrganizationMemberById = internalQuery({
	args: {
		memberId: v.id("organization_members"),
		organizationId: v.id("organizations"),
	},
	handler: async (ctx, args) => {
		const member = await ctx.db.get(args.memberId);

		// Verify member belongs to the specified organization
		if (member && member.organizationId !== args.organizationId) {
			return null;
		}

		return member;
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
