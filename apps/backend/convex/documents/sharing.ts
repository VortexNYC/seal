/**
 * Document sharing management for Seal
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { authQuery, permissionMutation } from "../auth";
import {
  ACCESS_ERRORS,
  getActiveMembership,
  getDocumentOrThrow,
  requireManageAccess,
  requireOwnership,
} from "../auth/access_control";
import { createNotification } from "../notifications";

type SharingQueryDbCtx = Pick<QueryCtx, "db">;

async function canViewSharedDocument(
  ctx: SharingQueryDbCtx,
  document: Doc<"documents">,
  userId: Id<"users">,
): Promise<boolean> {
  if (document.ownerId === userId) {
    return true;
  }

  if (document.sharingMode === "workspace") {
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", document.organizationId),
      )
      .first();

    if (member !== null && member.status === "active") {
      return true;
    }
  }

  const access = await ctx.db
    .query("document_access")
    .withIndex("by_document_user", (q) => q.eq("documentId", document._id).eq("userId", userId))
    .first();

  return access !== null && access.revokedAt === undefined;
}

async function getActiveAccessWithUsers(ctx: SharingQueryDbCtx, documentId: Id<"documents">) {
  const accessRecords = await ctx.db
    .query("document_access")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();

  const activeAccessRecords = accessRecords.filter((record) => record.revokedAt === undefined);

  const sharedWith = await Promise.all(
    activeAccessRecords.map(async (access) => {
      const user = await ctx.db.get(access.userId);
      const grantedByUser = await ctx.db.get(access.grantedBy);
      return {
        _id: access._id,
        userId: access.userId,
        userName: user?.name ?? null,
        userEmail: user?.email ?? "Unknown",
        permissionLevel: access.permissionLevel,
        grantedAt: access.grantedAt,
        grantedBy: grantedByUser?.name ?? "Unknown",
      };
    }),
  );

  return { activeAccessRecords, sharedWith };
}

async function getSharingSubscriptionState(
  ctx: SharingQueryDbCtx,
  organizationId: Id<"organizations">,
  hasSharedDocuments: boolean,
) {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
    .first();

  const canUseTeamSharing =
    subscription?.status === "active" || subscription?.status === "trialing";
  const subscriptionWarning =
    subscription?.status === "past_due" && hasSharedDocuments
      ? "Your subscription payment is past due. Document sharing may be disabled soon."
      : null;

  return {
    canUseTeamSharing,
    subscriptionStatus: subscription?.status ?? null,
    subscriptionWarning,
  };
}

/**
 * Update sharing mode for a document
 * Only the owner or users with "manage" permission can change sharing mode
 * Requires documents:share permission
 */
