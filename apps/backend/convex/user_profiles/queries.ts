/**
 * User Profile queries for Seal
 */

import { v } from "convex/values";

import { query } from "../_generated/server";
import { authQuery } from "../auth";

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
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const profile = await ctx.db
      .query("user_profiles")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    return profile;
  },
});

/**
 * Get usage statistics for the current user
 * Includes document counts by workflow status, storage usage, etc.
 */
export const getUsageStatistics = authQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.user._id;

    // Get all documents owned by the user
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    // Filter out deleted documents
    const activeDocuments = documents.filter((doc) => doc.status !== "deleted");

    // Count by workflow status
    const workflowCounts = {
      draft: 0,
      sent: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      declined: 0,
    };

    let totalStorageBytes = 0;

    for (const doc of activeDocuments) {
      // Count workflow status
      const status = doc.workflowStatus || "draft";
      if (status in workflowCounts) {
        workflowCounts[status as keyof typeof workflowCounts]++;
      }

      // Sum storage
      totalStorageBytes += doc.fileSize || 0;
    }

    // Get documents from current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthTimestamp = startOfMonth.getTime();

    const documentsThisMonth = activeDocuments.filter(
      (doc) => doc.createdAt >= startOfMonthTimestamp,
    );

    const completedThisMonth = documentsThisMonth.filter(
      (doc) => doc.workflowStatus === "completed",
    );

    const sentThisMonth = documentsThisMonth.filter(
      (doc) =>
        doc.workflowStatus === "sent" ||
        doc.workflowStatus === "in_progress" ||
        doc.workflowStatus === "completed",
    );

    // Get org's subscription for plan limits
    const organizationId = ctx.auth.organization._id;
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
      .first();

    const isPro = subscription?.status === "active";

    // Plan limits
    const limits = {
      documentsPerMonth: isPro ? 500 : 10,
      storageBytes: isPro ? 10 * 1024 * 1024 * 1024 : 100 * 1024 * 1024, // 10GB Pro, 100MB Free
    };

    return {
      // Total counts
      totalDocuments: activeDocuments.length,
      workflowCounts,

      // Monthly activity
      documentsThisMonth: documentsThisMonth.length,
      sentThisMonth: sentThisMonth.length,
      completedThisMonth: completedThisMonth.length,

      // Storage
      storageUsedBytes: totalStorageBytes,
      storageLimitBytes: limits.storageBytes,
      storagePercentUsed: Math.min(100, (totalStorageBytes / limits.storageBytes) * 100),

      // Plan info
      plan: isPro ? "pro" : "free",
      documentsLimit: limits.documentsPerMonth,
      documentsPercentUsed: Math.min(
        100,
        (documentsThisMonth.length / limits.documentsPerMonth) * 100,
      ),

      // Completion rate
      completionRate:
        sentThisMonth.length > 0
          ? Math.round((completedThisMonth.length / sentThisMonth.length) * 100)
          : 0,
    };
  },
});
