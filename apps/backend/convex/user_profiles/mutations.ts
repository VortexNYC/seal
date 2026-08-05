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

    const authSubject = identity.subject;

    // Check if profile exists
    const existingProfile = await ctx.db
      .query("user_profiles")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", authSubject))
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
      authSubject,
      notificationPreferences,
      updatedAt: Date.now(),
    });

    return profileId;
  },
});