export const updateSharingMode = permissionMutation("documents:share")({
  args: {
    documentId: v.id("documents"),
    sharingMode: v.union(v.literal("private"), v.literal("workspace"), v.literal("specific")),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    const document = await getDocumentOrThrow(ctx, args.documentId);
    await requireManageAccess(
      ctx,
      userId,
      document,
      "Only the document owner or managers can change sharing settings",
    );

    if (args.sharingMode === "workspace" || args.sharingMode === "specific") {
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", document.organizationId))
        .first();

      const isPro = subscription?.status === "active";

      if (!isPro) {
        throw new ConvexError(
          "Team sharing features require a Professional plan. Please upgrade to share documents with your team.",
        );
      }
    }

    await ctx.db.patch(args.documentId, {
      sharingMode: args.sharingMode,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Grant access to a specific user
 * Only works when document is in "specific" sharing mode
 * Requires documents:share permission
 */
export const grantAccess = permissionMutation("documents:share")({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    permissionLevel: v.union(v.literal("view"), v.literal("edit"), v.literal("manage")),
  },
  handler: async (ctx, args) => {
    const currentUserId = ctx.auth.user._id;

    const document = await getDocumentOrThrow(ctx, args.documentId);
    await requireManageAccess(
      ctx,
      currentUserId,
      document,
      "Only the document owner or managers can grant access",
    );

    if (document.sharingMode !== "specific") {
      throw new ConvexError(
        'Document must be in "specific" sharing mode to grant individual access',
      );
    }

    if (args.userId === document.ownerId) {
      throw new ConvexError(
        "Cannot grant access to document owner - they already have full access",
      );
    }

    const targetMember = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", document.organizationId),
      )
      .first();

    if (!targetMember || targetMember.status !== "active") {
      throw new ConvexError("User is not an active member of this organization");
    }

    // 5. Check if access already exists
    const existingAccess = await ctx.db
      .query("document_access")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", args.userId),
      )
      .first();

    const now = Date.now();
    if (existingAccess) {
      await ctx.db.patch(existingAccess._id, {
        permissionLevel: args.permissionLevel,
        grantedBy: currentUserId,
        grantedAt: now,
        updatedBy: currentUserId,
        updatedAt: now,
        revokedAt: undefined,
        revokedBy: undefined,
      });
    } else {
      await ctx.db.insert("document_access", {
        documentId: args.documentId,
        userId: args.userId,
        permissionLevel: args.permissionLevel,
        grantedBy: currentUserId,
        grantedAt: now,
      });
    }

    const currentUser = await ctx.db.get(currentUserId);
    const notificationId = await createNotification(ctx, {
      userId: args.userId,
      organizationId: document.organizationId,
      type: "document_shared",
      data: {
        documentId: args.documentId,
        documentName: document.name,
        permissionLevel: args.permissionLevel,
        sharedBy: currentUserId,
        sharedByName: currentUser?.name ?? undefined,
      },
      emailStatus: "pending",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.documents.document_shared_action.sendDocumentSharedEmail,
      {
        documentId: args.documentId,
        recipientUserId: args.userId,
        sharedByUserId: currentUserId,
        permissionLevel: args.permissionLevel,
        notificationId: notificationId ?? undefined,
      },
    );

    return { success: true };
  },
});

/**
 * Grant access to multiple users at once
 * Requires documents:share permission
 */
export const grantAccessBulk = permissionMutation("documents:share")({
  args: {
    documentId: v.id("documents"),
    users: v.array(
      v.object({
        userId: v.id("users"),
        permissionLevel: v.union(v.literal("view"), v.literal("edit"), v.literal("manage")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const currentUserId = ctx.auth.user._id;

    if (args.users.length === 0) {
      return { success: true, granted: 0, skipped: 0 };
    }

    if (args.users.length > 50) {
      throw new ConvexError("Cannot grant access to more than 50 users at once");
    }

    const document = await getDocumentOrThrow(ctx, args.documentId);
    await requireManageAccess(
      ctx,
      currentUserId,
      document,
      "Only the document owner or managers can grant access",
    );

    if (document.sharingMode !== "specific") {
      throw new ConvexError(
        'Document must be in "specific" sharing mode to grant individual access',
      );
    }

    const now = Date.now();
    const currentUser = await ctx.db.get(currentUserId);
    let granted = 0;
    let skipped = 0;

    for (const { userId, permissionLevel } of args.users) {
      if (userId === document.ownerId) {
        skipped++;
        continue;
      }

      const targetMember = await ctx.db
        .query("organization_members")
        .withIndex("by_user_organization", (q) =>
          q.eq("userId", userId).eq("organizationId", document.organizationId),
        )
        .first();

      if (!targetMember || targetMember.status !== "active") {
        skipped++;
        continue;
      }

      const existingAccess = await ctx.db
        .query("document_access")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", args.documentId).eq("userId", userId),
        )
        .first();

      if (existingAccess) {
        await ctx.db.patch(existingAccess._id, {
          permissionLevel,
          grantedBy: currentUserId,
          grantedAt: now,
          updatedBy: currentUserId,
          updatedAt: now,
          revokedAt: undefined,
          revokedBy: undefined,
        });
      } else {
        await ctx.db.insert("document_access", {
          documentId: args.documentId,
          userId,
          permissionLevel,
          grantedBy: currentUserId,
          grantedAt: now,
        });
      }

      const notificationId = await createNotification(ctx, {
        userId,
        organizationId: document.organizationId,
        type: "document_shared",
        data: {
          documentId: args.documentId,
          documentName: document.name,
          permissionLevel,
          sharedBy: currentUserId,
          sharedByName: currentUser?.name ?? undefined,
        },
        emailStatus: "pending",
      });

      await ctx.scheduler.runAfter(
        0,
        internal.documents.document_shared_action.sendDocumentSharedEmail,
        {
          documentId: args.documentId,
          recipientUserId: userId,
          sharedByUserId: currentUserId,
          permissionLevel,
          notificationId: notificationId ?? undefined,
        },
      );

      granted++;
    }

    return { success: true, granted, skipped };
  },
});

/**
 * Revoke access from a specific user
 * Requires documents:share permission
 */
export const revokeAccess = permissionMutation("documents:share")({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = ctx.auth.user._id;

    const document = await getDocumentOrThrow(ctx, args.documentId);
    await requireManageAccess(
      ctx,
      currentUserId,
      document,
      "Only the document owner or managers can revoke access",
    );

    if (args.userId === document.ownerId) {
      throw new ConvexError("Cannot revoke access from document owner");
    }

    const access = await ctx.db
      .query("document_access")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", args.userId),
      )
      .first();

    if (!access) {
      throw new ConvexError("User does not have explicit access to this document");
    }

    await ctx.db.patch(access._id, {
      revokedAt: Date.now(),
      revokedBy: currentUserId,
    });

    const currentUser = await ctx.db.get(currentUserId);
    await createNotification(ctx, {
      userId: args.userId,
      organizationId: document.organizationId,
      type: "access_revoked",
      data: {
        documentId: args.documentId,
        documentName: document.name,
        revokedBy: currentUserId,
        revokedByName: currentUser?.name ?? undefined,
      },
    });

    return { success: true };
  },
});

/**
 * Update permission level for a user who already has access
 * Requires documents:share permission
 */
export const updateAccessLevel = permissionMutation("documents:share")({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    newPermissionLevel: v.union(v.literal("view"), v.literal("edit"), v.literal("manage")),
  },
  handler: async (ctx, args) => {
    const currentUserId = ctx.auth.user._id;

    const document = await getDocumentOrThrow(ctx, args.documentId);
    await requireManageAccess(
      ctx,
      currentUserId,
      document,
      "Only the document owner or managers can update access levels",
    );

    const targetMember = await getActiveMembership(ctx, args.userId, document.organizationId);
    if (!targetMember) {
      throw new ConvexError(
        "Cannot update access for user who is no longer an active organization member",
      );
    }

    const access = await ctx.db
      .query("document_access")
      .withIndex("by_document_user", (q) =>
        q.eq("documentId", args.documentId).eq("userId", args.userId),
      )
      .first();

    if (!access || access.revokedAt !== undefined) {
      throw new ConvexError("User does not have active access to this document");
    }

    const oldPermissionLevel = access.permissionLevel;

    // Skip update if permission level hasn't changed (no-op optimization)
    if (oldPermissionLevel === args.newPermissionLevel) {
      return { success: true, noChange: true };
    }

    const now = Date.now();
    await ctx.db.patch(access._id, {
      permissionLevel: args.newPermissionLevel,
      grantedBy: currentUserId,
      grantedAt: now,
      updatedBy: currentUserId,
      updatedAt: now,
    });

    const currentUser = await ctx.db.get(currentUserId);
    await createNotification(ctx, {
      userId: args.userId,
      organizationId: document.organizationId,
      type: "access_updated",
      data: {
        documentId: args.documentId,
        documentName: document.name,
        oldPermissionLevel,
        newPermissionLevel: args.newPermissionLevel,
        updatedBy: currentUserId,
        updatedByName: currentUser?.name ?? undefined,
      },
    });

    return { success: true };
  },
});

/**
 * Transfer document ownership to another user in the organization
 * Requires documents:share permission (owner-level operation)
 */
export const transferOwnership = permissionMutation("documents:share")({
  args: {
    documentId: v.id("documents"),
    newOwnerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = ctx.auth.user._id;

    const document = await getDocumentOrThrow(ctx, args.documentId);
    requireOwnership(currentUserId, document, ACCESS_ERRORS.OWNER_REQUIRED);

    const newOwnerMember = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", args.newOwnerId).eq("organizationId", document.organizationId),
      )
      .first();

    if (!newOwnerMember || newOwnerMember.status !== "active") {
      throw new ConvexError("New owner must be an active member of this organization");
    }

    const now = Date.now();
    await ctx.db.patch(args.documentId, {
      ownerId: args.newOwnerId,
      updatedAt: now,
    });

    await ctx.db.insert("document_access", {
      documentId: args.documentId,
      userId: currentUserId,
      permissionLevel: "manage",
      grantedBy: args.newOwnerId,
      grantedAt: now,
    });

    const currentUser = await ctx.db.get(currentUserId);
    await createNotification(ctx, {
      userId: args.newOwnerId,
      organizationId: document.organizationId,
      type: "ownership_transferred",
      data: {
        documentId: args.documentId,
        documentName: document.name,
        previousOwnerId: currentUserId,
        previousOwnerName: currentUser?.name ?? undefined,
      },
    });

    return { success: true };
  },
});

/**
 * Get document access list for sharing dialog
 * Returns all users who have been granted access to a document
 */
export const getDocumentAccess = authQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return null;
    }

    if (!(await canViewSharedDocument(ctx, document, userId))) {
      return null;
    }

    const { activeAccessRecords, sharedWith } = await getActiveAccessWithUsers(
      ctx,
      args.documentId,
    );
    const owner = await ctx.db.get(document.ownerId);
    const hasSharedDocuments = document.sharingMode !== "private" || activeAccessRecords.length > 0;
    const subscriptionState = await getSharingSubscriptionState(
      ctx,
      document.organizationId,
      hasSharedDocuments,
    );

    return {
      documentId: args.documentId,
      documentName: document.name,
      sharingMode: document.sharingMode,
      owner: {
        userId: document.ownerId,
        name: owner?.name ?? null,
        email: owner?.email ?? "Unknown",
      },
      sharedWith,
      ...subscriptionState,
    };
  },
});

