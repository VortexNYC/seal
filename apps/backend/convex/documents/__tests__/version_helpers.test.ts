import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { createVersionSnapshot } from "../version_helpers";

describe("createVersionSnapshot", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;
  let documentId: Id<"documents">;

  beforeEach(async () => {
    t = createTestContext();

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

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Document",
        description: "A test document description",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 2048,
        fileType: "application/pdf",
        storageId: "storage-abc-123",
        pageCount: 5,
        documentHash: "sha256-abc123def456",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  test("first version returns 1", async () => {
    const version = await t.run(async (ctx) => {
      return await createVersionSnapshot(ctx, {
        documentId,
        createdBy: ownerId,
        changeType: "created",
      });
    });

    expect(version).toBe(1);
  });

  test("second version returns 2 (auto-increment)", async () => {
    await t.run(async (ctx) => {
      return await createVersionSnapshot(ctx, {
        documentId,
        createdBy: ownerId,
        changeType: "created",
      });
    });

    const version2 = await t.run(async (ctx) => {
      return await createVersionSnapshot(ctx, {
        documentId,
        createdBy: ownerId,
        changeType: "replaced",
      });
    });

    expect(version2).toBe(2);
  });

  test("snapshot captures document state correctly", async () => {
    await t.run(async (ctx) => {
      return await createVersionSnapshot(ctx, {
        documentId,
        createdBy: ownerId,
        changeType: "created",
      });
    });

    const versionRecord = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_versions")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .first();
    });

    expect(versionRecord).not.toBeNull();
    expect(versionRecord!.snapshot).toEqual({
      name: "Test Document",
      description: "A test document description",
      storageId: "storage-abc-123",
      fileSize: 2048,
      fileType: "application/pdf",
      pageCount: 5,
      documentHash: "sha256-abc123def456",
    });
    expect(versionRecord!.versionNumber).toBe(1);
    expect(versionRecord!.createdBy).toBe(ownerId);
    expect(versionRecord!.createdAt).toBeTypeOf("number");
  });

  test("optional fields captured when present", async () => {
    await t.run(async (ctx) => {
      return await createVersionSnapshot(ctx, {
        documentId,
        createdBy: ownerId,
        changeType: "created",
      });
    });

    const versionRecord = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_versions")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .first();
    });

    expect(versionRecord!.snapshot.description).toBe("A test document description");
    expect(versionRecord!.snapshot.pageCount).toBe(5);
    expect(versionRecord!.snapshot.documentHash).toBe("sha256-abc123def456");
  });

  test("optional fields omitted when not on document", async () => {
    // Create a document without optional fields
    const minimalDocId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Minimal Doc",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 512,
        fileType: "application/pdf",
        storageId: "storage-minimal",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      return await createVersionSnapshot(ctx, {
        documentId: minimalDocId,
        createdBy: ownerId,
        changeType: "created",
      });
    });

    const versionRecord = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_versions")
        .withIndex("by_document", (q) => q.eq("documentId", minimalDocId))
        .first();
    });

    expect(versionRecord!.snapshot.description).toBeUndefined();
    expect(versionRecord!.snapshot.pageCount).toBeUndefined();
    expect(versionRecord!.snapshot.documentHash).toBeUndefined();
  });

  test("changeDescription and restoredFromVersion stored correctly", async () => {
    await t.run(async (ctx) => {
      return await createVersionSnapshot(ctx, {
        documentId,
        createdBy: ownerId,
        changeType: "restored",
        changeDescription: "Restored from version 2",
        restoredFromVersion: 2,
      });
    });

    const versionRecord = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_versions")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .first();
    });

    expect(versionRecord!.changeDescription).toBe("Restored from version 2");
    expect(versionRecord!.restoredFromVersion).toBe(2);
  });

  test("throws for non-existent document", async () => {
    const fakeDocumentId = "nonexistent" as Id<"documents">;

    await expect(
      t.run(async (ctx) => {
        await createVersionSnapshot(ctx, {
          documentId: fakeDocumentId,
          createdBy: ownerId,
          changeType: "created",
        });
      }),
    ).rejects.toThrow("not found");
  });

  test.each<"created" | "replaced" | "restored">(["created", "replaced", "restored"])(
    "changeType '%s' stored correctly",
    async (changeType) => {
      await t.run(async (ctx) => {
        return await createVersionSnapshot(ctx, {
          documentId,
          createdBy: ownerId,
          changeType,
        });
      });

      const versionRecord = await t.run(async (ctx) => {
        return await ctx.db
          .query("document_versions")
          .withIndex("by_document", (q) => q.eq("documentId", documentId))
          .first();
      });

      expect(versionRecord!.changeType).toBe(changeType);
    },
  );
});
