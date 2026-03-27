/**
 * User Data Export
 *
 * GDPR/CCPA-compliant data portability: exports all user data
 * as a JSON file stored in Convex Storage with a time-limited download URL.
 */

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { authMutation, authQuery } from "./auth";

function buildUserProfile(user: Doc<"users">) {
  return {
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
}

async function getDocumentExports(ctx: QueryCtx, userId: Id<"users">) {
  const documents = await ctx.db
    .query("documents")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();

  return documents.map((doc) => ({
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
}

async function getMembershipExports(ctx: QueryCtx, userId: Id<"users">) {
  const memberships = await ctx.db
    .query("organization_members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const organizations = await Promise.all(
    memberships.map((membership) => ctx.db.get(membership.organizationId)),
  );

  return memberships.map((membership, index) => ({
    organizationName: organizations[index]?.name ?? "Unknown",
    role: membership.role,
    status: membership.status,
    joinedAt: membership._creationTime,
  }));
}

async function getSavedSignatureExports(ctx: QueryCtx, userId: Id<"users">) {
  const savedSignatures = await ctx.db
    .query("saved_signatures")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return savedSignatures.map((signature) => ({
    id: signature._id,
    name: signature.name,
    signatureType: signature.signatureType,
    isDefault: signature.isDefault,
    createdAt: signature.createdAt,
  }));
}

async function getNotificationExports(ctx: QueryCtx, userId: Id<"users">) {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return notifications.map((notification) => ({
    id: notification._id,
    type: notification.type,
    read: notification.read,
    createdAt: notification.createdAt,
  }));
}

async function getAuditExports(ctx: QueryCtx, clerkUserId: string) {
  const auditLogs = await ctx.db
    .query("audit_logs")
    .withIndex("by_user", (q) => q.eq("userId", clerkUserId))
    .order("desc")
    .take(1000);

  return auditLogs.map((log) => ({
    action: log.action,
    resourceType: log.resourceType,
    description: log.metadata?.description,
    ipAddress: log.ipAddress,
    timestamp: log._creationTime,
  }));
}

async function getSubscriptionExport(ctx: QueryCtx, userId: Id<"users">) {
  // Find the user's active org to look up org-scoped subscription
  const user = await ctx.db.get(userId);
  if (!user?.activeOrganizationId) return null;

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_id", (q) => q.eq("organizationId", user.activeOrganizationId!))
    .first();

  if (!subscription) {
    return null;
  }

  return {
    status: subscription.status,
    externalPriceId: subscription.externalPriceId,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt: subscription.canceledAt,
    cancelReason: subscription.cancelReason,
  };
}

async function getAccessExports(ctx: QueryCtx, userId: Id<"users">) {
  const accessGrants = await ctx.db
    .query("document_access")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return Promise.all(
    accessGrants.map(async (grant) => {
      const document = await ctx.db.get(grant.documentId);
      return {
        documentName: document?.name ?? "Unknown",
        permissionLevel: grant.permissionLevel,
        grantedAt: grant.grantedAt,
      };
    }),
  );
}

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
      throw new ConvexError(
        "A data export is already in progress. Please wait for it to complete.",
      );
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

    const [
      documents,
      organizationMemberships,
      savedSignatures,
      notifications,
      auditTrail,
      subscription,
      sharedDocuments,
    ] = await Promise.all([
      getDocumentExports(ctx, args.userId),
      getMembershipExports(ctx, args.userId),
      getSavedSignatureExports(ctx, args.userId),
      getNotificationExports(ctx, args.userId),
      getAuditExports(ctx, user.clerkId),
      getSubscriptionExport(ctx, args.userId),
      getAccessExports(ctx, args.userId),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      user: buildUserProfile(user),
      documents,
      organizationMemberships,
      savedSignatures,
      notifications,
      auditTrail,
      subscription,
      sharedDocuments,
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
