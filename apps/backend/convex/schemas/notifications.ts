import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const notificationTypeTuple = v.union(
  v.literal("document_shared"),
  v.literal("access_revoked"),
  v.literal("access_updated"),
  v.literal("ownership_transferred"),
  v.literal("document_signed"),
  v.literal("document_completed"),
  v.literal("signature_requested"),
  v.literal("reminder"),
  v.literal("sharing_disabled"),
  v.literal("bulk_access_revoked")
);
export type NotificationType = Infer<typeof notificationTypeTuple>;

const baseNotificationData = {
  documentId: v.optional(v.id("documents")),
  documentName: v.optional(v.string()),
};

export const documentSharedData = v.object({
  ...baseNotificationData,
  permissionLevel: v.union(
    v.literal("view"),
    v.literal("edit"),
    v.literal("manage")
  ),
  sharedBy: v.id("users"),
  sharedByName: v.optional(v.string()),
});

export const accessRevokedData = v.object({
  ...baseNotificationData,
  revokedBy: v.optional(v.id("users")),
  revokedByName: v.optional(v.string()),
  reason: v.optional(v.string()),
  message: v.optional(v.string()),
});

export const accessUpdatedData = v.object({
  ...baseNotificationData,
  oldPermissionLevel: v.union(
    v.literal("view"),
    v.literal("edit"),
    v.literal("manage")
  ),
  newPermissionLevel: v.union(
    v.literal("view"),
    v.literal("edit"),
    v.literal("manage")
  ),
  updatedBy: v.id("users"),
  updatedByName: v.optional(v.string()),
});

export const ownershipTransferredData = v.object({
  ...baseNotificationData,
  previousOwnerId: v.id("users"),
  previousOwnerName: v.optional(v.string()),
  reason: v.optional(v.string()),
  message: v.optional(v.string()),
});

export const documentSignedData = v.object({
  ...baseNotificationData,
  signedBy: v.string(),
  recipientId: v.optional(v.id("document_recipients")),
  remainingSigners: v.number(),
});

export const documentCompletedData = v.object({
  ...baseNotificationData,
  totalSigners: v.number(),
});

export const signatureRequestedData = v.object({
  ...baseNotificationData,
  requestedBy: v.optional(v.id("users")),
  requestedByName: v.optional(v.string()),
  recipientId: v.optional(v.id("document_recipients")),
});

export const reminderData = v.object({
  ...baseNotificationData,
  reminderType: v.union(v.literal("sign"), v.literal("review")),
  dueDate: v.optional(v.number()),
});

export const sharingDisabledData = v.object({
  reason: v.string(),
  documentsAffected: v.number(),
  message: v.optional(v.string()),
});

export const bulkAccessRevokedData = v.object({
  ...baseNotificationData,
  reason: v.string(),
  message: v.optional(v.string()),
  removedUserId: v.optional(v.id("users")),
  removedUserName: v.optional(v.string()),
  removedUserEmail: v.optional(v.string()),
});

export const notificationDataTuple = v.union(
  documentSharedData,
  accessRevokedData,
  accessUpdatedData,
  ownershipTransferredData,
  documentSignedData,
  documentCompletedData,
  signatureRequestedData,
  reminderData,
  sharingDisabledData,
  bulkAccessRevokedData
);
export type NotificationData = Infer<typeof notificationDataTuple>;

export const emailStatusTuple = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("failed"),
  v.literal("not_applicable")
);
export type EmailStatus = Infer<typeof emailStatusTuple>;

export const notificationsTable = defineTable({
  userId: v.id("users"),
  organizationId: v.id("organizations"),
  type: notificationTypeTuple,
  data: notificationDataTuple,
  read: v.boolean(),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
  emailStatus: v.optional(emailStatusTuple),
  emailSentAt: v.optional(v.number()),
  emailAttempts: v.optional(v.number()),
  lastEmailError: v.optional(v.string()),
  emailMessageId: v.optional(v.string()), // Resend message ID for delivery tracking
})
  .index("by_user", ["userId"])
  .index("by_user_unread", ["userId", "read"])
  .index("by_user_created", ["userId", "createdAt"])
  .index("by_organization", ["organizationId"])
  .index("by_organization_user", ["organizationId", "userId"])
  .index("by_email_status", ["emailStatus"])
  .index("by_email_message_id", ["emailMessageId"]);
