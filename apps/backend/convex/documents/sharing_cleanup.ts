/**
 * Document sharing cleanup helpers for subscription lapse and member removal scenarios.
 * These internal mutations are called from Stripe webhooks and Clerk webhooks.
 */

import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { createNotification } from "../notifications";

async function revokeAllDocumentAccess(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  reason: string,
): Promise<Array<{ userId: Id<"users">; permissionLevel: string }>> {
  const now = Date.now();
  const revokedUsers: Array<{ userId: Id<"users">; permissionLevel: string }> = [];

  const accessRecords = await ctx.db
    .query("document_access")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();

  for (const access of accessRecords) {
    if (access.revokedAt !== undefined) {
      continue;
    }

    revokedUsers.push({
      userId: access.userId,
      permissionLevel: access.permissionLevel,
    });

    await ctx.db.patch(access._id, {
      revokedAt: now,
    });
  }

  if (revokedUsers.length > 0) {
    console.warn(
      JSON.stringify({
        topic: "sharing_cleanup",
        event: "document_access_revoked",
        documentId,
        reason,
        revokedCount: revokedUsers.length,
        revokedUserIds: revokedUsers.map((u) => u.userId),
        timestamp: now,
      }),
    );
  }

  return revokedUsers;
}

async function getOrganizationAdmin(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  excludeUserId?: Id<"users">,
): Promise<Id<"users"> | null> {
  const owner = await ctx.db
    .query("organization_members")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) =>
      q.and(
        q.eq(q.field("role"), "owner"),
        q.eq(q.field("status"), "active"),
        excludeUserId ? q.neq(q.field("userId"), excludeUserId) : true,
      ),
    )
    .first();

  if (owner) {
    return owner.userId;
  }

  const admin = await ctx.db
    .query("organization_members")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) =>
      q.and(
        q.eq(q.field("role"), "admin"),
        q.eq(q.field("status"), "active"),
        excludeUserId ? q.neq(q.field("userId"), excludeUserId) : true,
      ),
    )
    .first();

  return admin?.userId ?? null;
}

/**
 * Downgrade all sharing when subscription status changes to: canceled, past_due, incomplete_expired, unpaid.
 * Revokes all document_access records and sets sharingMode to 'private'.
 */
export const downgradeUserSharing = internalMutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const sharedDocuments = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .filter((q) =>
        q.and(q.neq(q.field("sharingMode"), "private"), q.neq(q.field("status"), "deleted")),
      )
      .collect();

    if (sharedDocuments.length === 0) {
      console.warn(`[downgradeUserSharing] No shared documents found for user ${args.userId}`);
      return { downgraded: 0, accessRevoked: 0 };
    }

    let totalAccessRevoked = 0;

    for (const document of sharedDocuments) {
      await ctx.db.patch(document._id, {
        sharingMode: "private",
        updatedAt: now,
      });

      const revokedUsers = await revokeAllDocumentAccess(ctx, document._id, args.reason);
      totalAccessRevoked += revokedUsers.length;

      for (const { userId } of revokedUsers) {
        await createNotification(ctx, {
          userId,
          organizationId: document.organizationId,
          type: "access_revoked",
          data: {
            documentId: document._id,
            documentName: document.name,
            reason: "subscription_lapsed",
            message: "Your access was revoked because the document owner's subscription ended",
          },
        });
      }
    }

    const user = await ctx.db.get(args.userId);
    if (user) {
      const membership = await ctx.db
        .query("organization_members")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("isPrimary"), true))
        .first();

      if (membership) {
        await createNotification(ctx, {
          userId: args.userId,
          organizationId: membership.organizationId,
          type: "sharing_disabled",
          data: {
            reason: args.reason,
            documentsAffected: sharedDocuments.length,
            message: `Sharing was disabled for ${sharedDocuments.length} document(s) due to subscription status change`,
          },
        });
      }
    }

    console.warn(
      JSON.stringify({
        topic: "sharing_cleanup",
        event: "user_sharing_downgraded",
        userId: args.userId,
        reason: args.reason,
        documentsDowngraded: sharedDocuments.length,
        accessRecordsRevoked: totalAccessRevoked,
        timestamp: now,
      }),
    );

    return {
      downgraded: sharedDocuments.length,
      accessRevoked: totalAccessRevoked,
    };
  },
});

