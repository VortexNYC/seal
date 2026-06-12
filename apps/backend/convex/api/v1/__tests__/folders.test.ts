import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/folders", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  async function seedFolder(overrides: {
    name: string;
    type?: "document" | "template";
    parentId?: Id<"folders">;
    visibility?: "everyone" | "admin";
    pinned?: boolean;
    organizationId?: Id<"organizations">;
  }) {
    const orgId = overrides.organizationId ?? organizationId;
    const now = BASE_TIME;

    return t.run(async (ctx) => {
      return await ctx.db.insert("folders", {
        organizationId: orgId,
        name: overrides.name,
        type: overrides.type ?? "document",
        parentId: overrides.parentId,
        visibility: overrides.visibility ?? "everyone",
        pinned: overrides.pinned,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Folders API Org",
        slug: "folders-api-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-folders",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@folders-api.com",
        name: "Owner",
        authSubject: "folders_api_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // listFolders
  // =========================================================================

  describe("listFolders", () => {
    test("returns empty list when no folders exist", async () => {
      const result = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
      });

      expect(result.folders).toHaveLength(0);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeUndefined();
    });

    test("returns folders for the org", async () => {
      await seedFolder({ name: "Contracts" });
      await seedFolder({ name: "Invoices" });
      await seedFolder({ name: "Other Org Folder", organizationId: otherOrgId });

      const result = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
      });

      expect(result.folders).toHaveLength(2);
    });

    test("returns full folder fields", async () => {
      await seedFolder({
        name: "Templates",
        type: "template",
        visibility: "admin",
        pinned: true,
      });

      const result = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
      });

      const folder = result.folders[0];
      expect(folder?.name).toBe("Templates");
      expect(folder?.type).toBe("template");
      expect(folder?.visibility).toBe("admin");
      expect(folder?.pinned).toBe(true);
      expect(folder?.id).toBeDefined();
      expect(folder?.created_at).toBeDefined();
      expect(folder?.updated_at).toBeDefined();
      expect(folder?.created_by).toBe(userId);
    });

    test("filters by type", async () => {
      await seedFolder({ name: "Docs Folder", type: "document" });
      await seedFolder({ name: "Template Folder", type: "template" });

      const result = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
        type: "template",
      });

      expect(result.folders).toHaveLength(1);
      expect(result.folders[0]?.name).toBe("Template Folder");
    });

    test("searches by name (case-insensitive)", async () => {
      await seedFolder({ name: "Contracts" });
      await seedFolder({ name: "Invoices" });
      await seedFolder({ name: "Templates" });

      const result = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
        search: "contracts",
      });

      expect(result.folders).toHaveLength(1);
      expect(result.folders[0]?.name).toBe("Contracts");
    });

    test("respects limit and returns has_more=true", async () => {
      for (let i = 0; i < 5; i++) {
        await seedFolder({ name: `Folder ${i}` });
      }

      const result = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(result.folders).toHaveLength(2);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBeDefined();
    });

    test("cursor pagination returns next page without overlap", async () => {
      for (let i = 0; i < 5; i++) {
        await seedFolder({ name: `Folder ${i}` });
      }

      const page1 = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(page1.folders).toHaveLength(2);

      const page2 = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
        limit: 2,
        cursor: page1.next_cursor,
      });

      expect(page2.folders).toHaveLength(2);
      const page1Ids = new Set(page1.folders.map((f) => f.id));
      for (const f of page2.folders) {
        expect(page1Ids.has(f.id)).toBe(false);
      }
    });

    test("caps limit at 100", async () => {
      const result = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
        limit: 500,
      });

      expect(result.folders).toHaveLength(0);
      expect(result.has_more).toBe(false);
    });

    test("filters by parentId when type is also specified", async () => {
      const parentId = await seedFolder({ name: "Parent" });
      await seedFolder({ name: "Child", parentId, type: "document" });
      await seedFolder({ name: "Unrelated" });

      const result = await t.query(internal.api.v1.folders.listFolders, {
        userId,
        organizationId,
        type: "document",
        parentId,
      });

      expect(result.folders).toHaveLength(1);
      expect(result.folders[0]?.name).toBe("Child");
    });
  });

  // =========================================================================
  // getFolder
  // =========================================================================

  describe("getFolder", () => {
    test("returns folder by ID", async () => {
      const folderId = await seedFolder({ name: "Contracts" });

      const result = await t.query(internal.api.v1.folders.getFolder, {
        userId,
        organizationId,
        folderId,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(folderId);
      expect(result?.name).toBe("Contracts");
    });

    test("returns null for folder in different org", async () => {
      const folderId = await seedFolder({
        name: "Other Org Folder",
        organizationId: otherOrgId,
      });

      const result = await t.query(internal.api.v1.folders.getFolder, {
        userId,
        organizationId,
        folderId,
      });

      expect(result).toBeNull();
    });

    test("returns null for non-existent folder", async () => {
      // Create and delete a folder to get a valid but non-existent ID
      const folderId = await seedFolder({ name: "Temporary" });
      await t.mutation(internal.api.v1.folders.deleteFolder, {
        userId,
        organizationId,
        folderId,
      });

      const result = await t.query(internal.api.v1.folders.getFolder, {
        userId,
        organizationId,
        folderId,
      });

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // createFolder
  // =========================================================================

  describe("createFolder", () => {
    test("creates folder with required fields", async () => {
      const result = await t.mutation(internal.api.v1.folders.createFolder, {
        userId,
        organizationId,
        name: "Contracts",
        type: "document",
      });

      expect(result.id).toBeDefined();

      const folder = await t.query(internal.api.v1.folders.getFolder, {
        userId,
        organizationId,
        folderId: result.id as Id<"folders">,
      });

      expect(folder?.name).toBe("Contracts");
      expect(folder?.type).toBe("document");
      expect(folder?.visibility).toBe("everyone");
      expect(folder?.parent_id).toBeUndefined();
    });

    test("creates folder with optional fields", async () => {
      const parentId = await seedFolder({ name: "Parent" });

      const result = await t.mutation(internal.api.v1.folders.createFolder, {
        userId,
        organizationId,
        name: "Child Folder",
        type: "template",
        parent_id: parentId,
        visibility: "admin",
      });

      const folder = await t.query(internal.api.v1.folders.getFolder, {
        userId,
        organizationId,
        folderId: result.id as Id<"folders">,
      });

      expect(folder?.name).toBe("Child Folder");
      expect(folder?.type).toBe("template");
      expect(folder?.visibility).toBe("admin");
      expect(folder?.parent_id).toBe(parentId);
    });

    test("throws when parent folder belongs to different org", async () => {
      const otherParentId = await seedFolder({
        name: "Other Parent",
        organizationId: otherOrgId,
      });

      await expect(
        t.mutation(internal.api.v1.folders.createFolder, {
          userId,
          organizationId,
          name: "Bad Child",
          type: "document",
          parent_id: otherParentId,
        }),
      ).rejects.toThrow("Parent folder not found");
    });
  });

  // =========================================================================
  // updateFolder
  // =========================================================================

  describe("updateFolder", () => {
    test("updates folder name", async () => {
      const folderId = await seedFolder({ name: "Old Name" });

      const result = await t.mutation(internal.api.v1.folders.updateFolder, {
        userId,
        organizationId,
        folderId,
        name: "New Name",
      });

      expect(result.success).toBe(true);

      const folder = await t.query(internal.api.v1.folders.getFolder, {
        userId,
        organizationId,
        folderId,
      });

      expect(folder?.name).toBe("New Name");
    });

    test("updates folder visibility", async () => {
      const folderId = await seedFolder({ name: "Shared", visibility: "everyone" });

      const result = await t.mutation(internal.api.v1.folders.updateFolder, {
        userId,
        organizationId,
        folderId,
        visibility: "admin",
      });

      expect(result.success).toBe(true);

      const folder = await t.query(internal.api.v1.folders.getFolder, {
        userId,
        organizationId,
        folderId,
      });

      expect(folder?.visibility).toBe("admin");
    });

    test("returns error for folder in different org", async () => {
      const folderId = await seedFolder({
        name: "Other Folder",
        organizationId: otherOrgId,
      });

      const result = await t.mutation(internal.api.v1.folders.updateFolder, {
        userId,
        organizationId,
        folderId,
        name: "Renamed",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Folder not found");
    });

    test("prevents self-referencing parent", async () => {
      const folderId = await seedFolder({ name: "Self" });

      const result = await t.mutation(internal.api.v1.folders.updateFolder, {
        userId,
        organizationId,
        folderId,
        parent_id: folderId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("A folder cannot be its own parent");
    });

    test("updates pinned status", async () => {
      const folderId = await seedFolder({ name: "Pin Test", pinned: false });

      const result = await t.mutation(internal.api.v1.folders.updateFolder, {
        userId,
        organizationId,
        folderId,
        pinned: true,
      });

      expect(result.success).toBe(true);

      const folder = await t.query(internal.api.v1.folders.getFolder, {
        userId,
        organizationId,
        folderId,
      });

      expect(folder?.pinned).toBe(true);
    });
  });

  // =========================================================================
  // deleteFolder
  // =========================================================================

  describe("deleteFolder", () => {
    test("deletes an existing folder", async () => {
      const folderId = await seedFolder({ name: "Delete Me" });

      const result = await t.mutation(internal.api.v1.folders.deleteFolder, {
        userId,
        organizationId,
        folderId,
      });

      expect(result.success).toBe(true);

      const deleted = await t.query(internal.api.v1.folders.getFolder, {
        userId,
        organizationId,
        folderId,
      });
      expect(deleted).toBeNull();
    });

    test("throws when folder belongs to different org", async () => {
      const folderId = await seedFolder({
        name: "Other Delete",
        organizationId: otherOrgId,
      });

      await expect(
        t.mutation(internal.api.v1.folders.deleteFolder, {
          userId,
          organizationId,
          folderId,
        }),
      ).rejects.toThrow("Folder not found");
    });
  });
});
