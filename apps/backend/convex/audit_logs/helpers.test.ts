import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";
import {
  getDocumentAuditTrail,
  getOrganizationAuditTrail,
  getRecipientAuditTrail,
  logAction,
  logDocumentAction,
  logFieldAction,
  logRecipientAction,
  logSignatureAction,
} from "./helpers";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

describe("Audit log helpers", () => {
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
        authSubject: "test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
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
        email: "signer@test.com",
        name: "Test Signer",
        role: "signer",
        status: "pending",
        signingToken: "test-token-123",
        tokenExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  // ─── logAction ──────────────────────────────────────

  describe("logAction", () => {
    test("creates audit log with all fields", async () => {
      const logId = await t.run(async (ctx) => {
        return await logAction(ctx, {
          organizationId,
          userId: "test_owner",
          actorType: "user",
          actorId: "test_owner",
          action: "document.created",
          resourceType: "document",
          resourceId: documentId,
          documentId,
          newValues: { name: "Test Doc" },
          metadata: { description: "Created", source: "web" },
          ipAddress: "127.0.0.1",
          userAgent: "TestAgent/1.0",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(log).not.toBeNull();
      expect(sealAssertPresent(log).organizationId).toBe(organizationId);
      expect(sealAssertPresent(log).userId).toBe("test_owner");
      expect(sealAssertPresent(log).actorType).toBe("user");
      expect(sealAssertPresent(log).action).toBe("document.created");
      expect(sealAssertPresent(log).resourceType).toBe("document");
      expect(sealAssertPresent(log).documentId).toBe(documentId);
      expect(sealAssertPresent(log).ipAddress).toBe("127.0.0.1");
      expect(sealAssertPresent(log).userAgent).toBe("TestAgent/1.0");
      expect(sealAssertPresent(log).createdAt).toBeGreaterThan(0);
    });

    test("creates audit log with optional fields omitted", async () => {
      const logId = await t.run(async (ctx) => {
        return await logAction(ctx, {
          organizationId,
          actorType: "system",
          action: "document.updated",
          resourceType: "document",
          ipAddress: "0.0.0.0",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(log).not.toBeNull();
      expect(sealAssertPresent(log).userId).toBeUndefined();
      expect(sealAssertPresent(log).actorId).toBeUndefined();
      expect(sealAssertPresent(log).documentId).toBeUndefined();
      expect(sealAssertPresent(log).recipientId).toBeUndefined();
    });
  });

  // ─── logDocumentAction ──────────────────────────────

  describe("logDocumentAction", () => {
    test("logs document.created action", async () => {
      const logId = await t.run(async (ctx) => {
        return await logDocumentAction(ctx, {
          organizationId,
          userId: "test_owner",
          action: "document.created",
          documentId,
          newValues: { name: "Test Doc", fileType: "application/pdf" },
          description: "Document created",
          ipAddress: "web-authenticated",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(sealAssertPresent(log).action).toBe("document.created");
      expect(sealAssertPresent(log).actorType).toBe("user");
      expect(sealAssertPresent(log).actorId).toBe("test_owner");
      expect(sealAssertPresent(log).resourceType).toBe("document");
      expect(sealAssertPresent(log).resourceId).toBe(documentId);
      expect(sealAssertPresent(log).metadata?.description).toBe("Document created");
      expect(sealAssertPresent(log).metadata?.source).toBe("web");
    });

    test("logs document.sent action", async () => {
      const logId = await t.run(async (ctx) => {
        return await logDocumentAction(ctx, {
          organizationId,
          userId: "test_owner",
          action: "document.sent",
          documentId,
          newValues: { workflowStatus: "sent" },
          description: "Document sent to recipients",
          ipAddress: "web-authenticated",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(sealAssertPresent(log).action).toBe("document.sent");
      expect(sealAssertPresent(log).documentId).toBe(documentId);
    });
  });

  // ─── logRecipientAction ─────────────────────────────

  describe("logRecipientAction", () => {
    test("logs recipient.signed for token-based signing", async () => {
      const logId = await t.run(async (ctx) => {
        return await logRecipientAction(ctx, {
          organizationId,
          actorType: "recipient",
          actorId: recipientId,
          action: "recipient.signed",
          documentId,
          recipientId,
          newValues: { status: "signed" },
          ipAddress: "203.0.113.1",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(sealAssertPresent(log).action).toBe("recipient.signed");
      expect(sealAssertPresent(log).actorType).toBe("recipient");
      expect(sealAssertPresent(log).actorId).toBe(recipientId);
      expect(sealAssertPresent(log).userId).toBeUndefined();
      expect(sealAssertPresent(log).resourceType).toBe("recipient");
      expect(sealAssertPresent(log).resourceId).toBe(recipientId);
      expect(sealAssertPresent(log).documentId).toBe(documentId);
      expect(sealAssertPresent(log).recipientId).toBe(recipientId);
      expect(sealAssertPresent(log).ipAddress).toBe("203.0.113.1");
      expect(sealAssertPresent(log).metadata?.description).toBe("Recipient signed");
    });

    test("logs recipient.signed for authenticated user", async () => {
      const logId = await t.run(async (ctx) => {
        return await logRecipientAction(ctx, {
          organizationId,
          actorType: "user",
          actorId: "test_owner",
          userId: "test_owner",
          action: "recipient.signed",
          documentId,
          recipientId,
          newValues: { status: "signed" },
          ipAddress: "web-authenticated",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(sealAssertPresent(log).action).toBe("recipient.signed");
      expect(sealAssertPresent(log).actorType).toBe("user");
      expect(sealAssertPresent(log).userId).toBe("test_owner");
      expect(sealAssertPresent(log).actorId).toBe("test_owner");
    });

    test("logs recipient.declined", async () => {
      const logId = await t.run(async (ctx) => {
        return await logRecipientAction(ctx, {
          organizationId,
          actorType: "recipient",
          actorId: recipientId,
          action: "recipient.declined",
          documentId,
          recipientId,
          newValues: { status: "declined" },
          ipAddress: "0.0.0.0",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(sealAssertPresent(log).action).toBe("recipient.declined");
      expect(sealAssertPresent(log).metadata?.description).toBe("Recipient declined");
    });

    test("logs recipient.viewed", async () => {
      const logId = await t.run(async (ctx) => {
        return await logRecipientAction(ctx, {
          organizationId,
          actorType: "recipient",
          actorId: recipientId,
          action: "recipient.viewed",
          documentId,
          recipientId,
          newValues: { status: "viewed" },
          ipAddress: "0.0.0.0",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(sealAssertPresent(log).action).toBe("recipient.viewed");
      expect(sealAssertPresent(log).metadata?.description).toBe("Recipient viewed");
    });
  });

  // ─── logFieldAction ─────────────────────────────────

  describe("logFieldAction", () => {
    test("logs field.created action", async () => {
      const fieldId = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          recipientId,
          label: "Signature",
          fieldType: "signature",
          page: 1,
          x: 100,
          y: 200,
          width: 200,
          height: 50,
          isRequired: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const logId = await t.run(async (ctx) => {
        return await logFieldAction(ctx, {
          organizationId,
          userId: "test_owner",
          action: "field.created",
          fieldId,
          documentId,
          recipientId,
          ipAddress: "web-authenticated",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(sealAssertPresent(log).action).toBe("field.created");
      expect(sealAssertPresent(log).resourceType).toBe("signature_field");
      expect(sealAssertPresent(log).resourceId).toBe(fieldId);
    });
  });

  // ─── logSignatureAction ─────────────────────────────

  describe("logSignatureAction", () => {
    test("logs signature.created action", async () => {
      const fieldId = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          recipientId,
          label: "Signature",
          fieldType: "signature",
          page: 1,
          x: 100,
          y: 200,
          width: 200,
          height: 50,
          isRequired: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const signatureId = await t.run(async (ctx) => {
        return await ctx.db.insert("signatures", {
          documentId,
          recipientId,
          fieldId,
          signatureMethod: "draw",
          signatureImageUrl: "https://example.com/sig.png",
          signatureHash: "test-hash",
          ipAddress: "127.0.0.1",
          userAgent: "TestAgent/1.0",
          signedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const logId = await t.run(async (ctx) => {
        return await logSignatureAction(ctx, {
          organizationId,
          recipientId,
          action: "signature.created",
          signatureId,
          fieldId,
          documentId,
          ipAddress: "127.0.0.1",
        });
      });

      const log = await t.run(async (ctx) => ctx.db.get(logId));

      expect(sealAssertPresent(log).action).toBe("signature.created");
      expect(sealAssertPresent(log).actorType).toBe("recipient");
      expect(sealAssertPresent(log).resourceType).toBe("signature");
      expect(sealAssertPresent(log).resourceId).toBe(signatureId);
    });
  });

  // ─── Query helpers ──────────────────────────────────

  describe("getDocumentAuditTrail", () => {
    test("returns logs for a document ordered by newest first", async () => {
      await t.run(async (ctx) => {
        await logDocumentAction(ctx, {
          organizationId,
          userId: "test_owner",
          action: "document.created",
          documentId,
          ipAddress: "web-authenticated",
        });
      });

      await t.run(async (ctx) => {
        await logDocumentAction(ctx, {
          organizationId,
          userId: "test_owner",
          action: "document.sent",
          documentId,
          ipAddress: "web-authenticated",
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getDocumentAuditTrail(ctx, documentId);
      });

      expect(trail).toHaveLength(2);
      expect(trail[0].action).toBe("document.sent");
      expect(trail[1].action).toBe("document.created");
    });

    test("returns empty array for document with no logs", async () => {
      const trail = await t.run(async (ctx) => {
        return await getDocumentAuditTrail(ctx, documentId);
      });

      expect(trail).toHaveLength(0);
    });
  });

  describe("getOrganizationAuditTrail", () => {
    test("returns logs scoped to organization", async () => {
      await t.run(async (ctx) => {
        await logDocumentAction(ctx, {
          organizationId,
          userId: "test_owner",
          action: "document.created",
          documentId,
          ipAddress: "web-authenticated",
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getOrganizationAuditTrail(ctx, organizationId);
      });

      expect(trail).toHaveLength(1);
      expect(trail[0].organizationId).toBe(organizationId);
    });
  });

  describe("getRecipientAuditTrail", () => {
    test("returns logs for a recipient", async () => {
      await t.run(async (ctx) => {
        await logRecipientAction(ctx, {
          organizationId,
          actorType: "recipient",
          actorId: recipientId,
          action: "recipient.viewed",
          documentId,
          recipientId,
          ipAddress: "0.0.0.0",
        });
        await logRecipientAction(ctx, {
          organizationId,
          actorType: "recipient",
          actorId: recipientId,
          action: "recipient.signed",
          documentId,
          recipientId,
          ipAddress: "0.0.0.0",
        });
      });

      const trail = await t.run(async (ctx) => {
        return await getRecipientAuditTrail(ctx, recipientId);
      });

      expect(trail).toHaveLength(2);
      // All should reference this recipient
      for (const entry of trail) {
        expect(entry.recipientId).toBe(recipientId);
      }
    });
  });
});
