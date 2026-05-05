import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

/**
 * Integration tests for the post-signature workflow steps that actually
 * send email through @convex-dev/resend.
 *
 * Real Resend SDK calls won't fly in test (no network mock, no sandbox key),
 * so each email helper inside `documents/email.ts` is wrapped in a try/catch
 * and returns `{ success: false, error }` rather than throwing. The workflow
 * steps that call them therefore always resolve cleanly.
 *
 * These tests pin that contract down so a refactor that lets an exception
 * escape — and stalls the durable workflow indefinitely on retry — fails
 * loudly instead of shipping silently.
 */

describe("workflows/document_completion_steps", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;
  let documentId: Id<"documents">;
  let recipientId: Id<"document_recipients">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run((ctx) =>
      ctx.db.insert("organizations", {
        name: "Resend Test Org",
        slug: "resend-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      }),
    );

    userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "owner@example.com",
        name: "Owner User",
        clerkId: "clerk_test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      }),
    );

    documentId = await t.run((ctx) =>
      ctx.db.insert("documents", {
        name: "Resend Test Document",
        ownerId: userId,
        organizationId,
        status: "active",
        workflowStatus: "sent",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage_resend_test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    // Recipient is already in the terminal state — sendSignerConfirmation
    // only acts when isRecipientComplete is true, so we set status="signed".
    recipientId = await t.run((ctx) =>
      ctx.db.insert("document_recipients", {
        documentId,
        email: "signer@example.com",
        name: "Signer One",
        role: "signer",
        status: "signed",
        order: 1,
        signingToken: "tok_resend_test",
        tokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
        signedAt: Date.now(),
        sentAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  });

  describe("sendSignerConfirmation", () => {
    test("resolves cleanly when the recipient is in a terminal state", async () => {
      // The action wraps sendSigningComplete which catches Resend errors and
      // returns {success: false}. Either outcome is fine — the contract is
      // "doesn't throw, returns a {sent: boolean}" so the durable workflow
      // can move on instead of retry-stalling forever.
      const result = await t.action(
        internal.workflows.document_completion_steps.sendSignerConfirmation,
        { recipientId, documentId },
      );

      expect(result).toEqual(expect.objectContaining({ sent: expect.any(Boolean) }));
    });

    test("returns sent:false when the recipient has not actually completed", async () => {
      // Reset to a non-terminal status — the helper short-circuits on
      // isRecipientComplete being false, never touching Resend.
      await t.run((ctx) => ctx.db.patch(recipientId, { status: "pending", signedAt: undefined }));

      const result = await t.action(
        internal.workflows.document_completion_steps.sendSignerConfirmation,
        { recipientId, documentId },
      );

      expect(result.sent).toBe(false);
    });

    test("returns sent:false when the recipient was deleted before the step ran", async () => {
      // Workflows are durable — the recipient/doc may have been cleaned up
      // between status change and this step firing. The step has to handle
      // that without throwing or the workflow stalls in retry.
      await t.run((ctx) => ctx.db.delete(recipientId));

      const result = await t.action(
        internal.workflows.document_completion_steps.sendSignerConfirmation,
        { recipientId, documentId },
      );

      expect(result.sent).toBe(false);
    });
  });

  describe("checkAllRecipientsComplete", () => {
    test("returns allComplete:true when the only signer has signed", async () => {
      const result = await t.query(
        internal.workflows.document_completion_steps.checkAllRecipientsComplete,
        { documentId },
      );
      expect(result.allComplete).toBe(true);
    });

    test("returns allComplete:false when any recipient is still pending", async () => {
      await t.run((ctx) =>
        ctx.db.insert("document_recipients", {
          documentId,
          email: "second@example.com",
          name: "Second Signer",
          role: "signer",
          status: "pending",
          order: 2,
          signingToken: "tok_resend_test_2",
          tokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      );

      const result = await t.query(
        internal.workflows.document_completion_steps.checkAllRecipientsComplete,
        { documentId },
      );
      expect(result.allComplete).toBe(false);
    });
  });

  describe("triggerDocumentCompletion", () => {
    test("returns shouldComplete:true the first time and false on a re-fire", async () => {
      const first = await t.mutation(
        internal.workflows.document_completion_steps.triggerDocumentCompletion,
        { documentId },
      );
      expect(first.shouldComplete).toBe(true);

      // Mark complete the way the next workflow step would.
      await t.run((ctx) =>
        ctx.db.patch(documentId, {
          workflowStatus: "completed",
          completedAt: Date.now(),
          updatedAt: Date.now(),
        }),
      );

      const second = await t.mutation(
        internal.workflows.document_completion_steps.triggerDocumentCompletion,
        { documentId },
      );
      expect(second.shouldComplete).toBe(false);
    });

    test("returns shouldComplete:false when the document is missing or deleted", async () => {
      await t.run((ctx) => ctx.db.patch(documentId, { status: "deleted" }));

      const result = await t.mutation(
        internal.workflows.document_completion_steps.triggerDocumentCompletion,
        { documentId },
      );
      expect(result.shouldComplete).toBe(false);
    });
  });
});
