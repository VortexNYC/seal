import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import {
  getDocumentAuditTrail,
  getOrganizationAuditTrail,
  getRecipientAuditTrail,
  logAction,
  logDocumentAction,
  logFieldAction,
  logRecipientAction,
} from "../helpers";

describe("audit_logs/helpers", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;
  let documentId: Id<"documents">;
  let recipientId: Id<"document_recipients">;

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

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "user@test.com",
        name: "Test User",
        clerkId: "clerk_test_user",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Document",
        ownerId: userId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "signer@test.com",
        name: "Test Signer",
        role: "signer",
        status: "pending",
        order: 1,
        signingToken: "tok_test_123",
        tokenExpiresAt: Date.now() + 86400000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // logAction
  // ---------------------------------------------------------------------------
  describe("logAction", () => {
    test("creates audit record with all required fields", async () => {
      const logId = await t.run(async (ctx) => {
        return await logAction(ctx, {
          organizationId,
          userId: "clerk_test_user",
          actorType: "user",
          actorId: "clerk_test_user",
          action: "document.created",
          resourceType: "document",
          resourceId: documentId,
          documentId,
          ipAddress: "192.168.1.1",
          userAgent: "TestAgent/1.0",
        });
      });

      expect(logId).toBeDefined();

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record).not.toBeNull();
      expect(record!.organizationId).toBe(organizationId);
      expect(record!.userId).toBe("clerk_test_user");
      expect(record!.actorType).toBe("user");
      expect(record!.actorId).toBe("clerk_test_user");
      expect(record!.action).toBe("document.created");
      expect(record!.resourceType).toBe("document");
      expect(record!.resourceId).toBe(documentId);
      expect(record!.documentId).toBe(documentId);
      expect(record!.ipAddress).toBe("192.168.1.1");
      expect(record!.userAgent).toBe("TestAgent/1.0");
      expect(record!.createdAt).toBeTypeOf("number");
    });

    test("creates audit record with optional fields omitted", async () => {
      const logId = await t.run(async (ctx) => {
        return await logAction(ctx, {
          organizationId,
          actorType: "system",
          action: "document.completed",
          resourceType: "document",
          ipAddress: "0.0.0.0",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record).not.toBeNull();
      expect(record!.organizationId).toBe(organizationId);
      expect(record!.actorType).toBe("system");
      expect(record!.action).toBe("document.completed");
      expect(record!.userId).toBeUndefined();
      expect(record!.actorId).toBeUndefined();
      expect(record!.documentId).toBeUndefined();
      expect(record!.recipientId).toBeUndefined();
      expect(record!.oldValues).toBeUndefined();
      expect(record!.newValues).toBeUndefined();
      expect(record!.metadata).toBeUndefined();
      expect(record!.userAgent).toBeUndefined();
    });

    test("stores metadata when provided", async () => {
      const logId = await t.run(async (ctx) => {
        return await logAction(ctx, {
          organizationId,
          actorType: "user",
          actorId: "clerk_test_user",
          action: "document.sent",
          resourceType: "document",
          resourceId: documentId,
          metadata: {
            description: "Document sent to recipients",
            source: "api",
            sessionId: "sess_abc123",
          },
          ipAddress: "10.0.0.1",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record!.metadata).toEqual({
        description: "Document sent to recipients",
        source: "api",
        sessionId: "sess_abc123",
      });
    });

    test("stores oldValues and newValues for change tracking", async () => {
      const logId = await t.run(async (ctx) => {
        return await logAction(ctx, {
          organizationId,
          userId: "clerk_test_user",
          actorType: "user",
          actorId: "clerk_test_user",
          action: "document.updated",
          resourceType: "document",
          resourceId: documentId,
          documentId,
          oldValues: { title: "Old Title" },
          newValues: { title: "New Title" },
          ipAddress: "10.0.0.1",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record!.oldValues).toEqual({ title: "Old Title" });
      expect(record!.newValues).toEqual({ title: "New Title" });
    });
  });

  // ---------------------------------------------------------------------------
  // logFieldAction
  // ---------------------------------------------------------------------------
  describe("logFieldAction", () => {
    test("creates record with field-specific details", async () => {
      const fieldId = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          recipientId,
          fieldType: "signature",
          label: "Signature",
          isRequired: true,
          page: 1,
          x: 100,
          y: 200,
          width: 200,
          height: 50,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const logId = await t.run(async (ctx) => {
        return await logFieldAction(ctx, {
          organizationId,
          userId: "clerk_test_user",
          action: "field.created",
          fieldId,
          documentId,
          recipientId,
          newValues: { fieldType: "signature", page: 1 },
          ipAddress: "192.168.1.1",
          userAgent: "TestAgent/1.0",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record).not.toBeNull();
      expect(record!.action).toBe("field.created");
      expect(record!.resourceType).toBe("signature_field");
      expect(record!.resourceId).toBe(fieldId);
      expect(record!.documentId).toBe(documentId);
      expect(record!.recipientId).toBe(recipientId);
      expect(record!.actorType).toBe("user");
      expect(record!.actorId).toBe("clerk_test_user");
      expect(record!.newValues).toEqual({ fieldType: "signature", page: 1 });
      expect(record!.metadata).toEqual({
        description: "Field created for document",
        source: "web",
      });
    });

    test("creates record for field.deleted action", async () => {
      const fieldId = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          recipientId,
          fieldType: "text",
          label: "Full Name",
          isRequired: false,
          page: 1,
          x: 50,
          y: 100,
          width: 150,
          height: 30,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const logId = await t.run(async (ctx) => {
        return await logFieldAction(ctx, {
          organizationId,
          userId: "clerk_test_user",
          action: "field.deleted",
          fieldId,
          documentId,
          oldValues: { fieldType: "text", page: 1 },
          ipAddress: "10.0.0.1",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record!.action).toBe("field.deleted");
      expect(record!.metadata).toEqual({
        description: "Field deleted for document",
        source: "web",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // logDocumentAction
  // ---------------------------------------------------------------------------
  describe("logDocumentAction", () => {
    test("creates record with document action", async () => {
      const logId = await t.run(async (ctx) => {
        return await logDocumentAction(ctx, {
          organizationId,
          userId: "clerk_test_user",
          action: "document.sent",
          documentId,
          description: "Document sent to 3 recipients",
          ipAddress: "192.168.1.1",
          userAgent: "Chrome/120",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record).not.toBeNull();
      expect(record!.action).toBe("document.sent");
      expect(record!.resourceType).toBe("document");
      expect(record!.resourceId).toBe(documentId);
      expect(record!.documentId).toBe(documentId);
      expect(record!.actorType).toBe("user");
      expect(record!.actorId).toBe("clerk_test_user");
      expect(record!.userId).toBe("clerk_test_user");
      expect(record!.metadata).toEqual({
        description: "Document sent to 3 recipients",
        source: "web",
      });
      expect(record!.ipAddress).toBe("192.168.1.1");
      expect(record!.userAgent).toBe("Chrome/120");
    });

    test("creates record without optional description", async () => {
      const logId = await t.run(async (ctx) => {
        return await logDocumentAction(ctx, {
          organizationId,
          userId: "clerk_test_user",
          action: "document.cancelled",
          documentId,
          ipAddress: "10.0.0.1",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record!.action).toBe("document.cancelled");
      expect(record!.metadata).toEqual({
        description: undefined,
        source: "web",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // logRecipientAction
  // ---------------------------------------------------------------------------
  describe("logRecipientAction", () => {
    test("creates record with recipient action (token-based)", async () => {
      const logId = await t.run(async (ctx) => {
        return await logRecipientAction(ctx, {
          organizationId,
          actorType: "recipient",
          actorId: recipientId,
          action: "recipient.signed",
          documentId,
          recipientId,
          newValues: { status: "signed" },
          ipAddress: "203.0.113.42",
          userAgent: "Safari/17",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record).not.toBeNull();
      expect(record!.action).toBe("recipient.signed");
      expect(record!.resourceType).toBe("recipient");
      expect(record!.resourceId).toBe(recipientId);
      expect(record!.documentId).toBe(documentId);
      expect(record!.recipientId).toBe(recipientId);
      expect(record!.actorType).toBe("recipient");
      expect(record!.actorId).toBe(recipientId);
      expect(record!.userId).toBeUndefined();
      expect(record!.newValues).toEqual({ status: "signed" });
      expect(record!.metadata).toEqual({
        description: "Recipient signed",
        source: "web",
      });
    });

    test("creates record with recipient action (authenticated user)", async () => {
      const logId = await t.run(async (ctx) => {
        return await logRecipientAction(ctx, {
          organizationId,
          actorType: "user",
          actorId: "clerk_test_user",
          userId: "clerk_test_user",
          action: "recipient.added",
          documentId,
          recipientId,
          newValues: { email: "signer@test.com", role: "signer" },
          ipAddress: "10.0.0.1",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record!.action).toBe("recipient.added");
      expect(record!.actorType).toBe("user");
      expect(record!.userId).toBe("clerk_test_user");
      expect(record!.metadata).toEqual({
        description: "Recipient added",
        source: "web",
      });
    });

    test("creates record for esign consent", async () => {
      const logId = await t.run(async (ctx) => {
        return await logRecipientAction(ctx, {
          organizationId,
          actorType: "recipient",
          actorId: recipientId,
          action: "recipient.esign_consent",
          documentId,
          recipientId,
          ipAddress: "203.0.113.42",
          userAgent: "Firefox/121",
        });
      });

      const record = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(record!.action).toBe("recipient.esign_consent");
      expect(record!.metadata).toEqual({
        description: "Recipient esign_consent",
        source: "web",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getDocumentAuditTrail
  // ---------------------------------------------------------------------------
  describe("getDocumentAuditTrail", () => {
    test("returns records for document ordered by timestamp desc", async () => {
      // Insert 3 logs with different timestamps
      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "user",
          action: "document.created",
          resourceType: "document",
          documentId,
          ipAddress: "10.0.0.1",
        });
      });

      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "user",
          action: "document.sent",
          resourceType: "document",
          documentId,
          ipAddress: "10.0.0.1",
        });
      });

      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "recipient",
          action: "recipient.signed",
          resourceType: "recipient",
          documentId,
          recipientId,
          ipAddress: "10.0.0.2",
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getDocumentAuditTrail(ctx, documentId);
      });

      expect(trail).toHaveLength(3);
      // Descending order: newest first
      expect(trail[0].createdAt).toBeGreaterThanOrEqual(trail[1].createdAt);
      expect(trail[1].createdAt).toBeGreaterThanOrEqual(trail[2].createdAt);
      // All records belong to same document
      for (const log of trail) {
        expect(log.documentId).toBe(documentId);
      }
    });

    test("returns empty array when no logs exist for document", async () => {
      const otherDocId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          name: "Other Doc",
          ownerId: userId,
          organizationId,
          status: "active",
          sharingMode: "private",
          fileSize: 512,
          fileType: "application/pdf",
          storageId: "storage-other-1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getDocumentAuditTrail(ctx, otherDocId);
      });

      expect(trail).toEqual([]);
    });

    test("does not include logs from other documents", async () => {
      const otherDocId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          name: "Other Doc",
          ownerId: userId,
          organizationId,
          status: "active",
          sharingMode: "private",
          fileSize: 512,
          fileType: "application/pdf",
          storageId: "storage-other-2",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "user",
          action: "document.created",
          resourceType: "document",
          documentId,
          ipAddress: "10.0.0.1",
        });
      });

      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "user",
          action: "document.created",
          resourceType: "document",
          documentId: otherDocId,
          ipAddress: "10.0.0.1",
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getDocumentAuditTrail(ctx, documentId);
      });

      expect(trail).toHaveLength(1);
      expect(trail[0].documentId).toBe(documentId);
    });
  });

  // ---------------------------------------------------------------------------
  // getOrganizationAuditTrail
  // ---------------------------------------------------------------------------
  describe("getOrganizationAuditTrail", () => {
    test("returns records for organization ordered by timestamp desc", async () => {
      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "user",
          action: "document.created",
          resourceType: "document",
          ipAddress: "10.0.0.1",
        });
      });

      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "user",
          action: "document.sent",
          resourceType: "document",
          ipAddress: "10.0.0.1",
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getOrganizationAuditTrail(ctx, organizationId);
      });

      expect(trail).toHaveLength(2);
      expect(trail[0].createdAt).toBeGreaterThanOrEqual(trail[1].createdAt);
      for (const log of trail) {
        expect(log.organizationId).toBe(organizationId);
      }
    });

    test("respects limit parameter", async () => {
      // Insert 5 records
      for (let i = 0; i < 5; i++) {
        await t.run(async (ctx) => {
          await logAction(ctx, {
            organizationId,
            actorType: "user",
            action: "document.created",
            resourceType: "document",
            ipAddress: "10.0.0.1",
          });
        });
      }

      const trail = await t.run(async (ctx) => {
        return await getOrganizationAuditTrail(ctx, organizationId, 3);
      });

      expect(trail).toHaveLength(3);
    });

    test("defaults to 100 limit", async () => {
      // Insert 3 records and confirm all are returned (under default limit)
      for (let i = 0; i < 3; i++) {
        await t.run(async (ctx) => {
          await logAction(ctx, {
            organizationId,
            actorType: "user",
            action: "document.created",
            resourceType: "document",
            ipAddress: "10.0.0.1",
          });
        });
      }

      const trail = await t.run(async (ctx) => {
        return await getOrganizationAuditTrail(ctx, organizationId);
      });

      expect(trail).toHaveLength(3);
    });

    test("returns empty array for org with no logs", async () => {
      const otherOrgId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Other Org",
          slug: "other-org",
          type: "company",
          isActive: true,
          timezone: "UTC",
          updatedAt: Date.now(),
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getOrganizationAuditTrail(ctx, otherOrgId);
      });

      expect(trail).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getRecipientAuditTrail
  // ---------------------------------------------------------------------------
  describe("getRecipientAuditTrail", () => {
    test("returns records filtered by recipientId", async () => {
      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "recipient",
          action: "recipient.viewed",
          resourceType: "recipient",
          documentId,
          recipientId,
          ipAddress: "203.0.113.1",
        });
      });

      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "recipient",
          action: "recipient.signed",
          resourceType: "recipient",
          documentId,
          recipientId,
          ipAddress: "203.0.113.1",
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getRecipientAuditTrail(ctx, recipientId);
      });

      expect(trail).toHaveLength(2);
      for (const log of trail) {
        expect(log.recipientId).toBe(recipientId);
      }
      // Ordered desc
      expect(trail[0].createdAt).toBeGreaterThanOrEqual(trail[1].createdAt);
    });

    test("does not include logs from other recipients", async () => {
      const otherRecipientId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          email: "other@test.com",
          name: "Other Signer",
          role: "signer",
          status: "pending",
          order: 2,
          signingToken: "tok_other_456",
          tokenExpiresAt: Date.now() + 86400000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "recipient",
          action: "recipient.viewed",
          resourceType: "recipient",
          documentId,
          recipientId,
          ipAddress: "10.0.0.1",
        });
      });

      await t.run(async (ctx) => {
        await logAction(ctx, {
          organizationId,
          actorType: "recipient",
          action: "recipient.viewed",
          resourceType: "recipient",
          documentId,
          recipientId: otherRecipientId,
          ipAddress: "10.0.0.2",
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getRecipientAuditTrail(ctx, recipientId);
      });

      expect(trail).toHaveLength(1);
      expect(trail[0].recipientId).toBe(recipientId);
    });

    test("returns empty array for recipient with no logs", async () => {
      const freshRecipientId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          email: "fresh@test.com",
          name: "Fresh Signer",
          role: "signer",
          status: "pending",
          order: 3,
          signingToken: "tok_fresh_789",
          tokenExpiresAt: Date.now() + 86400000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getRecipientAuditTrail(ctx, freshRecipientId);
      });

      expect(trail).toEqual([]);
    });
  });
});
