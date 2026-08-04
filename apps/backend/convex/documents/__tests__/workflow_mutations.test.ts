import { beforeEach, describe, expect, test } from "vitest";

import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { seedTestOrganizationMember } from "../../testVortexAuth";

describe("Workflow mutations", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;
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
        authSubject: "test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId: ownerId,
        organizationId,
        role: "owner",
        status: "active",
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Document",
        ownerId,
        organizationId,
        status: "active",
        workflowStatus: "draft",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // sendDocument
  // ---------------------------------------------------------------------------
  describe("sendDocument", () => {
    test("transitions draft to active status and sets sentAt timestamp", async () => {
      // Add a recipient so sendDocument won't reject
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer@example.com",
          name: "Signer",
          role: "signer",
          status: "pending",
          signingToken: "test-token-signer",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const beforeSend = Date.now();

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.documents.workflow_mutations.sendDocument, {
          documentId,
        });

      expect(result.success).toBe(true);
      expect(result.recipientCount).toBe(1);

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });

      expect(doc?.status).toBe("active");
      expect(doc?.sentAt).toBeDefined();
      expect(doc?.sentAt).toBeGreaterThanOrEqual(beforeSend);
      expect(doc?.updatedAt).toBeGreaterThanOrEqual(beforeSend);
    });

    test("rejects if document has no recipients", async () => {
      await expect(
        t
          .withIdentity({ subject: "test_owner" })
          .mutation(api.documents.workflow_mutations.sendDocument, {
            documentId,
          })
      ).rejects.toThrow(
        "Document must have at least one recipient before sending"
      );
    });

    test("rejects if document is deleted", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { status: "deleted" });
      });

      await expect(
        t
          .withIdentity({ subject: "test_owner" })
          .mutation(api.documents.workflow_mutations.sendDocument, {
            documentId,
          })
      ).rejects.toThrow("Document not found");
    });

    test("rejects unauthenticated requests", async () => {
      await expect(
        t.mutation(api.documents.workflow_mutations.sendDocument, {
          documentId,
        })
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // cancelDocument
  // ---------------------------------------------------------------------------
  describe("cancelDocument", () => {
    test("transitions to cancelled with reason", async () => {
      // Set document to a cancellable state
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "sent" });
      });

      const beforeCancel = Date.now();

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.documents.workflow_mutations.cancelDocument, {
          documentId,
          reason: "Changed my mind",
        });

      expect(result.success).toBe(true);

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });

      expect(doc?.workflowStatus).toBe("cancelled");
      expect(doc?.cancelledAt).toBeDefined();
      expect(doc?.cancelledAt).toBeGreaterThanOrEqual(beforeCancel);
      expect(doc?.updatedAt).toBeGreaterThanOrEqual(beforeCancel);
    });

    test("rejects if document is completed", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "completed" });
      });

      await expect(
        t
          .withIdentity({ subject: "test_owner" })
          .mutation(api.documents.workflow_mutations.cancelDocument, {
            documentId,
          })
      ).rejects.toThrow("Cannot cancel a completed document");
    });

    test("cancels pending reminders", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "sent" });
      });

      // Create a recipient and a scheduled reminder
      const recipientId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer@example.com",
          name: "Signer",
          role: "signer",
          status: "pending",
          signingToken: "test-token-reminder",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const reminderId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_reminders", {
          documentId,
          recipientId,
          type: "automated",
          status: "scheduled",
          scheduledFor: Date.now() + 86_400_000,
          createdBy: ownerId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.documents.workflow_mutations.cancelDocument, {
          documentId,
        });

      expect(result.success).toBe(true);
      expect(result.remindersCancelled).toBe(1);

      const reminder = await t.run(async (ctx) => {
        return await ctx.db.get(reminderId);
      });

      expect(reminder?.status).toBe("cancelled");
      expect(reminder?.cancelledAt).toBeDefined();
    });

    test("rejects unauthenticated requests", async () => {
      await expect(
        t.mutation(api.documents.workflow_mutations.cancelDocument, {
          documentId,
        })
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // checkAndCompleteWorkflow
  // ---------------------------------------------------------------------------
  describe("checkAndCompleteWorkflow", () => {
    test("marks completed when all recipients have signed", async () => {
      // Set document to in_progress
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "in_progress" });
      });

      // Add signed recipients
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer1@example.com",
          name: "Signer 1",
          role: "signer",
          status: "signed",
          signingToken: "token-s1",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer2@example.com",
          name: "Signer 2",
          role: "signer",
          status: "signed",
          signingToken: "token-s2",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const beforeComplete = Date.now();

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.documents.workflow_mutations.checkAndCompleteWorkflow, {
          documentId,
        });

      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });

      expect(doc?.workflowStatus).toBe("completed");
      expect(doc?.completedAt).toBeDefined();
      expect(doc?.completedAt).toBeGreaterThanOrEqual(beforeComplete);
    });

    test("stays in_progress when pending recipients remain", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "in_progress" });
      });

      // One signed, one pending
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer1@example.com",
          name: "Signer 1",
          role: "signer",
          status: "signed",
          signingToken: "token-s1",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer2@example.com",
          name: "Signer 2",
          role: "signer",
          status: "pending",
          signingToken: "token-s2",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.documents.workflow_mutations.checkAndCompleteWorkflow, {
          documentId,
        });

      expect(result.success).toBe(true);
      expect(result.completed).toBe(false);
      expect(result.reason).toBe("pending_recipients");

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });

      expect(doc?.workflowStatus).toBe("in_progress");
    });

    test("sets waiting_for_payment when signatures done but payments pending", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "in_progress" });
      });

      // Add a signed recipient
      const recipientId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer@example.com",
          name: "Signer",
          role: "signer",
          status: "signed",
          signingToken: "token-s1",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Create a signature field and payment config with pending status
      const fieldId = await t.run(async (ctx) => {
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

      await t.run(async (ctx) => {
        await ctx.db.insert("payment_field_configs", {
          fieldId,
          documentId,
          organizationId,
          paymentType: "one_time",
          items: [
            { id: "item-1", description: "Fee", quantity: 1, unitPrice: 5000 },
          ],
          totalAmountCents: 5000,
          currency: "usd",
          dueDateTerms: "on_receipt",
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          paymentStatus: "pending",
          taxEnabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.documents.workflow_mutations.checkAndCompleteWorkflow, {
          documentId,
        });

      expect(result.success).toBe(true);
      expect(result.completed).toBe(false);
      expect(result.reason).toBe("waiting_for_payment");

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });

      expect(doc?.workflowStatus).toBe("waiting_for_payment");
    });

    test("returns already_final for completed documents", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "completed" });
      });

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.documents.workflow_mutations.checkAndCompleteWorkflow, {
          documentId,
        });

      expect(result.success).toBe(true);
      expect(result.completed).toBe(false);
      expect(result.reason).toBe("already_final");
    });

    test("returns no_recipients when document has no recipients", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, { workflowStatus: "in_progress" });
      });

      const result = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.documents.workflow_mutations.checkAndCompleteWorkflow, {
          documentId,
        });

      expect(result.success).toBe(true);
      expect(result.completed).toBe(false);
      expect(result.reason).toBe("no_recipients");
    });
  });

  // ---------------------------------------------------------------------------
  // checkPaymentCompletionAndFinalize
  // ---------------------------------------------------------------------------
  describe("checkPaymentCompletionAndFinalize", () => {
    test("transitions waiting_for_payment to completed when all payments done", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, {
          workflowStatus: "waiting_for_payment",
        });
      });

      // Create a recipient and paid payment config
      const recipientId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer@example.com",
          name: "Signer",
          role: "signer",
          status: "signed",
          signingToken: "token-pf",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const fieldId = await t.run(async (ctx) => {
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

      await t.run(async (ctx) => {
        await ctx.db.insert("payment_field_configs", {
          fieldId,
          documentId,
          organizationId,
          paymentType: "one_time",
          items: [
            { id: "item-1", description: "Fee", quantity: 1, unitPrice: 5000 },
          ],
          totalAmountCents: 5000,
          currency: "usd",
          dueDateTerms: "on_receipt",
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          paymentStatus: "paid",
          taxEnabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const beforeComplete = Date.now();

      const result = await t.mutation(
        internal.documents.workflow_mutations.checkPaymentCompletionAndFinalize,
        { documentId }
      );

      expect(result.completed).toBe(true);

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });

      expect(doc?.workflowStatus).toBe("completed");
      expect(doc?.completedAt).toBeDefined();
      expect(doc?.completedAt).toBeGreaterThanOrEqual(beforeComplete);
    });

    test("does not complete when payments are still pending", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(documentId, {
          workflowStatus: "waiting_for_payment",
        });
      });

      const recipientId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer@example.com",
          name: "Signer",
          role: "signer",
          status: "signed",
          signingToken: "token-pf2",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const fieldId = await t.run(async (ctx) => {
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

      await t.run(async (ctx) => {
        await ctx.db.insert("payment_field_configs", {
          fieldId,
          documentId,
          organizationId,
          paymentType: "one_time",
          items: [
            { id: "item-1", description: "Fee", quantity: 1, unitPrice: 5000 },
          ],
          totalAmountCents: 5000,
          currency: "usd",
          dueDateTerms: "on_receipt",
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          paymentStatus: "awaiting",
          taxEnabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(
        internal.documents.workflow_mutations.checkPaymentCompletionAndFinalize,
        { documentId }
      );

      expect(result.completed).toBe(false);
      expect(result.reason).toBe("payments_pending");

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });

      expect(doc?.workflowStatus).toBe("waiting_for_payment");
    });

    test("returns not_waiting_for_payment for documents in other states", async () => {
      // Document is still in draft
      const result = await t.mutation(
        internal.documents.workflow_mutations.checkPaymentCompletionAndFinalize,
        { documentId }
      );

      expect(result.completed).toBe(false);
      expect(result.reason).toBe("not_waiting_for_payment");
    });

    test("returns document_not_found for missing document", async () => {
      // Delete the document
      await t.run(async (ctx) => {
        await ctx.db.delete(documentId);
      });

      const result = await t.mutation(
        internal.documents.workflow_mutations.checkPaymentCompletionAndFinalize,
        { documentId }
      );

      expect(result.completed).toBe(false);
      expect(result.reason).toBe("document_not_found");
    });
  });
});
