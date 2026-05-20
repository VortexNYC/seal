import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("Document redactionLevel", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
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

    const ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Test Owner",
        clerkId: "clerk_test_owner",
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

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Document",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  test("default redactionLevel is undefined (treated as none)", async () => {
    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });
    expect(doc?.redactionLevel).toBeUndefined();
  });

  test("can set redactionLevel to strict", async () => {
    const result = await t
      .withIdentity({ subject: "clerk_test_owner" })
      .mutation(api.documents.mutations.setDocumentRedactionLevel, {
        documentId,
        redactionLevel: "strict",
      });
    expect(result.success).toBe(true);

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });
    expect(doc?.redactionLevel).toBe("strict");
  });

  test("can set redactionLevel to standard", async () => {
    const result = await t
      .withIdentity({ subject: "clerk_test_owner" })
      .mutation(api.documents.mutations.setDocumentRedactionLevel, {
        documentId,
        redactionLevel: "standard",
      });
    expect(result.success).toBe(true);

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });
    expect(doc?.redactionLevel).toBe("standard");
  });

  test("can set redactionLevel to none", async () => {
    await t
      .withIdentity({ subject: "clerk_test_owner" })
      .mutation(api.documents.mutations.setDocumentRedactionLevel, {
        documentId,
        redactionLevel: "strict",
      });

    const result = await t
      .withIdentity({ subject: "clerk_test_owner" })
      .mutation(api.documents.mutations.setDocumentRedactionLevel, {
        documentId,
        redactionLevel: "none",
      });
    expect(result.success).toBe(true);

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });
    expect(doc?.redactionLevel).toBe("none");
  });

  test("rejects invalid redactionLevel values", async () => {
    await expect(
      t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.documents.mutations.setDocumentRedactionLevel, {
          documentId,
          redactionLevel: "invalid" as "none",
        }),
    ).rejects.toThrow();
  });
});
