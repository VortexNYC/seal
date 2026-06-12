// Set before imports — sendDocumentEmailsInternal imports Resend
process.env.RESEND_API_KEY = "re_test_dummy";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/recipients", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  async function insertDocument(
    overrides: {
      workflowStatus?: "draft" | "sent" | "in_progress" | "completed";
      status?: "active" | "deleted";
      organizationId?: Id<"organizations">;
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
        storageId: "storage-recipients-test",
        createdAt: BASE_TIME,
        updatedAt: BASE_TIME,
        ...(overrides.workflowStatus ? { workflowStatus: overrides.workflowStatus } : {}),
      });
    });
  }

  beforeEach(async () => {
    vi.useFakeTimers();
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

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // addRecipient
  // =========================================================================

  describe("addRecipient", () => {
    test("creates a recipient successfully", async () => {
      const documentId = await insertDocument();

      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "alice@example.com",
        name: "Alice",
        role: "signer",
      });

      expect(result.success).toBe(true);
      expect(result.recipientId).toBeDefined();

      const recipient = await t.query(internal.api.v1.recipients.getRecipient, {
        userId,
        organizationId,
        documentId,
        recipientId: result.recipientId as Id<"document_recipients">,
      });

      expect(recipient?.email).toBe("alice@example.com");
      expect(recipient?.name).toBe("Alice");
      expect(recipient?.role).toBe("signer");
    });

    test("trims whitespace from name", async () => {
      const documentId = await insertDocument();

      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "alice@example.com",
        name: "  Alice  ",
        role: "signer",
      });

      expect(result.success).toBe(true);

      const recipient = await t.query(internal.api.v1.recipients.getRecipient, {
        userId,
        organizationId,
        documentId,
        recipientId: result.recipientId as Id<"document_recipients">,
      });

      expect(recipient?.name).toBe("Alice");
    });

    test("rejects empty name", async () => {
      const documentId = await insertDocument();

      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "alice@example.com",
        name: "",
        role: "signer",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Recipient name cannot be empty");
    });

    test("rejects whitespace-only name", async () => {
      const documentId = await insertDocument();

      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "alice@example.com",
        name: "   ",
        role: "signer",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Recipient name cannot be empty");
    });

    test("rejects duplicate email for same document", async () => {
      const documentId = await insertDocument();

      await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "alice@example.com",
        name: "Alice",
        role: "signer",
      });

      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "alice@example.com",
        name: "Alice 2",
        role: "signer",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Recipient with this email already exists");
    });
  });
});