/**
 * Downgrade all sharing for an entire organization when subscription lapses.
 * Revokes all document_access records and sets sharingMode to 'private' across all org documents.
 */
export const downgradeOrgSharing = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const sharedDocuments = await ctx.db
      .query("documents")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) =>
        q.and(q.neq(q.field("sharingMode"), "private"), q.neq(q.field("status"), "deleted")),
      )
      .collect();

    if (sharedDocuments.length === 0) {
      console.warn(
        `[downgradeOrgSharing] No shared documents found for org ${args.organizationId}`,
      );
      return { downgraded: 0, accessRevoked: 0 };
    }

    let totalAccessRevoked = 0;

    for (const document of sharedDocuments) {
      await ctx.db.patch(document._id, {
        sharingMode: "private",
        updatedAt: now,
      });

      const revokedUsers = await revokeAllDocumentAccess(ctx, document._id, args.reason);
      totalAccessRevoked += revokedUsers.length;

      for (const { userId } of revokedUsers) {
        await createNotification(ctx, {
          userId,
          organizationId: args.organizationId,
          type: "access_revoked",
          data: {
            documentId: document._id,
            documentName: document.name,
            reason: "subscription_lapsed",
            message:
              "Your access was revoked because the organization's subscription ended",
          },
        });
      }
    }

    const adminId = await getOrganizationAdmin(ctx, args.organizationId);
    if (adminId) {
      await createNotification(ctx, {
        userId: adminId,
        organizationId: args.organizationId,
        type: "sharing_disabled",
        data: {
          reason: args.reason,
          documentsAffected: sharedDocuments.length,
          message: `Sharing was disabled for ${sharedDocuments.length} document(s) due to subscription status change`,
        },
      });
    }

    console.warn(
      JSON.stringify({
        topic: "sharing_cleanup",
        event: "org_sharing_downgraded",
        organizationId: args.organizationId,
        reason: args.reason,
        documentsDowngraded: sharedDocuments.length,
        accessRecordsRevoked: totalAccessRevoked,
        timestamp: now,
      }),
    );

    return {
      downgraded: sharedDocuments.length,
      accessRevoked: totalAccessRevoked,
    };
  },
});

/**
 * Clean up document access when a member is removed from an organization.
 * Called from Clerk webhook for organizationMembership.deleted event.
 */
export const cleanupMemberDocumentAccess = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const userAccessRecords = await ctx.db
      .query("document_access")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const documentsToCheck = new Set<Id<"documents">>();
    for (const access of userAccessRecords) {
      if (access.revokedAt === undefined) {
        documentsToCheck.add(access.documentId);
      }
    }

    let revokedCount = 0;
    const notifiedOwners = new Set<string>();

    for (const documentId of documentsToCheck) {
      const document = await ctx.db.get(documentId);

      if (!document || document.organizationId !== args.organizationId) {
        continue;
      }

      const access = await ctx.db
        .query("document_access")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", documentId).eq("userId", args.userId),
        )
        .first();

      if (access && access.revokedAt === undefined) {
        await ctx.db.patch(access._id, {
          revokedAt: now,
        });
        revokedCount++;

        const ownerKey = document.ownerId.toString();
        if (!notifiedOwners.has(ownerKey) && document.ownerId !== args.userId) {
          notifiedOwners.add(ownerKey);

          const removedUser = await ctx.db.get(args.userId);
          await createNotification(ctx, {
            userId: document.ownerId,
            organizationId: args.organizationId,
            type: "bulk_access_revoked",
            data: {
              documentId,
              documentName: document.name,
              removedUserId: args.userId,
              removedUserName: removedUser?.name ?? undefined,
              removedUserEmail: removedUser?.email ?? "Unknown",
              reason: "member_removed_from_organization",
            },
          });
        }
      }
    }

    console.warn(
      JSON.stringify({
        topic: "sharing_cleanup",
        event: "member_access_cleanup",
        userId: args.userId,
        organizationId: args.organizationId,
        accessRecordsRevoked: revokedCount,
        ownersNotified: notifiedOwners.size,
        timestamp: now,
      }),
    );

    return { revokedCount, ownersNotified: notifiedOwners.size };
  },
});

