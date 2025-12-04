/**
 * User Profile mutations for Seal
 */

import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import {
	emailNotificationPreferencesValidator,
	notificationFrequencyValidator,
} from "../schemas/user_profiles";

/**
 * Update or create user profile
 * Users can only update their own profile
 */
export const updateProfile = mutation({
	args: {
		bio: v.optional(v.string()),
		preferences: v.optional(
			v.object({
				emailNotifications: v.optional(v.boolean()),
				pushNotifications: v.optional(v.boolean()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError("User not authenticated");
		}

		const clerkUserId = identity.subject;

		// Validate bio length if provided
		if (args.bio !== undefined && args.bio.length > 500) {
			throw new ConvexError("Bio must be 500 characters or less");
		}

		// Check if profile exists
		const existingProfile = await ctx.db
			.query("user_profiles")
			.withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
			.first();

		const profileData = {
			clerkUserId: clerkUserId,
			bio: args.bio,
			preferences: args.preferences,
			updatedAt: Date.now(),
		};

		if (existingProfile) {
			// Update existing profile
			await ctx.db.patch(existingProfile._id, {
				...(args.bio !== undefined && { bio: args.bio }),
				...(args.preferences !== undefined && {
					preferences: args.preferences,
				}),
				updatedAt: Date.now(),
			});

			return existingProfile._id;
		}

		// Create new profile
		const profileId = await ctx.db.insert("user_profiles", profileData);

		return profileId;
	},
});

/**
 * Update notification preferences
 * Handles the new granular notification settings
 */
export const updateNotificationPreferences = mutation({
	args: {
		email: v.optional(emailNotificationPreferencesValidator),
		inApp: v.optional(v.boolean()),
		desktop: v.optional(v.boolean()),
		frequency: v.optional(notificationFrequencyValidator),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new ConvexError("User not authenticated");
		}

		const clerkUserId = identity.subject;

		// Check if profile exists
		const existingProfile = await ctx.db
			.query("user_profiles")
			.withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
			.first();

		const notificationPreferences = {
			...(args.email !== undefined && { email: args.email }),
			...(args.inApp !== undefined && { inApp: args.inApp }),
			...(args.desktop !== undefined && { desktop: args.desktop }),
			...(args.frequency !== undefined && { frequency: args.frequency }),
		};

		if (existingProfile) {
			// Merge with existing preferences
			const mergedPreferences = {
				...existingProfile.notificationPreferences,
				...notificationPreferences,
			};

			await ctx.db.patch(existingProfile._id, {
				notificationPreferences: mergedPreferences,
				updatedAt: Date.now(),
			});

			return existingProfile._id;
		}

		// Create new profile with notification preferences
		const profileId = await ctx.db.insert("user_profiles", {
			clerkUserId,
			notificationPreferences,
			updatedAt: Date.now(),
		});

		return profileId;
	},
});
