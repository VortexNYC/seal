import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * User Profiles Schema
 *
 * Stores extended user profile information beyond what Clerk provides.
 * This complements Clerk's auth data with additional fields like bio.
 */

export const userProfilesTable = defineTable({
	// Reference to Clerk user ID
	clerkUserId: v.string(),

	// Extended profile fields
	bio: v.optional(v.string()),

	// Preferences and settings
	preferences: v.optional(
		v.object({
			emailNotifications: v.optional(v.boolean()),
			pushNotifications: v.optional(v.boolean()),
		}),
	),

	// Timestamps
	updatedAt: v.number(), // Unix timestamp
})
	.index("by_clerk_user_id", ["clerkUserId"])
	.index("by_updated_at", ["updatedAt"]);
