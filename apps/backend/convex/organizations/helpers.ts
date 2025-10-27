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
