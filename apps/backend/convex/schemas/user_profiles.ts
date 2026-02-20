import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Notification frequency options
 */
export const notificationFrequencyValidator = v.union(
  v.literal("instant"),
  v.literal("daily"),
  v.literal("weekly"),
);

/**
 * Email notification preferences
 */
export const emailNotificationPreferencesValidator = v.object({
  enabled: v.boolean(),
  documentEvents: v.boolean(), // Document sent, signed, completed
  reminders: v.boolean(), // Reminder notifications
  weeklyDigest: v.boolean(), // Weekly summary email
});

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

  // Notification preferences
  notificationPreferences: v.optional(
    v.object({
      // Email notifications with granular control
      email: v.optional(emailNotificationPreferencesValidator),

      // In-app notifications
      inApp: v.optional(v.boolean()),

      // Desktop/push notifications
      desktop: v.optional(v.boolean()),

      // Notification frequency for non-critical updates
      frequency: v.optional(notificationFrequencyValidator),
    }),
  ),

  // Legacy preferences field (kept for backward compatibility)
  preferences: v.optional(
    v.object({
      emailNotifications: v.optional(v.boolean()),
      pushNotifications: v.optional(v.boolean()),
    }),
  ),

  // AI preferences
  aiPreferences: v.optional(
    v.object({
      showFieldSuggestions: v.optional(v.boolean()), // default true
    }),
  ),

  // Timestamps
  updatedAt: v.number(), // Unix timestamp
})
  .index("by_clerk_user_id", ["clerkUserId"])
  .index("by_updated_at", ["updatedAt"]);
