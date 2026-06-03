import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("Notifications mutations", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;
  let notificationIds: Id<"notifications">[];

  beforeEach(async () => {
    t = createTestContext();
    notificationIds = [];

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Test Owner",
        authSubject: "test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("organization_members", {
        userId: ownerId,
        organizationId,
        role: "owner",
        status: "active",
        isPrimary: true,
      });
    });

    // Create 3 notifications: 2 unread, 1 read
    const now = Date.now();

    const id1 = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        userId: ownerId,
        organizationId,
        type: "document_signed",
        data: {
          signedBy: "signer@test.com",
          remainingSigners: 1,
        },
        read: false,
        createdAt: now - 3000,
      });
    });

    const id2 = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        userId: ownerId,
        organizationId,
        type: "document_signed",
        data: {
          signedBy: "signer2@test.com",
          remainingSigners: 0,
        },
        read: true,
        readAt: now - 1000,
        createdAt: now - 2000,
      });
    });

    const id3 = await t.run(async (ctx) => {
      return await ctx.db.insert("notifications", {
        userId: ownerId,
        organizationId,
        type: "document_completed",
        data: {
          totalSigners: 2,
        },
        read: false,
        createdAt: now - 1000,
      });
    });

    notificationIds = [id1, id2, id3];
  });

  describe("list", () => {
    test("returns all notifications for the user ordered by createdAt desc", async () => {
      const result = await t
        .withIdentity({ subject: "test_owner" })
        .query(api.notifications.index.list, {});

      expect(result.items).toHaveLength(3);
      // Verify descending order by createdAt
      for (let i = 0; i < result.items.length - 1; i++) {
        expect(result.items[i]!.createdAt).toBeGreaterThanOrEqual(result.items[i + 1]!.createdAt);
      }
    });

    test("respects limit parameter", async () => {
      const result = await t
        .withIdentity({ subject: "test_owner" })
        .query(api.notifications.index.list, { limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    test("filters to unread only when unreadOnly is true", async () => {
      const result = await t
        .withIdentity({ subject: "test_owner" })
        .query(api.notifications.index.list, { unreadOnly: true });

      expect(result.items).toHaveLength(2);
      for (const item of result.items) {
        expect(item.read).toBe(false);
      }
    });

    test("rejects unauthenticated requests", async () => {
      await expect(t.query(api.notifications.index.list, {})).rejects.toThrow();
    });
  });

  describe("getUnreadCount", () => {
    test("returns correct count of unread notifications", async () => {
      const count = await t
        .withIdentity({ subject: "test_owner" })
        .query(api.notifications.index.getUnreadCount, {});

      expect(count).toBe(2);
    });

    test("returns 0 when all are read", async () => {
      // Mark all as read
      await t.run(async (ctx) => {
        const now = Date.now();
        for (const id of notificationIds) {
          await ctx.db.patch(id, { read: true, readAt: now });
        }
      });

      const count = await t
        .withIdentity({ subject: "test_owner" })
        .query(api.notifications.index.getUnreadCount, {});

      expect(count).toBe(0);
    });
  });

  describe("markAsRead", () => {
    test("marks notification as read and sets readAt", async () => {
      const unreadId = notificationIds[0]!;

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.markAsRead, {
          notificationId: unreadId,
        });

      expect(result).toEqual({ success: true });

      const notification = await t.run(async (ctx) => {
        return await ctx.db.get(unreadId);
      });

      expect(notification?.read).toBe(true);
      expect(notification?.readAt).toBeDefined();
      expect(typeof notification?.readAt).toBe("number");
    });

    test("returns success true for already-read notification (idempotent)", async () => {
      const readId = notificationIds[1]!;

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.markAsRead, {
          notificationId: readId,
        });

      expect(result).toEqual({ success: true });
    });

    test("returns error for non-existent notification", async () => {
      // Delete a notification to get a valid-format but non-existent ID
      const idToDelete = notificationIds[0]!;
      await t.run(async (ctx) => {
        await ctx.db.delete(idToDelete);
      });

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.markAsRead, {
          notificationId: idToDelete,
        });

      expect(result).toEqual({
        success: false,
        error: "Notification not found",
      });
    });

    test("returns error when trying to mark another user's notification", async () => {
      // Create second user and their notification
      const otherNotificationId = await t.run(async (ctx) => {
        const otherUserId = await ctx.db.insert("users", {
          email: "other@test.com",
          name: "Other User",
          authSubject: "test_other",
          isEmailVerified: true,
          timezone: "UTC",
          locale: "en-US",
          activeOrganizationId: organizationId,
        });

        await ctx.db.insert("organization_members", {
          userId: otherUserId,
          organizationId,
          role: "member",
          status: "active",
          isPrimary: false,
        });

        return await ctx.db.insert("notifications", {
          userId: otherUserId,
          organizationId,
          type: "document_signed",
          data: {
            signedBy: "someone@test.com",
            remainingSigners: 0,
          },
          read: false,
          createdAt: Date.now(),
        });
      });

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.markAsRead, {
          notificationId: otherNotificationId,
        });

      expect(result).toEqual({ success: false, error: "Not authorized" });
    });
  });

  describe("markAllAsRead", () => {
    test("marks all unread notifications as read and returns count", async () => {
      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.markAllAsRead, {});

      expect(result).toEqual({ success: true, count: 2 });

      // Verify all notifications are now read
      const unreadCount = await t
        .withIdentity({ subject: "test_owner" })
        .query(api.notifications.index.getUnreadCount, {});

      expect(unreadCount).toBe(0);
    });

    test("returns count 0 when none are unread", async () => {
      // Mark all as read first
      await t.run(async (ctx) => {
        const now = Date.now();
        for (const id of notificationIds) {
          await ctx.db.patch(id, { read: true, readAt: now });
        }
      });

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.markAllAsRead, {});

      expect(result).toEqual({ success: true, count: 0 });
    });
  });

  describe("deleteNotification", () => {
    test("deletes the notification", async () => {
      const idToDelete = notificationIds[0]!;

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.deleteNotification, {
          notificationId: idToDelete,
        });

      expect(result).toEqual({ success: true });

      const deleted = await t.run(async (ctx) => {
        return await ctx.db.get(idToDelete);
      });

      expect(deleted).toBeNull();
    });

    test("returns error for another user's notification", async () => {
      const otherNotificationId = await t.run(async (ctx) => {
        const otherUserId = await ctx.db.insert("users", {
          email: "other@test.com",
          name: "Other User",
          authSubject: "test_other",
          isEmailVerified: true,
          timezone: "UTC",
          locale: "en-US",
          activeOrganizationId: organizationId,
        });

        await ctx.db.insert("organization_members", {
          userId: otherUserId,
          organizationId,
          role: "member",
          status: "active",
          isPrimary: false,
        });

        return await ctx.db.insert("notifications", {
          userId: otherUserId,
          organizationId,
          type: "document_signed",
          data: {
            signedBy: "someone@test.com",
            remainingSigners: 0,
          },
          read: false,
          createdAt: Date.now(),
        });
      });

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.deleteNotification, {
          notificationId: otherNotificationId,
        });

      expect(result).toEqual({ success: false, error: "Not authorized" });

      // Verify the notification still exists
      const stillExists = await t.run(async (ctx) => {
        return await ctx.db.get(otherNotificationId);
      });

      expect(stillExists).not.toBeNull();
    });
  });

  describe("clearAll", () => {
    test("deletes all notifications for the user and returns count", async () => {
      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.clearAll, {});

      expect(result).toEqual({ success: true, count: 3 });

      // Verify no notifications remain for this user
      const remaining = await t
        .withIdentity({ subject: "test_owner" })
        .query(api.notifications.index.list, {});

      expect(remaining.items).toHaveLength(0);
    });

    test("does not delete another user's notifications", async () => {
      const otherNotificationId = await t.run(async (ctx) => {
        const otherUserId = await ctx.db.insert("users", {
          email: "other@test.com",
          name: "Other User",
          authSubject: "test_other",
          isEmailVerified: true,
          timezone: "UTC",
          locale: "en-US",
          activeOrganizationId: organizationId,
        });

        await ctx.db.insert("organization_members", {
          userId: otherUserId,
          organizationId,
          role: "member",
          status: "active",
          isPrimary: false,
        });

        return await ctx.db.insert("notifications", {
          userId: otherUserId,
          organizationId,
          type: "document_signed",
          data: {
            signedBy: "someone@test.com",
            remainingSigners: 0,
          },
          read: false,
          createdAt: Date.now(),
        });
      });

      // Clear all for the owner
      await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.clearAll, {});

      // Verify the other user's notification still exists
      const otherNotification = await t.run(async (ctx) => {
        return await ctx.db.get(otherNotificationId);
      });

      expect(otherNotification).not.toBeNull();
    });

    test("returns count 0 when user has no notifications", async () => {
      // Clear all first
      await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.clearAll, {});

      // Clear again
      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.notifications.index.clearAll, {});

      expect(result).toEqual({ success: true, count: 0 });
    });
  });
});
