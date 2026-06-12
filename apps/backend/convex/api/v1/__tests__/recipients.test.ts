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
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Recipients API Org",
        slug: "recipients-api-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-recipients",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
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

  // ========================================================================
  // addRecipient
  // ========================================================================

  describe("addRecipient", () => {
    test("rejects empty recipient name", async () => {
      const documentId = await insertDocument();
      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "user@example.com",
        name: "",
        role: "signer",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Recipient name is required");
    });

    test("rejects whitespace-only recipient name", async () => {
      const documentId = await insertDocument();
      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "user@example.com",
        name: "   ",
        role: "signer",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Recipient name is required");
    });

    test("accepts valid recipient with trimmed name", async () => {
      const documentId = await insertDocument();
      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "user@example.com",
        name: "  John Doe  ",
        role: "signer",
      });

      expect(result.success).toBe(true);
      expect(result.recipientId).toBeDefined();

      const recipient = await t.run(async (ctx) => {
        return await ctx.db.get(result.recipientId as Id<"document_recipients">);
      });

      expect(recipient?.name).toBe("John Doe");
    });

    test("rejects duplicate email", async () => {
      const documentId = await insertDocument();
      await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "user@example.com",
        name: "John Doe",
        role: "signer",
      });

      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "USER@EXAMPLE.COM",
        name: "Jane Doe",
        role: "approver",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Recipient with this email already exists");
    });

    test("rejects adding recipient to non-draft/in_progress document", async () => {
      const documentId = await insertDocument({ workflowStatus: "completed" });
      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "user@example.com",
        name: "John Doe",
        role: "signer",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot add recipients");
    });

    test("rejects adding recipient to deleted document", async () => {
      const documentId = await insertDocument({ status: "deleted" });
      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "user@example.com",
        name: "John Doe",
        role: "signer",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Document not found");
    });

    test("rejects adding recipient to document in another org", async () => {
      const documentId = await insertDocument({ organizationId: otherOrgId });
      const result = await t.mutation(internal.api.v1.recipients.addRecipient, {
        userId,
        organizationId,
        documentId,
        email: "user@example.com",
        name: "John Doe",
        role: "signer",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Document not found");
    });
  });
});
