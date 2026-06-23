import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/documents", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  async function seedDocument(overrides: {
    name?: string;
    workflowStatus?:
      | "draft"
      | "sent"
      | "in_progress"
      | "waiting_for_payment"
      | "completed"
      | "cancelled"
      | "declined";
    organizationId?: Id<"organizations">;
  }) {
    const orgId = overrides.organizationId ?? organizationId;
    const now = BASE_TIME;

    return t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        organizationId: orgId,
        ownerId: userId,
        name: overrides.name ?? "Test Document",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: `storage-${crypto.randomUUID()}`,
        sharingMode: "private",
        status: "active",
        workflowStatus: overrides.workflowStatus ?? "draft",
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Documents API Org",
        slug: "documents-api-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-docs",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@docs-api.com",
        name: "Owner",
        authSubject: "docs_api_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // listDocuments
  // =========================================================================

  describe("listDocuments", () => {
    test("returns empty list when no documents exist", async () => {
      const result = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
      });

      expect(result.documents).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    test("returns documents for the org", async () => {
      await seedDocument({ name: "Doc A" });
      await seedDocument({ name: "Doc B" });
      await seedDocument({ name: "Other Org Doc", organizationId: otherOrgId });

      const result = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
      });

      expect(result.documents).toHaveLength(2);
    });

    test("returns documents in descending creation order", async () => {
      await seedDocument({ name: "First" });
      await seedDocument({ name: "Second" });
      await seedDocument({ name: "Third" });

      const result = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
      });

      expect(result.documents).toHaveLength(3);
      expect(result.documents[0]?.title).toBe("Third");
      expect(result.documents[1]?.title).toBe("Second");
      expect(result.documents[2]?.title).toBe("First");
    });

    test("filters by status (workflowStatus)", async () => {
      await seedDocument({ name: "Draft Doc", workflowStatus: "draft" });
      await seedDocument({ name: "Sent Doc", workflowStatus: "sent" });
      await seedDocument({ name: "Draft Doc 2", workflowStatus: "draft" });

      const result = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
        status: "sent",
      });

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]?.title).toBe("Sent Doc");
    });

    test("respects limit and returns hasMore=true when more exist", async () => {
      for (let i = 0; i < 5; i++) {
        await seedDocument({ name: `Doc ${i}` });
      }

      const result = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(result.documents).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    test("cursor pagination returns next page without overlap", async () => {
      for (let i = 0; i < 5; i++) {
        await seedDocument({ name: `Doc ${i}` });
      }

      const page1 = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(page1.documents).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
        limit: 2,
        cursor: page1.nextCursor,
      });

      expect(page2.documents).toHaveLength(2);
      const page1Ids = new Set(page1.documents.map((d: (typeof page1.documents)[number]) => d.id));
      for (const d of page2.documents) {
        expect(page1Ids.has(d.id)).toBe(false);
      }
    });

    test("hasMore=false when all documents fit on one page", async () => {
      await seedDocument({ name: "Doc A" });
      await seedDocument({ name: "Doc B" });

      const result = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
        limit: 10,
      });

      expect(result.documents).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    test("hasMore=true when raw fetch exhausted by post-filter, even if filtered results fit limit", async () => {
      // Insert 8 draft docs, then 1 sent, then 2 more drafts, then 1 more sent
      // Total: 10 drafts, 2 sents = 12 docs
      // Descending _creationTime: sent(12), draft(11), draft(10), sent(9), draft(8..1)
      // With limit=2, fetchLimit=10. Raw fetch gets first 10: sent(12), draft(11), draft(10), sent(9), draft(8..3)
      // Post-filter for "sent": sent(12), sent(9) → 2 items (fits limit)
      // But raw fetch was exhausted → hasMore must be true, nextCursor must be last raw item
      for (let i = 0; i < 8; i++) {
        await seedDocument({ name: `Draft ${i}`, workflowStatus: "draft" });
      }
      await seedDocument({ name: "Sent A", workflowStatus: "sent" });
      for (let i = 8; i < 10; i++) {
        await seedDocument({ name: `Draft ${i}`, workflowStatus: "draft" });
      }
      await seedDocument({ name: "Sent B", workflowStatus: "sent" });

      const result = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
        limit: 2,
        status: "sent",
      });

      expect(result.documents).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();

      // Next page should return empty (no more sent docs beyond the exhausted window)
      const page2 = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
        limit: 2,
        status: "sent",
        cursor: result.nextCursor,
      });

      expect(page2.documents).toHaveLength(0);
      expect(page2.hasMore).toBe(false);
    });

    test("returns correct document fields", async () => {
      await seedDocument({ name: "Test Doc", workflowStatus: "draft" });

      const result = await t.query(internal.api.v1.documents.listDocuments, {
        userId,
        organizationId,
      });

      const doc = result.documents[0];
      expect(doc?.title).toBe("Test Doc");
      expect(doc?.status).toBe("draft");
      expect(doc?.created_at).toBeDefined();
      expect(doc?.updated_at).toBeDefined();
      expect(doc?.recipients_count).toBe(0);
      expect(doc?.signed_count).toBe(0);
    });
  });
});
