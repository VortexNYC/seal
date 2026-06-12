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

  async function insertDocument(
    overrides: {
      organizationId?: Id<"organizations">;
      status?: "active" | "deleted";
    } = {},
  ) {
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
        storageId: "storage-doc-recipients-test",
        createdAt: BASE_TIME,
        updatedAt: BASE_TIME,
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
      updatedAt?: number;
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
        order: overrides.order,
        signingToken: `token-${Math.random().toString(36).slice(2)}`,
        tokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
        createdAt: overrides.createdAt ?? now,
        updatedAt: overrides.updatedAt ?? now,
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Recipients API Org",
        slug: "recipients-api-org",
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
        email: "owner@recipients-api.com",
        name: "Owner",
        authSubject: "recipients_api_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // listRecipients
  // =========================================================================

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

    // -----------------------------------------------------------------------
    // Pagination
    // -----------------------------------------------------------------------

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

      expect(page2).not.toBeNull();
      expect(page2!.recipients).toHaveLength(2);
      const page1Ids = new Set(page1!.recipients.map((r: { id: string }) => r.id));
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

    // -----------------------------------------------------------------------
    // Filtering
    // -----------------------------------------------------------------------

    test("filters by status", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "pending@test.com", status: "pending" });
      await insertRecipient(documentId, { email: "signed@test.com", status: "signed" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        status: "signed",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.email).toBe("signed@test.com");
    });

    test("filters by role", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "signer@test.com", role: "signer" });
      await insertRecipient(documentId, { email: "viewer@test.com", role: "viewer" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        role: "viewer",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.email).toBe("viewer@test.com");
    });

    test("filters by status and role together", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "a@test.com", role: "signer", status: "pending" });
      await insertRecipient(documentId, { email: "b@test.com", role: "signer", status: "signed" });
      await insertRecipient(documentId, { email: "c@test.com", role: "viewer", status: "pending" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        status: "pending",
        role: "signer",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.email).toBe("a@test.com");
    });

    // -----------------------------------------------------------------------
    // Search
    // -----------------------------------------------------------------------

    test("searches by email substring", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@example.com", name: "Alice" });
      await insertRecipient(documentId, { email: "bob@example.com", name: "Bob" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        search: "alice",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.email).toBe("alice@example.com");
    });

    test("searches by name substring", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@example.com", name: "Alice Smith" });
      await insertRecipient(documentId, { email: "bob@example.com", name: "Bob Jones" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        search: "smith",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.name).toBe("Alice Smith");
    });

    test("search is case-insensitive", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "Alice@Example.com", name: "Alice" });
      await insertRecipient(documentId, { email: "bob@example.com", name: "Bob" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        search: "ALICE",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.email).toBe("Alice@Example.com");
    });

    test("search returns empty when no match", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "alice@example.com", name: "Alice" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        search: "nonexistent",
      });

      expect(result!.recipients).toHaveLength(0);
    });

    test("combines search with status filter", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, {
        email: "alice@test.com",
        name: "Alice",
        status: "pending",
      });
      await insertRecipient(documentId, {
        email: "alice.signed@test.com",
        name: "Alice Signed",
        status: "signed",
      });
      await insertRecipient(documentId, { email: "bob@test.com", name: "Bob", status: "pending" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        search: "alice",
        status: "pending",
      });

      expect(result!.recipients).toHaveLength(1);
      expect(result!.recipients[0]?.email).toBe("alice@test.com");
    });

    test("combines search with sorting and pagination", async () => {
      const documentId = await insertDocument();
      for (let i = 0; i < 5; i++) {
        await insertRecipient(documentId, {
          email: `search${i}@test.com`,
          name: `User ${i}`,
          order: i,
        });
      }
      await insertRecipient(documentId, { email: "other@test.com", name: "Other" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        search: "search",
        sort: "email",
        limit: 3,
      });

      expect(result!.recipients).toHaveLength(3);
      expect(result!.has_more).toBe(true);
      for (const r of result!.recipients) {
        expect(r.email).toContain("search");
      }
    });

    // -----------------------------------------------------------------------
    // Sorting
    // -----------------------------------------------------------------------

    test("sorts by order ascending by default", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "second@test.com", order: 2 });
      await insertRecipient(documentId, { email: "first@test.com", order: 1 });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
      });

      expect(result!.recipients[0]?.email).toBe("first@test.com");
      expect(result!.recipients[1]?.email).toBe("second@test.com");
    });

    test("sorts by email ascending", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "z@test.com" });
      await insertRecipient(documentId, { email: "a@test.com" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        sort: "email",
      });

      expect(result!.recipients[0]?.email).toBe("a@test.com");
      expect(result!.recipients[1]?.email).toBe("z@test.com");
    });

    test("sorts by email descending", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "a@test.com" });
      await insertRecipient(documentId, { email: "z@test.com" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        sort: "email",
        sort_direction: "desc",
      });

      expect(result!.recipients[0]?.email).toBe("z@test.com");
      expect(result!.recipients[1]?.email).toBe("a@test.com");
    });

    test("sorts by name", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { name: "Zara", email: "zara@test.com" });
      await insertRecipient(documentId, { name: "Alice", email: "alice@test.com" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        sort: "name",
      });

      expect(result!.recipients[0]?.name).toBe("Alice");
      expect(result!.recipients[1]?.name).toBe("Zara");
    });

    test("sorts by status", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "b@test.com", status: "signed" });
      await insertRecipient(documentId, { email: "a@test.com", status: "pending" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        sort: "status",
      });

      expect(result!.recipients[0]?.email).toBe("a@test.com");
      expect(result!.recipients[1]?.email).toBe("b@test.com");
    });

    test("sorts by role", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "s@test.com", role: "signer" });
      await insertRecipient(documentId, { email: "v@test.com", role: "viewer" });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        sort: "role",
      });

      expect(result!.recipients[0]?.email).toBe("s@test.com");
      expect(result!.recipients[1]?.email).toBe("v@test.com");
    });

    test("sorts by created_at", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "old@test.com", createdAt: BASE_TIME - 1000 });
      await insertRecipient(documentId, { email: "new@test.com", createdAt: BASE_TIME + 1000 });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        sort: "created_at",
      });

      expect(result!.recipients[0]?.email).toBe("old@test.com");
      expect(result!.recipients[1]?.email).toBe("new@test.com");
    });

    test("sorts by updated_at descending", async () => {
      const documentId = await insertDocument();
      await insertRecipient(documentId, { email: "old@test.com", updatedAt: BASE_TIME - 1000 });
      await insertRecipient(documentId, { email: "new@test.com", updatedAt: BASE_TIME + 1000 });

      const result = await t.query(internal.api.v1.recipients.listRecipients, {
        userId,
        organizationId,
        documentId,
        sort: "updated_at",
        sort_direction: "desc",
      });

      expect(result!.recipients[0]?.email).toBe("new@test.com");
      expect(result!.recipients[1]?.email).toBe("old@test.com");
    });
  });

  // =========================================================================
  // getRecipient
  // =========================================================================

  describe("getRecipient", () => {
    test("returns recipient by ID", async () => {
      const documentId = await insertDocument();
      const recipientId = await insertRecipient(documentId, {
        email: "alice@test.com",
        name: "Alice",
      });

      const result = await t.query(internal.api.v1.recipients.getRecipient, {
        userId,
        organizationId,
        documentId,
        recipientId,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(recipientId);
      expect(result?.email).toBe("alice@test.com");
      expect(result?.name).toBe("Alice");
    });

    test("returns null for recipient in different org", async () => {
      const documentId = await insertDocument({ organizationId: otherOrgId });
      const recipientId = await insertRecipient(documentId);

      const result = await t.query(internal.api.v1.recipients.getRecipient, {
        userId,
        organizationId,
        documentId,
        recipientId,
      });

      expect(result).toBeNull();
    });
  });
});