/**
 * Get organization members for sharing UI
 * Returns members who can be granted access to a document
 */
export const getShareableMembers = authQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return [];
    }

    // 2. Check if user can manage this document
    let canManage = document.ownerId === userId;
    if (!canManage) {
      const access = await ctx.db
        .query("document_access")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", args.documentId).eq("userId", userId),
        )
        .first();
      canManage = access?.permissionLevel === "manage" && access.revokedAt === undefined;
    }

    if (!canManage) {
      return [];
    }

    // 3. Get all organization members
    const members = await ctx.db
      .query("organization_members")
      .withIndex("by_organization", (q) => q.eq("organizationId", document.organizationId))
      .collect();

    const activeMembers = members.filter((m) => m.status === "active");

    // 4. Get existing access records to mark already-shared members
    const accessRecords = await ctx.db
      .query("document_access")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const activeAccessMap = new Map(
      accessRecords
        .filter((a) => a.revokedAt === undefined)
        .map((a) => [a.userId.toString(), a.permissionLevel]),
    );

    // 5. Get user details for each member
    const shareableMembers = await Promise.all(
      activeMembers.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        const isOwner = member.userId === document.ownerId;
        const existingAccess = activeAccessMap.get(member.userId.toString());

        return {
          userId: member.userId,
          name: user?.name ?? null,
          email: user?.email ?? "Unknown",
          role: member.role,
          isOwner,
          hasAccess: isOwner || existingAccess !== undefined,
          permissionLevel: isOwner ? ("owner" as const) : existingAccess,
        };
      }),
    );

    // Sort: owner first, then by name
    return shareableMembers.sort((a, b) => {
      if (a.isOwner) return -1;
      if (b.isOwner) return 1;
      return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });
  },
});
