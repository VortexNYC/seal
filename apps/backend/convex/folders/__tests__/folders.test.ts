import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { seedTestOrganizationMember } from "../../testVortexAuth";

describe("Folders", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let adminUserId: Id<"users">;
  let ownerUserId: Id<"users">;
  let memberUserId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Folders Test Org",
        slug: "folders-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    adminUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@folders-test.com",
        name: "Admin User",
        authSubject: "folders_admin",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    ownerUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@folders-test.com",
        name: "Owner User",
        authSubject: "folders_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    memberUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "member@folders-test.com",
        name: "Member User",
        authSubject: "folders_member",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    // Admin membership
    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId: adminUserId,
        organizationId,
        role: "admin",
        status: "active",
      });
    });

    // Owner membership
    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId: ownerUserId,
        organizationId,
        role: "owner",
        status: "active",
      });
    });

    // Member membership
    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId: memberUserId,
        organizationId,
        role: "member",
        status: "active",
      });
    });
  });

  // =========================================================================
  // createFolder
  // =========================================================================

  describe("createFolder", () => {
    test("creates a root folder", async () => {
      const result = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Contracts",
          type: "document",
        });

      expect(result.id).toBeDefined();

      const folder = (await t.run(async (ctx) => {
        return await ctx.db.get(result.id);
      })) as Doc<"folders"> | null;

      expect(folder).not.toBeNull();
      expect(folder!.name).toBe("Contracts");
      expect(folder!.type).toBe("document");
      expect(folder!.parentId).toBeUndefined();
      expect(folder!.visibility).toBe("everyone");
      expect(folder!.organizationId).toEqual(organizationId);
    });

    test("creates a nested folder", async () => {
      const parent = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Parent",
          type: "document",
        });

      const child = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Child",
          type: "document",
          parentId: parent.id,
        });

      const childFolder = (await t.run(async (ctx) => {
        return await ctx.db.get(child.id);
      })) as Doc<"folders"> | null;

      expect(childFolder!.parentId).toEqual(parent.id);
    });

    test("rejects empty name", async () => {
      await expect(
        t.withIdentity({ subject: "folders_admin" }).mutation(api.folders.mutations.createFolder, {
          name: "   ",
          type: "document",
        }),
      ).rejects.toThrow("Folder name cannot be empty");
    });

    test("rejects nesting that exceeds MAX_FOLDER_DEPTH - 1", async () => {
      // getAncestorDepth walks the ancestor chain from parentId, incrementing depth.
      // It throws when depth > maxDepth (where maxDepth = MAX_FOLDER_DEPTH - 1 = 9).
      // Build a chain of 10 nested folders (the 10th still succeeds because
      // its parent chain is 9 deep, and 9 > 9 is false).
      let currentParentId: Id<"folders"> | undefined;
      for (let i = 1; i <= 10; i++) {
        const result = await t
          .withIdentity({ subject: "folders_admin" })
          .mutation(api.folders.mutations.createFolder, {
            name: `Level ${i}`,
            type: "document",
            parentId: currentParentId,
          });
        currentParentId = result.id;
      }

      // The 11th nested folder should fail (ancestor depth = 10, and 10 > 9 is true)
      await expect(
        t.withIdentity({ subject: "folders_admin" }).mutation(api.folders.mutations.createFolder, {
          name: "Level 11",
          type: "document",
          parentId: currentParentId,
        }),
      ).rejects.toThrow("Folder nesting cannot exceed");
    });

    test("rejects parent type mismatch", async () => {
      const parent = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Doc Folder",
          type: "document",
        });

      await expect(
        t.withIdentity({ subject: "folders_admin" }).mutation(api.folders.mutations.createFolder, {
          name: "Template Child",
          type: "template",
          parentId: parent.id,
        }),
      ).rejects.toThrow("Parent folder type must match");
    });
  });

  // =========================================================================
  // updateFolder
  // =========================================================================

  describe("updateFolder", () => {
    test("renames a folder", async () => {
      const { id: folderId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Old Name",
          type: "document",
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.updateFolder, {
          folderId,
          name: "New Name",
        });

      const folder = (await t.run(async (ctx) => {
        return await ctx.db.get(folderId);
      })) as Doc<"folders"> | null;

      expect(folder!.name).toBe("New Name");
    });

    test("changes visibility", async () => {
      const { id: folderId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Folder",
          type: "document",
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.updateFolder, {
          folderId,
          visibility: "admin",
        });

      const folder = (await t.run(async (ctx) => {
        return await ctx.db.get(folderId);
      })) as Doc<"folders"> | null;

      expect(folder!.visibility).toBe("admin");
    });
  });

  // =========================================================================
  // deleteFolder
  // =========================================================================

  describe("deleteFolder", () => {
    test("deletes folder and its children recursively", async () => {
      const { id: parentId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Parent",
          type: "document",
        });

      const { id: childId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Child",
          type: "document",
          parentId,
        });

      const { id: grandchildId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Grandchild",
          type: "document",
          parentId: childId,
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.deleteFolder, {
          folderId: parentId,
        });

      const parent = await t.run(async (ctx) => ctx.db.get(parentId));
      const child = await t.run(async (ctx) => ctx.db.get(childId));
      const grandchild = await t.run(async (ctx) => ctx.db.get(grandchildId));

      expect(parent).toBeNull();
      expect(child).toBeNull();
      expect(grandchild).toBeNull();
    });

    test("orphans documents and templates to root when folder is deleted", async () => {
      const { id: folderId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "To Delete",
          type: "document",
        });

      // Insert a document directly into the folder
      const docId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          organizationId,
          ownerId: adminUserId,
          name: "Test Doc",
          fileSize: 1024,
          fileType: "application/pdf",
          storageId: "fake_storage_id",
          sharingMode: "private",
          status: "active",
          folderId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Insert a template directly into a template folder
      const { id: templateFolderId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Template Folder",
          type: "template",
        });

      const templateId = await t.run(async (ctx) => {
        return await ctx.db.insert("templates", {
          organizationId,
          createdBy: adminUserId,
          name: "Test Template",
          storageId: "fake_storage_id",
          fileSize: 512,
          fileType: "application/pdf",
          useCount: 0,
          status: "active",
          folderId: templateFolderId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Delete the document folder
      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.deleteFolder, {
          folderId,
        });

      // Delete the template folder
      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.deleteFolder, {
          folderId: templateFolderId,
        });

      // Verify document and template are orphaned to root
      const doc = await t.run(async (ctx) => ctx.db.get(docId));
      const template = await t.run(async (ctx) => ctx.db.get(templateId));

      expect(doc).not.toBeNull();
      expect(doc!.folderId).toBeUndefined();
      expect(template).not.toBeNull();
      expect(template!.folderId).toBeUndefined();
    });
  });

  // =========================================================================
  // moveToFolder
  // =========================================================================

  describe("moveToFolder", () => {
    test("moves folder to a new parent", async () => {
      const { id: folderA } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Folder A",
          type: "document",
        });

      const { id: folderB } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Folder B",
          type: "document",
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.moveToFolder, {
          folderId: folderA,
          newParentId: folderB,
        });

      const moved = (await t.run(async (ctx) => ctx.db.get(folderA))) as Doc<"folders"> | null;
      expect(moved!.parentId).toEqual(folderB);
    });

    test("moves folder to root", async () => {
      const { id: parentId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Parent",
          type: "document",
        });

      const { id: childId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Child",
          type: "document",
          parentId,
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.moveToFolder, {
          folderId: childId,
          // newParentId omitted = move to root
        });

      const moved = (await t.run(async (ctx) => ctx.db.get(childId))) as Doc<"folders"> | null;
      expect(moved!.parentId).toBeUndefined();
    });

    test("rejects circular reference", async () => {
      const { id: parentId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Parent",
          type: "document",
        });

      const { id: childId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Child",
          type: "document",
          parentId,
        });

      await expect(
        t.withIdentity({ subject: "folders_admin" }).mutation(api.folders.mutations.moveToFolder, {
          folderId: parentId,
          newParentId: childId,
        }),
      ).rejects.toThrow("Cannot move a folder into its own descendant");
    });

    test("rejects depth overflow after move", async () => {
      // Create a deep chain: root -> L1 -> L2 -> ... -> L8 (8 levels deep, depth=8)
      let deepParentId: Id<"folders"> | undefined;
      for (let i = 1; i <= 8; i++) {
        const result = await t
          .withIdentity({ subject: "folders_admin" })
          .mutation(api.folders.mutations.createFolder, {
            name: `Deep ${i}`,
            type: "document",
            parentId: deepParentId,
          });
        deepParentId = result.id;
      }

      // Create a separate chain: A -> B (subtree depth = 1)
      const { id: folderA } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "A",
          type: "document",
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "B",
          type: "document",
          parentId: folderA,
        });

      // Moving A (subtreeDepth=1) under deepParentId (ancestor depth=8)
      // newDepth = 8 + 1 = 9, subtreeDepth = 1, total = 9 + 1 + 1 = 11 > 10
      await expect(
        t.withIdentity({ subject: "folders_admin" }).mutation(api.folders.mutations.moveToFolder, {
          folderId: folderA,
          newParentId: deepParentId,
        }),
      ).rejects.toThrow("Move would exceed maximum nesting depth");
    });
  });

  // =========================================================================
  // moveItemsToFolder
  // =========================================================================

  describe("moveItemsToFolder", () => {
    test("moves documents to a folder", async () => {
      const { id: folderId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Target",
          type: "document",
        });

      const docId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          organizationId,
          ownerId: adminUserId,
          name: "Move Me",
          fileSize: 1024,
          fileType: "application/pdf",
          storageId: "fake_storage_id",
          sharingMode: "private",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.moveItemsToFolder, {
          itemIds: [docId],
          itemType: "document",
          targetFolderId: folderId,
        });

      expect(result.moved).toBe(1);

      const doc = await t.run(async (ctx) => ctx.db.get(docId));
      expect(doc!.folderId).toEqual(folderId);
    });

    test("rejects type mismatch (document into template folder)", async () => {
      const { id: templateFolderId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Template Folder",
          type: "template",
        });

      const docId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          organizationId,
          ownerId: adminUserId,
          name: "A Doc",
          fileSize: 1024,
          fileType: "application/pdf",
          storageId: "fake_storage_id",
          sharingMode: "private",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t
          .withIdentity({ subject: "folders_admin" })
          .mutation(api.folders.mutations.moveItemsToFolder, {
            itemIds: [docId],
            itemType: "document",
            targetFolderId: templateFolderId,
          }),
      ).rejects.toThrow("Cannot move documents into a template folder");
    });

    test("skips items from different organization", async () => {
      const otherOrgId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Other Org",
          slug: "other-org",
          type: "company",
          isActive: true,
          timezone: "UTC",
          updatedAt: Date.now(),
        });
      });

      const otherDocId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          organizationId: otherOrgId,
          ownerId: adminUserId,
          name: "Other Doc",
          fileSize: 512,
          fileType: "application/pdf",
          storageId: "fake_storage_id_2",
          sharingMode: "private",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { id: folderId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "My Folder",
          type: "document",
        });

      const result = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.moveItemsToFolder, {
          itemIds: [otherDocId],
          itemType: "document",
          targetFolderId: folderId,
        });

      // Should skip since the doc belongs to a different org
      expect(result.moved).toBe(0);
    });
  });

  // =========================================================================
  // togglePinFolder
  // =========================================================================

  describe("togglePinFolder", () => {
    test("toggles pinned state", async () => {
      const { id: folderId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Pin Me",
          type: "document",
        });

      // First toggle: should pin
      const result1 = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.togglePinFolder, {
          folderId,
        });
      expect(result1.pinned).toBe(true);

      // Second toggle: should unpin
      const result2 = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.togglePinFolder, {
          folderId,
        });
      expect(result2.pinned).toBe(false);
    });
  });

  // =========================================================================
  // listFolders
  // =========================================================================

  describe("listFolders", () => {
    test("returns root folders", async () => {
      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Root A",
          type: "document",
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Root B",
          type: "document",
        });

      const folders = await t
        .withIdentity({ subject: "folders_admin" })
        .query(api.folders.queries.listFolders, {
          organizationId,
          type: "document",
        });

      expect(folders.length).toBe(2);
      expect(folders.map((f: (typeof folders)[number]) => f.name)).toContain("Root A");
      expect(folders.map((f: (typeof folders)[number]) => f.name)).toContain("Root B");
    });

    test("returns child folders for a given parent", async () => {
      const { id: parentId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Parent",
          type: "document",
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Child 1",
          type: "document",
          parentId,
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Child 2",
          type: "document",
          parentId,
        });

      const children = await t
        .withIdentity({ subject: "folders_admin" })
        .query(api.folders.queries.listFolders, {
          organizationId,
          type: "document",
          parentId,
        });

      expect(children.length).toBe(2);
      expect(children.map((f: (typeof children)[number]) => f.name)).toEqual(
        expect.arrayContaining(["Child 1", "Child 2"]),
      );
    });

    test("filters admin-only folders from members", async () => {
      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Public Folder",
          type: "document",
          visibility: "everyone",
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Admin Folder",
          type: "document",
          visibility: "admin",
        });

      // Member should only see the "everyone" folder
      const memberFolders = await t
        .withIdentity({ subject: "folders_member" })
        .query(api.folders.queries.listFolders, {
          organizationId,
          type: "document",
        });

      expect(memberFolders.length).toBe(1);
      expect(memberFolders[0].name).toBe("Public Folder");

      // Admin should see both
      const adminFolders = await t
        .withIdentity({ subject: "folders_admin" })
        .query(api.folders.queries.listFolders, {
          organizationId,
          type: "document",
        });

      expect(adminFolders.length).toBe(2);
    });

    test("sorts pinned folders first, then alphabetical", async () => {
      const { id: folderZ } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Zebra",
          type: "document",
        });

      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Apple",
          type: "document",
        });

      // Pin Zebra
      await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.togglePinFolder, {
          folderId: folderZ,
        });

      const folders = await t
        .withIdentity({ subject: "folders_admin" })
        .query(api.folders.queries.listFolders, {
          organizationId,
          type: "document",
        });

      // Pinned first, then alphabetical
      expect(folders[0].name).toBe("Zebra");
      expect(folders[1].name).toBe("Apple");
    });
  });

  // =========================================================================
  // getFolderBreadcrumbs
  // =========================================================================

  describe("getFolderBreadcrumbs", () => {
    test("returns correct breadcrumb chain", async () => {
      const { id: grandparentId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Grandparent",
          type: "document",
        });

      const { id: parentId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Parent",
          type: "document",
          parentId: grandparentId,
        });

      const { id: childId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Child",
          type: "document",
          parentId,
        });

      const breadcrumbs = await t
        .withIdentity({ subject: "folders_admin" })
        .query(api.folders.queries.getFolderBreadcrumbs, {
          folderId: childId,
        });

      expect(breadcrumbs.length).toBe(3);
      expect(breadcrumbs[0].name).toBe("Grandparent");
      expect(breadcrumbs[1].name).toBe("Parent");
      expect(breadcrumbs[2].name).toBe("Child");
      expect(breadcrumbs[0].id).toBe(grandparentId);
    });

    test("returns single entry for root folder", async () => {
      const { id: rootId } = await t
        .withIdentity({ subject: "folders_admin" })
        .mutation(api.folders.mutations.createFolder, {
          name: "Root",
          type: "document",
        });

      const breadcrumbs = await t
        .withIdentity({ subject: "folders_admin" })
        .query(api.folders.queries.getFolderBreadcrumbs, {
          folderId: rootId,
        });

      expect(breadcrumbs.length).toBe(1);
      expect(breadcrumbs[0].name).toBe("Root");
    });
  });
});
