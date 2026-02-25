import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("Recipients mutations", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;
  let recipientId: Id<"document_recipients">;
  let ownerId: Id<"users">;

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

    recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "existing@example.com",
        name: "Existing Recipient",
        role: "signer",
        status: "pending",
        order: 1,
        signingToken: "test-token-recip",
        tokenExpiresAt: Date.now() + 86_400_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // addRecipients
  // ---------------------------------------------------------------------------
  describe("addRecipients", () => {
    test("creates recipients with correct defaults and generates signing token & tokenHash", async () => {
      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.documents.recipients_mutations.addRecipients, {
          documentId,
          recipients: [
            { email: "alice@example.com", name: "Alice", role: "signer", order: 1 },
            { email: "bob@example.com", name: "Bob", role: "approver", order: 2 },
          ],
        });

      expect(result.count).toBe(2);
      expect(result.recipientIds).toHaveLength(2);

      // Verify records in the database
      for (const id of result.recipientIds) {
        const recipient = await t.run(async (ctx) => {
          return await ctx.db.get(id as Id<"document_recipients">);
        });

        expect(recipient).toBeDefined();
        expect(recipient?.status).toBe("pending");
        expect(recipient?.documentId).toBe(documentId);
        // Token should be a 64-char hex string (32 random bytes)
        expect(recipient?.signingToken).toMatch(/^[0-9a-f]{64}$/);
        // Hash should exist
        expect(recipient?.tokenHash).toBeDefined();
        expect(typeof recipient?.tokenHash).toBe("string");
        expect(recipient?.tokenExpiresAt).toBeGreaterThan(Date.now());
        expect(recipient?.createdAt).toBeDefined();
        expect(recipient?.updatedAt).toBeDefined();
      }
    });

    test("lowercases email addresses", async () => {
      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.documents.recipients_mutations.addRecipients, {
          documentId,
          recipients: [{ email: "Alice@EXAMPLE.COM", name: "Alice", role: "signer" }],
        });

      const recipient = await t.run(async (ctx) => {
        return await ctx.db.get(result.recipientIds[0] as Id<"document_recipients">);
      });

      expect(recipient?.email).toBe("alice@example.com");
    });

    test("rejects duplicate emails in same batch", async () => {
      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.documents.recipients_mutations.addRecipients, {
            documentId,
            recipients: [
              { email: "dup@example.com", role: "signer" },
              { email: "DUP@example.com", role: "approver" },
            ],
          }),
      ).rejects.toThrow("Duplicate recipient emails are not allowed");
    });

    test("rejects empty recipients array", async () => {
      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.documents.recipients_mutations.addRecipients, {
            documentId,
            recipients: [],
          }),
      ).rejects.toThrow("At least one recipient is required");
    });

    test("rejects when document is deleted", async () => {
      // Mark the document as deleted
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { status: "deleted" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.documents.recipients_mutations.addRecipients, {
            documentId,
            recipients: [{ email: "new@example.com", role: "signer" }],
          }),
      ).rejects.toThrow("Cannot add recipients to deleted document");
    });

    test("rejects unauthenticated requests", async () => {
      await expect(
        t.mutation(api.documents.recipients_mutations.addRecipients, {
          documentId,
          recipients: [{ email: "new@example.com", role: "signer" }],
        }),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // removeRecipient
  // ---------------------------------------------------------------------------
  describe("removeRecipient", () => {
    test("deletes recipient and returns success", async () => {
      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.documents.recipients_mutations.removeRecipient, {
          recipientId,
        });

      expect(result.success).toBe(true);

      const deleted = await t.run(async (ctx) => {
        return await ctx.db.get(recipientId);
      });

      expect(deleted).toBeNull();
    });

    test("cascade-deletes associated signature fields", async () => {
      // Create a signature field for the recipient
      const fieldId = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          recipientId,
          fieldType: "signature",
          label: "Signature",
          isRequired: true,
          x: 10,
          y: 10,
          width: 150,
          height: 40,
          page: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.documents.recipients_mutations.removeRecipient, {
          recipientId,
        });

      expect(result.success).toBe(true);
      expect(result.deletedFieldsCount).toBe(1);

      const deletedField = await t.run(async (ctx) => {
        return await ctx.db.get(fieldId);
      });

      expect(deletedField).toBeNull();
    });

    test("cascade-deletes payment_field_configs when removing recipient with payment fields", async () => {
      // Create a payment field for the recipient
      const paymentFieldId = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          recipientId,
          fieldType: "payment",
          label: "Payment",
          isRequired: true,
          x: 10,
          y: 10,
          width: 150,
          height: 40,
          page: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Create a payment_field_config associated with that payment field
      const paymentConfigId = await t.run(async (ctx) => {
        return await ctx.db.insert("payment_field_configs", {
          fieldId: paymentFieldId,
          documentId,
          organizationId,
          paymentType: "one_time",
          items: [{ id: "item-1", description: "Fee", quantity: 1, unitPrice: 5000 }],
          totalAmountCents: 5000,
          currency: "usd",
          dueDateTerms: "net_30",
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          paymentStatus: "pending",
          taxEnabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Remove the recipient
      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.documents.recipients_mutations.removeRecipient, {
          recipientId,
        });

      expect(result.success).toBe(true);
      expect(result.deletedFieldsCount).toBe(1);

      // Verify the payment field was deleted
      const deletedField = await t.run(async (ctx) => {
        return await ctx.db.get(paymentFieldId);
      });
      expect(deletedField).toBeNull();

      // Verify the payment config was cascade-deleted
      const deletedConfig = await t.run(async (ctx) => {
        return await ctx.db.get(paymentConfigId);
      });
      expect(deletedConfig).toBeNull();
    });

    test("rejects when document is deleted", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { status: "deleted" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.documents.recipients_mutations.removeRecipient, {
            recipientId,
          }),
      ).rejects.toThrow("Cannot remove recipients from deleted document");
    });

    test("rejects unauthenticated requests", async () => {
      await expect(
        t.mutation(api.documents.recipients_mutations.removeRecipient, {
          recipientId,
        }),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // updateRecipient
  // ---------------------------------------------------------------------------
  describe("updateRecipient", () => {
    test("updates name, email, and role successfully", async () => {
      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.documents.recipients_mutations.updateRecipient, {
          recipientId,
          name: "Updated Name",
          email: "updated@example.com",
          role: "approver",
        });

      expect(result.success).toBe(true);

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(recipientId);
      });

      expect(updated?.name).toBe("Updated Name");
      expect(updated?.email).toBe("updated@example.com");
      expect(updated?.role).toBe("approver");
    });

    test("lowercases email", async () => {
      await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.documents.recipients_mutations.updateRecipient, {
          recipientId,
          email: "UPPERCASE@EXAMPLE.COM",
        });

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(recipientId);
      });

      expect(updated?.email).toBe("uppercase@example.com");
    });

    test("rejects duplicate email among other recipients on same document", async () => {
      // Create a second recipient with a known email
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "taken@example.com",
          name: "Other Recipient",
          role: "signer",
          status: "pending",
          order: 2,
          signingToken: "test-token-other",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.documents.recipients_mutations.updateRecipient, {
            recipientId,
            email: "taken@example.com",
          }),
      ).rejects.toThrow("A recipient with this email already exists");
    });

    test("rejects editing completed recipients (status signed)", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(recipientId, { status: "signed" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.documents.recipients_mutations.updateRecipient, {
            recipientId,
            name: "Should Fail",
          }),
      ).rejects.toThrow("Cannot edit recipient who has already completed their action");
    });

    test("rejects editing completed recipients (status approved)", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(recipientId, { status: "approved" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.documents.recipients_mutations.updateRecipient, {
            recipientId,
            name: "Should Fail",
          }),
      ).rejects.toThrow("Cannot edit recipient who has already completed their action");
    });

    test("rejects editing completed recipients (status declined)", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(recipientId, { status: "declined" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.documents.recipients_mutations.updateRecipient, {
            recipientId,
            name: "Should Fail",
          }),
      ).rejects.toThrow("Cannot edit recipient who has already completed their action");
    });

    test("rejects unauthenticated requests", async () => {
      await expect(
        t.mutation(api.documents.recipients_mutations.updateRecipient, {
          recipientId,
          name: "Should Fail",
        }),
      ).rejects.toThrow();
    });
  });
});
