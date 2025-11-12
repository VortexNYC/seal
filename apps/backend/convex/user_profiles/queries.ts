/**
 * User Profile queries for Seal
 */

import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Get the current user's profile
 */
export const getCurrentUserProfile = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			return null;
		}

		const clerkUserId = identity.subject;

		const profile = await ctx.db
			.query("user_profiles")
			.withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
			.first();

		return profile;
	},
});

/**
 * Get a user profile by Clerk user ID
 * Only returns profile if requester is authenticated
 */
export const getUserProfile = query({
	args: {
		clerkUserId: v.string(),
	},
	handler: async (ctx, args) => {
		const profile = await ctx.db
			.query("user_profiles")
			.withIndex("by_clerk_user_id", (q) =>
				q.eq("clerkUserId", args.clerkUserId),
			)
			.first();

		return profile;
	},
});
