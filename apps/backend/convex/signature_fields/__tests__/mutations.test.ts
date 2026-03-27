import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("Signature field mutations", () => {
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
        name: "Test Doc",
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
        email: "signer@example.com",
        name: "Test Signer",
        role: "signer",
        status: "pending",
        order: 1,
        signingToken: "test-token-sf",
        tokenExpiresAt: Date.now() + 86_400_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // createField
  // ---------------------------------------------------------------------------
  describe("createField", () => {
    test("creates a text field with correct defaults", async () => {
      const fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "text",
          label: "Full Name",
          isRequired: true,
          x: 10,
          y: 20,
          width: 30,
          height: 5,
          page: 1,
        });

      expect(fieldId).toBeDefined();

      const field = (await t.run(async (ctx) => {
        return await ctx.db.get(fieldId);
      })) as Doc<"signature_fields"> | null;

      expect(field).toBeDefined();
      expect(field?.fieldType).toBe("text");
      expect(field?.label).toBe("Full Name");
      expect(field?.isRequired).toBe(true);
      expect(field?.documentId).toBe(documentId);
      expect(field?.recipientId).toBe(recipientId);
      expect(field?.x).toBe(10);
      expect(field?.y).toBe(20);
      expect(field?.width).toBe(30);
      expect(field?.height).toBe(5);
      expect(field?.page).toBe(1);
      expect(field?.createdAt).toBeDefined();
      expect(field?.updatedAt).toBeDefined();
    });

    test("first signature field for a recipient gets isMainSignature: true", async () => {
      const fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "signature",
          label: "Signature",
          isRequired: true,
          x: 10,
          y: 50,
          width: 30,
          height: 10,
          page: 1,
        });

      const field = (await t.run(async (ctx) => {
        return await ctx.db.get(fieldId);
      })) as Doc<"signature_fields"> | null;

      expect(field?.isMainSignature).toBe(true);
    });

    test("second signature field for same recipient does not get isMainSignature", async () => {
      const authed = t.withIdentity({ subject: "clerk_test_owner" });

      await authed.mutation(api.signature_fields.mutations.createField, {
        documentId,
        recipientId,
        fieldType: "signature",
        label: "Signature 1",
        isRequired: true,
        x: 10,
        y: 50,
        width: 30,
        height: 10,
        page: 1,
      });

      const secondFieldId = await authed.mutation(api.signature_fields.mutations.createField, {
        documentId,
        recipientId,
        fieldType: "signature",
        label: "Signature 2",
        isRequired: true,
        x: 10,
        y: 70,
        width: 30,
        height: 10,
        page: 1,
      });

      const secondField = (await t.run(async (ctx) => {
        return await ctx.db.get(secondFieldId);
      })) as Doc<"signature_fields"> | null;

      expect(secondField?.isMainSignature).toBeUndefined();
    });

    test("enforces one payment field per recipient", async () => {
      const authed = t.withIdentity({ subject: "clerk_test_owner" });

      await authed.mutation(api.signature_fields.mutations.createField, {
        documentId,
        recipientId,
        fieldType: "payment",
        label: "Payment 1",
        isRequired: true,
        x: 10,
        y: 10,
        width: 30,
        height: 10,
        page: 1,
      });

      await expect(
        authed.mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "payment",
          label: "Payment 2",
          isRequired: true,
          x: 10,
          y: 30,
          width: 30,
          height: 10,
          page: 1,
        }),
      ).rejects.toThrow("Each recipient can only have one payment field");
    });

    test("rejects when document is not draft", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "sent" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.signature_fields.mutations.createField, {
            documentId,
            recipientId,
            fieldType: "text",
            label: "Name",
            isRequired: true,
            x: 10,
            y: 10,
            width: 20,
            height: 5,
            page: 1,
          }),
      ).rejects.toThrow("Cannot modify fields");
    });

    test("rejects unauthenticated requests", async () => {
      await expect(
        t.mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "text",
          label: "Name",
          isRequired: true,
          x: 10,
          y: 10,
          width: 20,
          height: 5,
          page: 1,
        }),
      ).rejects.toThrow();
    });

    test("validates field position - negative width", async () => {
      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.signature_fields.mutations.createField, {
            documentId,
            recipientId,
            fieldType: "text",
            label: "Bad Field",
            isRequired: true,
            x: 10,
            y: 10,
            width: -10,
            height: 5,
            page: 1,
          }),
      ).rejects.toThrow("Width must be between 0 and 100");
    });
  });

  // ---------------------------------------------------------------------------
  // updateField
  // ---------------------------------------------------------------------------
  describe("updateField", () => {
    let fieldId: Id<"signature_fields">;

    beforeEach(async () => {
      fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "text",
          label: "Original Label",
          isRequired: false,
          x: 10,
          y: 10,
          width: 20,
          height: 5,
          page: 1,
        });
    });

    test("updates label and isRequired successfully", async () => {
      await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.updateField, {
          fieldId,
          label: "Updated Label",
          isRequired: true,
        });

      const field = (await t.run(async (ctx) => {
        return await ctx.db.get(fieldId);
      })) as Doc<"signature_fields"> | null;

      expect(field?.label).toBe("Updated Label");
      expect(field?.isRequired).toBe(true);
    });

    test("rejects when document is not draft", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "sent" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.signature_fields.mutations.updateField, {
            fieldId,
            label: "Should Fail",
          }),
      ).rejects.toThrow("Cannot modify fields");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteField
  // ---------------------------------------------------------------------------
  describe("deleteField", () => {
    test("deletes a field successfully", async () => {
      const fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "text",
          label: "To Delete",
          isRequired: false,
          x: 10,
          y: 10,
          width: 20,
          height: 5,
          page: 1,
        });

      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.deleteField, { fieldId });

      expect(result).toEqual({ success: true });

      const field = (await t.run(async (ctx) => {
        return await ctx.db.get(fieldId);
      })) as Doc<"signature_fields"> | null;

      expect(field).toBeNull();
    });

    test("cascade-deletes payment_field_configs for payment fields", async () => {
      const paymentFieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "payment",
          label: "Payment",
          isRequired: true,
          x: 10,
          y: 10,
          width: 30,
          height: 10,
          page: 1,
        });

      // Create a payment config linked to this field
      const configId = await t.run(async (ctx) => {
        return await ctx.db.insert("payment_field_configs", {
          fieldId: paymentFieldId,
          documentId,
          organizationId,
          paymentType: "one_time",
          items: [
            {
              id: "item-1",
              description: "Fee",
              quantity: 1,
              unitPrice: 5000,
            },
          ],
          totalAmountCents: 5000,
          currency: "usd",
          dueDateTerms: "net_30",
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          taxEnabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Delete the payment field
      await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.deleteField, {
          fieldId: paymentFieldId,
        });

      // Verify the payment config was also deleted
      const config = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(config).toBeNull();
    });

    test("rejects deleting a field that has signatures", async () => {
      const fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "signature",
          label: "Signed Field",
          isRequired: true,
          x: 10,
          y: 10,
          width: 30,
          height: 10,
          page: 1,
        });

      // Create a signature record linked to this field
      await t.run(async (ctx) => {
        await ctx.db.insert("signatures", {
          documentId,
          recipientId,
          fieldId,
          value: "John Doe",
          signatureMethod: "type",
          signedAt: Date.now(),
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.signature_fields.mutations.deleteField, { fieldId }),
      ).rejects.toThrow("Cannot delete field that has been signed");
    });

    test("rejects when document is not draft", async () => {
      const fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "text",
          label: "Locked Field",
          isRequired: false,
          x: 10,
          y: 10,
          width: 20,
          height: 5,
          page: 1,
        });

      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "sent" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.signature_fields.mutations.deleteField, { fieldId }),
      ).rejects.toThrow("Cannot modify fields");
    });
  });

  // ---------------------------------------------------------------------------
  // repositionField
  // ---------------------------------------------------------------------------
  describe("repositionField", () => {
    let fieldId: Id<"signature_fields">;

    beforeEach(async () => {
      fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          recipientId,
          fieldType: "text",
          label: "Movable",
          isRequired: false,
          x: 10,
          y: 10,
          width: 20,
          height: 5,
          page: 1,
        });
    });

    test("updates position successfully", async () => {
      await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.repositionField, {
          fieldId,
          x: 50,
          y: 60,
          width: 25,
          height: 8,
        });

      const field = (await t.run(async (ctx) => {
        return await ctx.db.get(fieldId);
      })) as Doc<"signature_fields"> | null;

      expect(field?.x).toBe(50);
      expect(field?.y).toBe(60);
      expect(field?.width).toBe(25);
      expect(field?.height).toBe(8);
    });

    test("rejects invalid position - negative values", async () => {
      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.signature_fields.mutations.repositionField, {
            fieldId,
            x: -5,
          }),
      ).rejects.toThrow();
    });

    test("rejects when document is not draft", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "sent" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.signature_fields.mutations.repositionField, {
            fieldId,
            x: 50,
          }),
      ).rejects.toThrow("Cannot modify fields");
    });
  });

  // ---------------------------------------------------------------------------
  // assignFieldToRecipient
  // ---------------------------------------------------------------------------
  describe("assignFieldToRecipient", () => {
    test("assigns unassigned field to a recipient", async () => {
      // Create field without a recipient
      const fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          fieldType: "text",
          label: "Unassigned",
          isRequired: true,
          x: 10,
          y: 10,
          width: 20,
          height: 5,
          page: 1,
        });

      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.assignFieldToRecipient, {
          fieldId,
          recipientId,
        });

      expect(result).toEqual({ success: true });

      const field = (await t.run(async (ctx) => {
        return await ctx.db.get(fieldId);
      })) as Doc<"signature_fields"> | null;

      expect(field?.recipientId).toBe(recipientId);
    });

    test("auto-sets isMainSignature when assigning first signature field", async () => {
      const fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          fieldType: "signature",
          label: "Unassigned Sig",
          isRequired: true,
          x: 10,
          y: 50,
          width: 30,
          height: 10,
          page: 1,
        });

      await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.assignFieldToRecipient, {
          fieldId,
          recipientId,
        });

      const field = (await t.run(async (ctx) => {
        return await ctx.db.get(fieldId);
      })) as Doc<"signature_fields"> | null;

      expect(field?.recipientId).toBe(recipientId);
      expect(field?.isMainSignature).toBe(true);
    });

    test("rejects when document is not draft", async () => {
      const fieldId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.createField, {
          documentId,
          fieldType: "text",
          label: "Will Lock",
          isRequired: false,
          x: 10,
          y: 10,
          width: 20,
          height: 5,
          page: 1,
        });

      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "sent" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.signature_fields.mutations.assignFieldToRecipient, {
            fieldId,
            recipientId,
          }),
      ).rejects.toThrow("Cannot modify fields");
    });
  });

  // ---------------------------------------------------------------------------
  // bulkCreateFields
  // ---------------------------------------------------------------------------
  describe("bulkCreateFields", () => {
    test("creates multiple fields at once and returns fieldIds and count", async () => {
      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.signature_fields.mutations.bulkCreateFields, {
          fields: [
            {
              documentId,
              recipientId,
              fieldType: "text",
              label: "Name",
              isRequired: true,
              x: 10,
              y: 10,
              width: 30,
              height: 5,
              page: 1,
            },
            {
              documentId,
              recipientId,
              fieldType: "signature",
              label: "Signature",
              isRequired: true,
              x: 10,
              y: 50,
              width: 30,
              height: 10,
              page: 1,
            },
            {
              documentId,
              recipientId,
              fieldType: "date",
              label: "Date",
              isRequired: false,
              x: 50,
              y: 10,
              width: 20,
              height: 5,
              page: 1,
            },
          ],
        });

      expect(result.count).toBe(3);
      expect(result.fieldIds).toHaveLength(3);

      // Verify all fields exist in the database
      for (const fieldId of result.fieldIds) {
        const field = (await t.run(async (ctx) => {
          return await ctx.db.get(fieldId);
        })) as Doc<"signature_fields"> | null;
        expect(field).toBeDefined();
        expect(field?.documentId).toBe(documentId);
      }
    });

    test("rejects unauthenticated requests", async () => {
      await expect(
        t.mutation(api.signature_fields.mutations.bulkCreateFields, {
          fields: [
            {
              documentId,
              recipientId,
              fieldType: "text",
              label: "Name",
              isRequired: true,
              x: 10,
              y: 10,
              width: 20,
              height: 5,
              page: 1,
            },
          ],
        }),
      ).rejects.toThrow();
    });

    test("rejects when document is not draft", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "sent" });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.signature_fields.mutations.bulkCreateFields, {
            fields: [
              {
                documentId,
                recipientId,
                fieldType: "text",
                label: "Should Fail",
                isRequired: true,
                x: 10,
                y: 10,
                width: 20,
                height: 5,
                page: 1,
              },
            ],
          }),
      ).rejects.toThrow("Cannot modify fields");
    });
  });
});