/**
 * Transfer documents owned by a removed member to an organization admin.
 * Called after cleanupMemberDocumentAccess when a member is removed.
 */
export const transferOrphanedDocuments = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const newOwnerId = await getOrganizationAdmin(ctx, args.organizationId, args.userId);

    if (!newOwnerId) {
      console.error(
        JSON.stringify({
          topic: "sharing_cleanup",
          event: "transfer_failed_no_admin",
          userId: args.userId,
          organizationId: args.organizationId,
          error: "No organization admin found to transfer documents to",
          timestamp: now,
        }),
      );
      return { transferred: 0, error: "No organization admin found" };
    }

    const userDocuments = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("organizationId"), args.organizationId),
          q.neq(q.field("status"), "deleted"),
        ),
      )
      .collect();

    if (userDocuments.length === 0) {
      return { transferred: 0 };
    }

    const previousOwner = await ctx.db.get(args.userId);

    for (const document of userDocuments) {
      await ctx.db.patch(document._id, {
        ownerId: newOwnerId,
        updatedAt: now,
      });

      await createNotification(ctx, {
        userId: newOwnerId,
        organizationId: args.organizationId,
        type: "ownership_transferred",
        data: {
          documentId: document._id,
          documentName: document.name,
          previousOwnerId: args.userId,
          previousOwnerName: previousOwner?.name ?? undefined,
          reason: "member_removed_from_organization",
          message:
            "Document ownership was transferred to you because the previous owner was removed from the organization",
        },
      });
    }

    console.warn(
      JSON.stringify({
        topic: "sharing_cleanup",
        event: "documents_transferred",
        previousOwnerId: args.userId,
        newOwnerId,
        organizationId: args.organizationId,
        documentsTransferred: userDocuments.length,
        documentIds: userDocuments.map((d) => d._id),
        timestamp: now,
      }),
    );

    return { transferred: userDocuments.length, newOwnerId };
  },
});

/**
 * Full cleanup when a member is removed: revokes access and transfers documents.
 */
export const fullMemberRemovalCleanup = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const accessResult = await ctx.db
      .query("document_access")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let revokedCount = 0;
    const now = Date.now();

    for (const access of accessResult) {
      if (access.revokedAt !== undefined) {
        continue;
      }

      const document = await ctx.db.get(access.documentId);
      if (!document || document.organizationId !== args.organizationId) {
        continue;
      }

      await ctx.db.patch(access._id, { revokedAt: now });
      revokedCount++;
    }

    const newOwnerId = await getOrganizationAdmin(ctx, args.organizationId, args.userId);

    let transferredCount = 0;
    if (newOwnerId) {
      const userDocuments = await ctx.db
        .query("documents")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("organizationId"), args.organizationId),
            q.neq(q.field("status"), "deleted"),
          ),
        )
        .collect();

      const previousOwner = await ctx.db.get(args.userId);

      for (const document of userDocuments) {
        await ctx.db.patch(document._id, {
          ownerId: newOwnerId,
          updatedAt: now,
        });

        await createNotification(ctx, {
          userId: newOwnerId,
          organizationId: args.organizationId,
          type: "ownership_transferred",
          data: {
            documentId: document._id,
            documentName: document.name,
            previousOwnerId: args.userId,
            previousOwnerName: previousOwner?.name ?? undefined,
            reason: "member_removed_from_organization",
            message:
              "Document ownership was transferred to you because the previous owner was removed from the organization",
          },
        });

        transferredCount++;
      }
    }

    console.warn(
      JSON.stringify({
        topic: "sharing_cleanup",
        event: "full_member_removal_cleanup",
        userId: args.userId,
        organizationId: args.organizationId,
        accessRevoked: revokedCount,
        documentsTransferred: transferredCount,
        newOwnerId: newOwnerId ?? null,
        timestamp: now,
      }),
    );

    return {
      accessRevoked: revokedCount,
      documentsTransferred: transferredCount,
      newOwnerId,
    };
  },
});
