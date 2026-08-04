import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";
import { seedTestOrganizationMember } from "../testVortexAuth";

describe("Document Sharing - Database Operations", () => {
  let t: ReturnType<typeof createTestContext>;
  let ownerId: Id<"users">;
  let viewerId: Id<"users">;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;

  beforeEach(async () => {
    t = createTestContext();

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Owner User",
        authSubject: "owner_123",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
      });
    });

    viewerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "viewer@test.com",
        name: "Viewer User",
        authSubject: "viewer_456",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
      });
    });

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

    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId: ownerId,
        organizationId,
        role: "owner",
        status: "active",
      });
      await seedTestOrganizationMember(ctx, {
        userId: viewerId,
        organizationId,
        role: "member",
        status: "active",
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Document",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "test-storage-id",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  describe("document_access table operations", () => {
    test("can create access record for user", async () => {
      const accessId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_access", {
          documentId,
          userId: viewerId,
          permissionLevel: "view",
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });
      });

      const access = await t.run(async (ctx) => ctx.db.get(accessId));
      expect(access).not.toBeNull();
      expect(access?.permissionLevel).toBe("view");
      expect(access?.userId).toBe(viewerId);
    });

    test("can revoke access by setting revokedAt", async () => {
      const accessId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_access", {
          documentId,
          userId: viewerId,
          permissionLevel: "view",
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(accessId, { revokedAt: Date.now() });
      });

      const access = await t.run(async (ctx) => ctx.db.get(accessId));
      expect(access?.revokedAt).toBeDefined();
    });

    test("can update permission level", async () => {
      const accessId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_access", {
          documentId,
          userId: viewerId,
          permissionLevel: "view",
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(accessId, { permissionLevel: "edit" });
      });

      const access = await t.run(async (ctx) => ctx.db.get(accessId));
      expect(access?.permissionLevel).toBe("edit");
    });

    test("can query access by document and user index", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_access", {
          documentId,
          userId: viewerId,
          permissionLevel: "view",
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });
      });

      const access = await t.run(async (ctx) => {
        return ctx.db
          .query("document_access")
          .withIndex("by_document_user", (q) =>
            q.eq("documentId", documentId).eq("userId", viewerId)
          )
          .first();
      });

      expect(access).not.toBeNull();
      expect(access?.userId).toBe(viewerId);
    });

    test("can query all access records for a document", async () => {
      const thirdUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          email: "third@test.com",
          name: "Third User",
          authSubject: "third_789",
          isEmailVerified: true,
          timezone: "UTC",
          locale: "en-US",
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("document_access", {
          documentId,
          userId: viewerId,
          permissionLevel: "view",
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });
        await ctx.db.insert("document_access", {
          documentId,
          userId: thirdUserId,
          permissionLevel: "edit",
          grantedBy: ownerId,
          grantedAt: Date.now(),
        });
      });

      const accessRecords = await t.run(async (ctx) => {
        return ctx.db
          .query("document_access")
          .withIndex("by_document", (q) => q.eq("documentId", documentId))
          .collect();
      });

      expect(accessRecords).toHaveLength(2);
    });
  });

  describe("sharing mode", () => {
    test("document starts with private sharing mode", async () => {
      const doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.sharingMode).toBe("private");
    });

    test("can update sharing mode to specific", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { sharingMode: "specific" });
      });

      const doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.sharingMode).toBe("specific");
    });

    test("can update sharing mode to workspace", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { sharingMode: "workspace" });
      });

      const doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.sharingMode).toBe("workspace");
    });
  });

  describe("notifications", () => {
    test("can create document_shared notification", async () => {
      const notificationId = await t.run(async (ctx) => {
        return await ctx.db.insert("notifications", {
          userId: viewerId,
          organizationId,
          type: "document_shared",
          data: {
            documentId,
            documentName: "Test Document",
            permissionLevel: "view",
            sharedBy: ownerId,
          },
          read: false,
          createdAt: Date.now(),
        });
      });

      const notification = await t.run(async (ctx) =>
        ctx.db.get(notificationId)
      );
      expect(notification).not.toBeNull();
      expect(notification?.type).toBe("document_shared");
    });

    test("can create access_revoked notification", async () => {
      const notificationId = await t.run(async (ctx) => {
        return await ctx.db.insert("notifications", {
          userId: viewerId,
          organizationId,
          type: "access_revoked",
          data: {
            documentId,
            documentName: "Test Document",
            revokedBy: ownerId,
          },
          read: false,
          createdAt: Date.now(),
        });
      });

      const notification = await t.run(async (ctx) =>
        ctx.db.get(notificationId)
      );
      expect(notification).not.toBeNull();
      expect(notification?.type).toBe("access_revoked");
    });

    test("can create access_updated notification", async () => {
      const notificationId = await t.run(async (ctx) => {
        return await ctx.db.insert("notifications", {
          userId: viewerId,
          organizationId,
          type: "access_updated",
          data: {
            documentId,
            documentName: "Test Document",
            oldPermissionLevel: "view",
            newPermissionLevel: "edit",
            updatedBy: ownerId,
          },
          read: false,
          createdAt: Date.now(),
        });
      });

      const notification = await t.run(async (ctx) =>
        ctx.db.get(notificationId)
      );
      expect(notification).not.toBeNull();
      expect(notification?.type).toBe("access_updated");
    });

    test("can query notifications by user", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId: viewerId,
          organizationId,
          type: "document_shared",
          data: {
            documentId,
            documentName: "Test Document",
            permissionLevel: "view",
            sharedBy: ownerId,
          },
          read: false,
          createdAt: Date.now(),
        });
      });

      const notifications = await t.run(async (ctx) => {
        return ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", viewerId))
          .collect();
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.type).toBe("document_shared");
    });
  });
});
