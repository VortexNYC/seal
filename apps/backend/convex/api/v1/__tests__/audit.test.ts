import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/audit", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;
  let documentId: Id<"documents">;

  const BASE_TIME = 1_700_000_000_000; // Fixed timestamp for deterministic tests

  async function insertAuditLog(
    overrides: Partial<{
      organizationId: Id<"organizations">;
      documentId: Id<"documents">;
      action:
        | "document.created"
        | "document.sent"
        | "document.completed"
        | "document.cancelled"
        | "recipient.signed";
      actorType: "user" | "recipient" | "system";
      userId: string;
      createdAt: number;
    }> = {},
  ) {
    return t.run(async (ctx) => {
      return await ctx.db.insert("audit_logs", {
        organizationId: overrides.organizationId ?? organizationId,
        action: overrides.action ?? "document.created",
        actorType: overrides.actorType ?? "user",
        userId: overrides.userId ?? "clerk_audit_owner",
        resourceType: "document",
        ipAddress: "127.0.0.1",
        createdAt: overrides.createdAt ?? BASE_TIME,
        ...(overrides.documentId ? { documentId: overrides.documentId } : {}),
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Audit Test Org",
        slug: "audit-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-audit",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@audit-test.com",
        name: "Audit Owner",
        clerkId: "clerk_audit_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Audit Test Doc",
        ownerId: userId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-audit-test",
        createdAt: BASE_TIME,
        updatedAt: BASE_TIME,
      });
    });
  });

  // =========================================================================
  // listAuditLog
  // =========================================================================

  describe("listAuditLog", () => {
    test("returns empty list when no audit log entries exist", async () => {
      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
      });

      expect(result.entries).toHaveLength(0);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeUndefined();
    });

    test("returns entries for the organization", async () => {
      await insertAuditLog({ action: "document.created", createdAt: BASE_TIME });
      await insertAuditLog({ action: "document.sent", createdAt: BASE_TIME + 1000 });

      // Also insert an entry for another org (should not appear)
      await t.run(async (ctx) => {
        await ctx.db.insert("audit_logs", {
          organizationId: otherOrgId,
          action: "document.created",
          actorType: "user",
          resourceType: "document",
          ipAddress: "127.0.0.1",
          createdAt: BASE_TIME,
        });
      });

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
      });

      expect(result.entries).toHaveLength(2);
      // All entries belong to our org (verified by not seeing otherOrg's entry)
    });

    test("returns entries in descending order (newest first)", async () => {
      await insertAuditLog({ action: "document.created", createdAt: BASE_TIME });
      await insertAuditLog({ action: "document.sent", createdAt: BASE_TIME + 5000 });
      await insertAuditLog({ action: "document.completed", createdAt: BASE_TIME + 10000 });

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
      });

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0]?.action).toBe("document.completed");
      expect(result.entries[1]?.action).toBe("document.sent");
      expect(result.entries[2]?.action).toBe("document.created");
    });

    test("filters by action", async () => {
      await insertAuditLog({ action: "document.created", createdAt: BASE_TIME });
      await insertAuditLog({ action: "document.sent", createdAt: BASE_TIME + 1000 });
      await insertAuditLog({ action: "document.created", createdAt: BASE_TIME + 2000 });

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
        action: "document.created",
      });

      expect(result.entries).toHaveLength(2);
      expect(
        result.entries.every(
          (e: (typeof result.entries)[number]) => e.action === "document.created",
        ),
      ).toBe(true);
    });

    test("filters by document_id", async () => {
      await insertAuditLog({ documentId, action: "document.created", createdAt: BASE_TIME });
      await insertAuditLog({ documentId, action: "document.sent", createdAt: BASE_TIME + 1000 });
      // This entry has no documentId
      await insertAuditLog({ action: "document.created", createdAt: BASE_TIME + 2000 });

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
        document_id: documentId,
      });

      expect(result.entries).toHaveLength(2);
      expect(
        result.entries.every((e: (typeof result.entries)[number]) => e.document_id === documentId),
      ).toBe(true);
    });

    test("filters by created_after", async () => {
      await insertAuditLog({ action: "document.created", createdAt: BASE_TIME });
      await insertAuditLog({ action: "document.sent", createdAt: BASE_TIME + 10000 });
      await insertAuditLog({ action: "document.completed", createdAt: BASE_TIME + 20000 });

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
        created_after: BASE_TIME + 5000,
      });

      expect(result.entries).toHaveLength(2);
      expect(
        result.entries.every(
          (e: (typeof result.entries)[number]) =>
            new Date(e.created_at).getTime() >= BASE_TIME + 5000,
        ),
      ).toBe(true);
    });

    test("filters by created_before", async () => {
      await insertAuditLog({ action: "document.created", createdAt: BASE_TIME });
      await insertAuditLog({ action: "document.sent", createdAt: BASE_TIME + 10000 });
      await insertAuditLog({ action: "document.completed", createdAt: BASE_TIME + 20000 });

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
        created_before: BASE_TIME + 15000,
      });

      expect(result.entries).toHaveLength(2);
      expect(
        result.entries.every(
          (e: (typeof result.entries)[number]) =>
            new Date(e.created_at).getTime() <= BASE_TIME + 15000,
        ),
      ).toBe(true);
    });

    test("respects limit and returns has_more=true when more exist", async () => {
      for (let i = 0; i < 5; i++) {
        await insertAuditLog({ action: "document.created", createdAt: BASE_TIME + i * 1000 });
      }

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
        limit: 3,
      });

      expect(result.entries).toHaveLength(3);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBeDefined();
    });

    test("cursor pagination returns next page", async () => {
      for (let i = 0; i < 5; i++) {
        await insertAuditLog({ action: "document.created", createdAt: BASE_TIME + i * 1000 });
      }

      const page1 = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(page1.entries).toHaveLength(2);
      expect(page1.has_more).toBe(true);

      const page2 = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
        limit: 2,
        cursor: page1.next_cursor,
      });

      expect(page2.entries).toHaveLength(2);
      // No overlap between pages
      const page1Ids = new Set(page1.entries.map((e: (typeof page1.entries)[number]) => e.id));
      const page2Ids = new Set(page2.entries.map((e: (typeof page2.entries)[number]) => e.id));
      for (const id of page2Ids) {
        expect(page1Ids.has(id)).toBe(false);
      }
    });

    test("has_more=false when all entries fit on one page", async () => {
      await insertAuditLog({ action: "document.created", createdAt: BASE_TIME });
      await insertAuditLog({ action: "document.sent", createdAt: BASE_TIME + 1000 });

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
        limit: 10,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeUndefined();
    });

    test("resolves actor name for user-type entries", async () => {
      await insertAuditLog({
        action: "document.created",
        actorType: "user",
        userId: "clerk_audit_owner",
        createdAt: BASE_TIME,
      });

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.actor_type).toBe("user");
      expect(result.entries[0]?.actor_name).toBe("Audit Owner");
      expect(result.entries[0]?.actor_email).toBe("owner@audit-test.com");
    });

    test("returns correct created_at as ISO string", async () => {
      await insertAuditLog({ createdAt: BASE_TIME });

      const result = await t.query(internal.api.v1.audit.listAuditLog, {
        userId,
        organizationId,
      });

      expect(result.entries[0]?.created_at).toBe(new Date(BASE_TIME).toISOString());
    });
  });
});
