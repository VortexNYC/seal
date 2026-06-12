import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/recipients", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  async function insertDocument(overrides: {
    organizationId?: Id<"organizations">;
    status?: "active" | "deleted";
    workflowStatus?: "draft" | "sent" | "in_progress" | "completed" | "cancelled" | "declined";
  } = {}) {
    const orgId = overrides.organizationId ?? organizationId;
    return t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Document",
        ownerId: userId,
        organizationId: orgId,
        status: overrides.status ?? "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-recipients-test",
        createdAt: BASE_TIME,
        updatedAt: BASE_TIME,
        ...(overrides.workflowStatus ? { workflowStatus: overrides.workflowStatus } : {}),
      });
    });
  }

  async function insertRecipient(
    documentId: Id<"documents">,
    overrides: {
      email?: string;
      name?: string;
      role?: "signer" | "approver" | "viewer";
      status?: "pending" | "viewed" | "signed" | "approved" | "declined" | "expired";
      order?: number;
      createdAt?: number;
    } = {},
  ) {
    const now = BASE_TIME;
    return t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: overrides.email ?? "recipient@test.com",
        name: overrides.name ?? "Test Recipient",
        role: overrides.role ?? "signer",
        status: overrides.status ?? "pending",
        order: overrides.order ?? 0,
        signingToken: `token-${Math.random().toString(36).slice(2)}`,
        tokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
        createdAt: overrides.createdAt ?? now,
        updatedAt: now,
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Recipients Test Org",
        slug: "recipients-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: BASE_TIME,
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-recipients",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: BASE_TIME,
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@recipients-test.com",
        name: "Owner",
        authSubject: "recipients_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // ========================================================================
  // listRecipients
  // ========================================================================

  describe("listRecipients", () => {
    test("returns empty list when no recipients exist", async () => {
      const documentId = await insertDocument();

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
      });

      expect(result).not.toBeNull();
      expect(result!.recipients).toHaveLength(0);
      expect(result!.has_more).toBe(false);
      expect(result!.next_cursor).toBeUndefined();
    });

    test("returns recipients for the document", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@test.com", name: "Alice" });
      await insertRecipient(documentId, { email: "bob@test.com", name: "Bob" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
      });

      expect(result!.recipients).toHaveLength(2);
    });

    test("returns null for document in different org", async () => {
      const documentId = await insertDocument({ organizationId: otherOrgId });
      await insertRecipient(documentId);

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
      });

      expect(result).toBeNull();
    });

    test("returns null for deleted document", async () => {
      const documentId = await insertDocument({ status: "deleted" });
      await insertRecipient(documentId);

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
      });

      expect(result).toBeNull();
    });

    test("filters by status", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@test.com", status: "pending" });
      await insertRecipient(documentId, { email: "bob@test.com", status: "signed" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        status: "pending",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.email).toBe("alice@test.com");
    });

    test("filters by role", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@test.com", role: "signer" });
      await insertRecipient(documentId, { email: "bob@test.com", role: "viewer" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        role: "viewer",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.email).toBe("bob@test.com");
    });

    test("filters by email substring", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@acme.com" });
      await insertRecipient(documentId, { email: "bob@example.com" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        email: "acme",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.email).toBe("alice@acme.com");
    });

    test("sorts by order ascending by default", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "z@test.com", order: 3 });
      await insertRecipient(documentId, { email: "a@test.com", order: 1 });
      await insertRecipient(documentId, { email: "m@test.com", order: 2 });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
      });

      const emails = result!.recipients.map((r) => r.email);
      expect(emails).toEqual(["a@test.com", "m@test.com", "z@test.com"]);
    });

    test("sorts by email descending", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@test.com" });
      await insertRecipient(documentId, { email: "bob@test.com" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        sort_by: "email",
        sort_order: "desc",
      });

      const emails = result!.recipients.map((r) => r.email);
      expect(emails).toEqual(["bob@test.com", "alice@test.com"]);
    });

    test("respects limit and returns has_more=true", async () => {
      const documentId = await insertDocument();
      for (let i = 0; i < 5; i++) {
        await insertRecipient(documentId, { email: `r${i}@test.com`, order: i });
      }

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        limit: 2,
      });

      expect(result!.recipients).toHaveLength(2);
      expect(result!.has_more).toBe(true);
      expect(result!.next_cursor).toBeDefined();
    });

    test("cursor pagination returns next page without overlap", async () => {
      const documentId = await insertDocument();
      for (let i = 0; i < 5; i++) {
        await insertRecipient(documentId, { email: `p${i}@test.com`, order: i });
      }

      const page1 = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        limit: 2,
      });

      expect(page1!.recipients).toHaveLength(2);

      const page2 = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        limit: 2,
        cursor: page1!.next_cursor,
      });

      expect(page2!.recipients).toHaveLength(2);
      const page1Ids = new Set(page1!.recipients.map((r) => r.id));
      for (const r of page2!.recipients) {
        expect(page1Ids.has(r.id)).toBe(false);
      }
    });

    test("caps limit at 100", async () => {
      const documentId = await insertDocument();
      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        limit: 500,
      });

      expect(result!.recipients).toHaveLength(0);
      expect(result!.has_more).toBe(false);
    });

    test("returns only requested fields", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@test.com", name: "Alice" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        fields: ["email", "name"],
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]).toEqual({
        email: "alice@test.com",
        name: "Alice",
      });
    });

    test("returns all fields when fields is empty array", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@test.com", name: "Alice" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        fields: [],
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]!.id).toBeDefined();
      expect(result!.recipients[0]!.email).toBe("alice@test.com");
    });

    test("ignores invalid field names in fields parameter", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@test.com", name: "Alice" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        fields: ["email", "invalid_field"],
      });

      expect(result!.recipients).toHaveLength(1);
      expect(Object.keys(result!.recipients[0]!)).toEqual(["email"]);
      expect(result!.recipients[0]!.email).toBe("alice@test.com");
    });

    test("combines field filtering with status filter", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@test.com", status: "pending" });
      await insertRecipient(documentId, { email: "bob@test.com", status: "signed" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        status: "pending",
        fields: ["email", "status"],
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]).toEqual({
        email: "alice@test.com",
        status: "pending",
      });
    });

    test("uses default limit when not provided", async () => {
      const documentId = await insertDocument();
      for (let i = 0; i < 25; i++) {
        await insertRecipient(documentId, { email: `r${i}@test.com`, order: i });
      }

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
      });

      expect(result!.recipients).toHaveLength(20);
      expect(result!.has_more).toBe(true);
    });
  });
});
