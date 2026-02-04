import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { DatabaseWriter } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { authMutation, authQuery } from "../auth";
import type { EmailStatus, NotificationData, NotificationType } from "../schemas/notifications";
import { emailStatusTuple } from "../schemas/notifications";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const list = authQuery({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("notifications")),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;
    const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    let query = ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.unreadOnly) {
      query = ctx.db
        .query("notifications")
        .withIndex("by_user_unread", (q) => q.eq("userId", userId).eq("read", false))
        .order("desc");
    }

    const notifications = await query.take(limit + 1);

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1]?._id : undefined;

    return {
      items,
      nextCursor,
      hasMore,
    };
  },
});

export const getUnreadCount = authQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.user._id;

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", userId).eq("read", false))
      .collect();

    return unreadNotifications.length;
  },
});

export const markAsRead = authMutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      return { success: false, error: "Notification not found" };
    }

    if (notification.userId !== userId) {
      return { success: false, error: "Not authorized" };
    }

    if (notification.read) {
      return { success: true };
    }

    await ctx.db.patch(args.notificationId, {
      read: true,
      readAt: Date.now(),
    });

    return { success: true };
  },
});

export const markAllAsRead = authMutation({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.user._id;

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", userId).eq("read", false))
      .collect();

    const now = Date.now();
    await Promise.all(
      unreadNotifications.map((n) => ctx.db.patch(n._id, { read: true, readAt: now })),
    );

    return { success: true, count: unreadNotifications.length };
  },
});

export const deleteNotification = authMutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      return { success: false, error: "Notification not found" };
    }

    if (notification.userId !== userId) {
      return { success: false, error: "Not authorized" };
    }

    await ctx.db.delete(args.notificationId);
    return { success: true };
  },
});

export const clearAll = authMutation({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.user._id;

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    await Promise.all(notifications.map((n) => ctx.db.delete(n._id)));

    return { success: true, count: notifications.length };
  },
});

export async function createNotification(
  ctx: { db: DatabaseWriter },
  params: {
    userId: Id<"users">;
    organizationId: Id<"organizations">;
    type: NotificationType;
    data: NotificationData;
    emailStatus?: EmailStatus;
  },
): Promise<Id<"notifications">> {
  return await ctx.db.insert("notifications", {
    userId: params.userId,
    organizationId: params.organizationId,
    type: params.type,
    data: params.data,
    read: false,
    createdAt: Date.now(),
    emailStatus: params.emailStatus ?? "not_applicable",
    emailAttempts: params.emailStatus === "pending" ? 0 : undefined,
  });
}

const MAX_EMAIL_ATTEMPTS = 3;

export const updateEmailStatus = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    status: emailStatusTuple,
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      return { success: false, error: "Notification not found" };
    }

    const updates: {
      emailStatus: EmailStatus;
      emailSentAt?: number;
      emailAttempts?: number;
      lastEmailError?: string;
    } = {
      emailStatus: args.status,
    };

    if (args.status === "sent") {
      updates.emailSentAt = Date.now();
    }

    if (args.status === "failed") {
      updates.emailAttempts = (notification.emailAttempts ?? 0) + 1;
      updates.lastEmailError = args.error;
    }

    await ctx.db.patch(args.notificationId, updates);

    if (args.status === "failed" && (updates.emailAttempts ?? 0) < MAX_EMAIL_ATTEMPTS) {
      const delayMs = 2 ** (updates.emailAttempts ?? 1) * 60 * 1000;
      await ctx.scheduler.runAfter(delayMs, internal.notifications.index.retryEmailNotification, {
        notificationId: args.notificationId,
      });
    }

    return { success: true };
  },
});

export const retryEmailNotification = internalMutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      return { success: false, error: "Notification not found" };
    }

    if (notification.emailStatus !== "failed") {
      return { success: false, error: "Email already sent or not applicable" };
    }

    if ((notification.emailAttempts ?? 0) >= MAX_EMAIL_ATTEMPTS) {
      return { success: false, error: "Max retry attempts reached" };
    }

    if (notification.type !== "document_shared") {
      return {
        success: false,
        error: "Email retry only supported for document_shared",
      };
    }

    const data = notification.data as {
      documentId?: Id<"documents">;
      permissionLevel: "view" | "edit" | "manage";
      sharedBy: Id<"users">;
    };

    if (!data.documentId) {
      return { success: false, error: "Missing document ID" };
    }

    await ctx.scheduler.runAfter(
      0,
      internal.documents.document_shared_action.sendDocumentSharedEmail,
      {
        documentId: data.documentId,
        recipientUserId: notification.userId,
        sharedByUserId: data.sharedBy,
        permissionLevel: data.permissionLevel,
        notificationId: args.notificationId,
      },
    );

    return { success: true };
  },
});
