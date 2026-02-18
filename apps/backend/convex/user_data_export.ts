/**
 * User Data Export
 *
 * GDPR/CCPA-compliant data portability: exports all user data
 * as a JSON file stored in Convex Storage with a time-limited download URL.
 */

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { authMutation, authQuery } from "./auth";

/**
 * User-facing mutation to request a data export.
 * Schedules the export action and returns immediately.
 */
export const requestDataExport = authMutation({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.user._id;

    // Check if an export is already in progress
    const existing = await ctx.db
      .query("data_exports")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (existing && existing.status === "processing") {
      throw new ConvexError("A data export is already in progress. Please wait for it to complete.");
    }

    // Create export record
    const exportId = await ctx.db.insert("data_exports", {
      userId,
      status: "processing",
      requestedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.user_data_export.generateDataExport, {
      userId,
      exportId,
    });

    return { exportId };
  },
});

/**
 * User-facing query to check export status and get download URL.
 */
export const getLatestExport = authQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.user._id;

    const latest = await ctx.db
      .query("data_exports")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!latest) return null;

    let downloadUrl: string | null = null;
    if (latest.storageId) {
      downloadUrl = await ctx.storage.getUrl(latest.storageId);
    }

    return {
      id: latest._id,
      status: latest.status,
      requestedAt: latest.requestedAt,
      completedAt: latest.completedAt,
      downloadUrl,
    };
  },
});

/**
 * Internal query to gather all user data across tables.
 */
export const gatherUserData = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // 1. User profile
    const profile = {
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      timezone: user.timezone,
      locale: user.locale,
      isEmailVerified: user.isEmailVerified,
      lastLoginAt: user.lastLoginAt,
      onboardingCompleted: user.onboardingCompleted,
      onboardingCompletedAt: user.onboardingCompletedAt,
      createdAt: user._creationTime,
      updatedAt: user.updatedAt,
    };

    // 2. Documents owned by user
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();

    const documentExports = documents.map((doc) => ({
      id: doc._id,
      name: doc.name,
      description: doc.description,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      pageCount: doc.pageCount,
      status: doc.status,
      workflowStatus: doc.workflowStatus,
      sharingMode: doc.sharingMode,
      documentHash: doc.documentHash,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      sentAt: doc.sentAt,
      completedAt: doc.completedAt,
      cancelledAt: doc.cancelledAt,
      declinedAt: doc.declinedAt,
      deadline: doc.deadline,
    }));

    // 3. Organization memberships
    const memberships = await ctx.db
      .query("organization_members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const orgIds = memberships.map((m) => m.organizationId);
    const orgs = await Promise.all(orgIds.map((id) => ctx.db.get(id)));

    const membershipExports = memberships.map((m, i) => ({
      organizationName: orgs[i]?.name ?? "Unknown",
      role: m.role,
      status: m.status,
      joinedAt: m._creationTime,
    }));

    // 4. Saved signatures
    const savedSignatures = await ctx.db
      .query("saved_signatures")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const signatureExports = savedSignatures.map((sig) => ({
      id: sig._id,
      name: sig.name,
      signatureType: sig.signatureType,
      isDefault: sig.isDefault,
      createdAt: sig.createdAt,
    }));

    // 5. Notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const notificationExports = notifications.map((n) => ({
      id: n._id,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt,
    }));

    // 6. Audit logs where user is the actor
    const auditLogs = await ctx.db
      .query("audit_logs")
      .withIndex("by_user", (q) => q.eq("userId", user.clerkId))
      .order("desc")
      .take(1000);

    const auditExports = auditLogs.map((log) => ({
      action: log.action,
      resourceType: log.resourceType,
      description: log.metadata?.description,
      ipAddress: log.ipAddress,
      timestamp: log._creationTime,
    }));

    // 7. Subscription info
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    const subscriptionExport = subscription
      ? {
          status: subscription.status,
          externalPriceId: subscription.externalPriceId,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          canceledAt: subscription.canceledAt,
          cancelReason: subscription.cancelReason,
        }
      : null;

    // 8. Document access grants (documents shared with this user)
    const accessGrants = await ctx.db
      .query("document_access")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const accessExports = await Promise.all(
      accessGrants.map(async (a) => {
        const doc = await ctx.db.get(a.documentId);
        return {
          documentName: doc?.name ?? "Unknown",
          permissionLevel: a.permissionLevel,
          grantedAt: a.grantedAt,
        };
      }),
    );

    return {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      user: profile,
      documents: documentExports,
      organizationMemberships: membershipExports,
      savedSignatures: signatureExports,
      notifications: notificationExports,
      auditTrail: auditExports,
      subscription: subscriptionExport,
      sharedDocuments: accessExports,
    };
  },
});

/**
 * Internal action to generate the data export file and store it.
 */
export const generateDataExport = internalAction({
  args: {
    userId: v.id("users"),
    exportId: v.id("data_exports"),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Gather all user data
      const data = await ctx.runQuery(internal.user_data_export.gatherUserData, {
        userId: args.userId,
      });

      // 2. Serialize to JSON
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });

      // 3. Upload to Convex Storage
      const storageId = await ctx.storage.store(blob);

      // 4. Mark export as complete
      await ctx.runMutation(internal.user_data_export.markExportComplete, {
        exportId: args.exportId,
        storageId: storageId as unknown as string,
      });
    } catch (error) {
      // Mark export as failed
      await ctx.runMutation(internal.user_data_export.markExportFailed, {
        exportId: args.exportId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

/**
 * Internal mutation to mark export as complete.
 */
export const markExportComplete = internalMutation({
  args: {
    exportId: v.id("data_exports"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: "completed" as const,
      storageId: args.storageId,
      completedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to mark export as failed.
 */
export const markExportFailed = internalMutation({
  args: {
    exportId: v.id("data_exports"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: "failed" as const,
      error: args.error,
      completedAt: Date.now(),
    });
  },
});
