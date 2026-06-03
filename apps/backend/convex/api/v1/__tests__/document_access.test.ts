// Set before imports — bulkSendDocuments schedules sendDocumentEmailsInternal which imports Resend
process.env.RESEND_API_KEY = "re_test_dummy";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/documents — access and bulk operations", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  type WorkflowStatus =
    | "draft"
    | "sent"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "declined"
    | "expired"
    | "waiting_for_payment";

  async function insertDocument(
    overrides: {
      workflowStatus?: WorkflowStatus;
      sharingMode?: "private" | "workspace" | "specific";
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
        sharingMode: overrides.sharingMode ?? "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-doc-access-test",
        createdAt: BASE_TIME,
        updatedAt: BASE_TIME,
        ...(overrides.workflowStatus ? { workflowStatus: overrides.workflowStatus } : {}),
      });
    });
  }

  async function insertRecipient(documentId: Id<"documents">) {
    const now = BASE_TIME;
    return t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "recipient@test.com",
        name: "Test Recipient",
        role: "signer",
        status: "pending",
        order: 0,
        signingToken: `token-${Math.random().toString(36).slice(2)}`,
        tokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    // Prevent convex-test from auto-executing runAfter(0, ...) scheduled functions.
    // bulkSendDocuments schedules sendDocumentEmailsInternal which cascades
    // writes outside a transaction in the test environment.
    vi.useFakeTimers();
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Document Access Org",
        slug: "doc-access-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: BASE_TIME,
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-doc-access",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: BASE_TIME,
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@doc-access.com",
        name: "Owner",
        authSubject: "doc_access_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // getDocumentAccess
  // =========================================================================

  describe("getDocumentAccess", () => {
    test("returns private sharing mode by default", async () => {
      const documentId = await insertDocument();

      const result = await t.query(internal.api.v1.documents.getDocumentAccess, {
        userId,
        organizationId,
        documentId,
      });

      expect(result).not.toBeNull();
      expect(result?.document_id).toBe(documentId);
      expect(result?.sharing_mode).toBe("private");
    });

    test("returns workspace sharing mode when set", async () => {
      const documentId = await insertDocument({ sharingMode: "workspace" });

      const result = await t.query(internal.api.v1.documents.getDocumentAccess, {
        userId,
        organizationId,
        documentId,
      });

      expect(result?.sharing_mode).toBe("workspace");
    });

    test("returns specific sharing mode when set", async () => {
      const documentId = await insertDocument({ sharingMode: "specific" });

      const result = await t.query(internal.api.v1.documents.getDocumentAccess, {
        userId,
        organizationId,
        documentId,
      });

      expect(result?.sharing_mode).toBe("specific");
    });

    test("returns null for document in different org", async () => {
      const documentId = await insertDocument({ organizationId: otherOrgId });

      const result = await t.query(internal.api.v1.documents.getDocumentAccess, {
        userId,
        organizationId,
        documentId,
      });

      expect(result).toBeNull();
    });

    test("returns null for deleted document", async () => {
      const documentId = await insertDocument({ status: "deleted" });

      const result = await t.query(internal.api.v1.documents.getDocumentAccess, {
        userId,
        organizationId,
        documentId,
      });

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // updateDocumentAccess
  // =========================================================================

  describe("updateDocumentAccess", () => {
    test("changes sharing mode to workspace", async () => {
      const documentId = await insertDocument({ sharingMode: "private" });

      const result = await t.mutation(internal.api.v1.documents.updateDocumentAccess, {
        userId,
        organizationId,
        documentId,
        sharing_mode: "workspace",
      });

      expect(result.success).toBe(true);

      const access = await t.query(internal.api.v1.documents.getDocumentAccess, {
        userId,
        organizationId,
        documentId,
      });
      expect(access?.sharing_mode).toBe("workspace");
    });

    test("changes sharing mode back to private", async () => {
      const documentId = await insertDocument({ sharingMode: "workspace" });

      await t.mutation(internal.api.v1.documents.updateDocumentAccess, {
        userId,
        organizationId,
        documentId,
        sharing_mode: "private",
      });

      const access = await t.query(internal.api.v1.documents.getDocumentAccess, {
        userId,
        organizationId,
        documentId,
      });
      expect(access?.sharing_mode).toBe("private");
    });

    test("throws for document in different org", async () => {
      const documentId = await insertDocument({ organizationId: otherOrgId });

      await expect(
        t.mutation(internal.api.v1.documents.updateDocumentAccess, {
          userId,
          organizationId,
          documentId,
          sharing_mode: "workspace",
        }),
      ).rejects.toThrow("Document not found");
    });

    test("throws for deleted document", async () => {
      const documentId = await insertDocument({ status: "deleted" });

      await expect(
        t.mutation(internal.api.v1.documents.updateDocumentAccess, {
          userId,
          organizationId,
          documentId,
          sharing_mode: "workspace",
        }),
      ).rejects.toThrow("Document not found");
    });
  });

  // =========================================================================
  // bulkVoidDocuments
  // =========================================================================

  describe("bulkVoidDocuments", () => {
    test("voids draft documents and returns succeeded count", async () => {
      const doc1 = await insertDocument({ workflowStatus: "draft" });
      const doc2 = await insertDocument({ workflowStatus: "sent" });

      const result = await t.mutation(internal.api.v1.documents.bulkVoidDocuments, {
        userId,
        organizationId,
        document_ids: [doc1, doc2],
        reason: "Test void",
      });

      expect(result.total_requested).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results.every((r: (typeof result.results)[number]) => r.success)).toBe(true);

      // Verify documents are now cancelled
      const updatedDoc1 = await t.run(async (ctx) => ctx.db.get(doc1));
      expect(updatedDoc1?.workflowStatus).toBe("cancelled");
    });

    test("reports failure for already-completed documents", async () => {
      const completedDoc = await insertDocument({ workflowStatus: "completed" });
      const draftDoc = await insertDocument({ workflowStatus: "draft" });

      const result = await t.mutation(internal.api.v1.documents.bulkVoidDocuments, {
        userId,
        organizationId,
        document_ids: [completedDoc, draftDoc],
        reason: "Test",
      });

      expect(result.total_requested).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);

      const completedResult = result.results.find(
        (r: (typeof result.results)[number]) => r.id === completedDoc,
      );
      expect(completedResult?.success).toBe(false);
      expect(completedResult?.error).toContain("Cannot void");
    });

    test("reports failure for already-cancelled documents", async () => {
      const cancelledDoc = await insertDocument({ workflowStatus: "cancelled" });

      const result = await t.mutation(internal.api.v1.documents.bulkVoidDocuments, {
        userId,
        organizationId,
        document_ids: [cancelledDoc],
        reason: "Test",
      });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      const r = result.results[0];
      expect(r?.success).toBe(false);
      expect(r?.error).toContain("cancelled");
    });

    test("reports failure for already-declined documents", async () => {
      const declinedDoc = await insertDocument({ workflowStatus: "declined" });

      const result = await t.mutation(internal.api.v1.documents.bulkVoidDocuments, {
        userId,
        organizationId,
        document_ids: [declinedDoc],
        reason: "Test",
      });

      expect(result.failed).toBe(1);
      const r = result.results[0];
      expect(r?.success).toBe(false);
      expect(r?.error).toContain("declined");
    });

    test("reports failure for document in different org", async () => {
      const otherDoc = await insertDocument({
        organizationId: otherOrgId,
        workflowStatus: "draft",
      });

      const result = await t.mutation(internal.api.v1.documents.bulkVoidDocuments, {
        userId,
        organizationId,
        document_ids: [otherDoc],
        reason: "Test",
      });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0]?.error).toBe("Document not found");
    });

    test("returns empty results for empty input", async () => {
      const result = await t.mutation(internal.api.v1.documents.bulkVoidDocuments, {
        userId,
        organizationId,
        document_ids: [],
        reason: "Test",
      });

      expect(result.total_requested).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  // =========================================================================
  // bulkSendDocuments
  // =========================================================================

  describe("bulkSendDocuments", () => {
    test("sends draft documents that have recipients", async () => {
      const doc1 = await insertDocument({ workflowStatus: "draft" });
      const doc2 = await insertDocument({ workflowStatus: "draft" });
      await insertRecipient(doc1);
      await insertRecipient(doc2);

      const result = await t.mutation(internal.api.v1.documents.bulkSendDocuments, {
        userId,
        organizationId,
        document_ids: [doc1, doc2],
      });

      expect(result.total_requested).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);

      // Verify documents moved to sent
      const updatedDoc1 = await t.run(async (ctx) => ctx.db.get(doc1));
      expect(updatedDoc1?.workflowStatus).toBe("sent");
    });

    test("reports failure for non-draft document", async () => {
      const sentDoc = await insertDocument({ workflowStatus: "sent" });
      await insertRecipient(sentDoc);

      const result = await t.mutation(internal.api.v1.documents.bulkSendDocuments, {
        userId,
        organizationId,
        document_ids: [sentDoc],
      });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0]?.error).toContain("not in draft status");
    });

    test("reports failure for draft document with no recipients", async () => {
      const draftDoc = await insertDocument({ workflowStatus: "draft" });
      // No recipients inserted

      const result = await t.mutation(internal.api.v1.documents.bulkSendDocuments, {
        userId,
        organizationId,
        document_ids: [draftDoc],
      });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0]?.error).toBe("Document has no recipients");
    });

    test("reports failure for document in different org", async () => {
      const otherDoc = await insertDocument({
        organizationId: otherOrgId,
        workflowStatus: "draft",
      });
      await insertRecipient(otherDoc);

      const result = await t.mutation(internal.api.v1.documents.bulkSendDocuments, {
        userId,
        organizationId,
        document_ids: [otherDoc],
      });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0]?.error).toBe("Document not found");
    });

    test("partial success — mixes sent and failed", async () => {
      const goodDoc = await insertDocument({ workflowStatus: "draft" });
      const noRecipientsDoc = await insertDocument({ workflowStatus: "draft" });
      await insertRecipient(goodDoc);
      // No recipients for noRecipientsDoc

      const result = await t.mutation(internal.api.v1.documents.bulkSendDocuments, {
        userId,
        organizationId,
        document_ids: [goodDoc, noRecipientsDoc],
      });

      expect(result.total_requested).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    });
  });
});
