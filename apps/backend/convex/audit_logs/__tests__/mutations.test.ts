import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("audit_logs/mutations", () => {
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
        authSubject: "auth_test_user",
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
  // logAuditEvent
  // ---------------------------------------------------------------------------

  describe("logAuditEvent", () => {
    test("inserts an audit log entry and returns its id", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logAuditEvent, {
        organizationId,
        actorType: "user",
        actorId: "auth_test_user",
        action: "document.created",
        resourceType: "document",
        resourceId: documentId,
        documentId,
        ipAddress: "192.168.1.1",
        userAgent: "vitest",
        metadata: {
          description: "Test document creation",
          source: "test",
        },
      });

      expect(logId).toBeTruthy();

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored).not.toBeNull();
      expect(stored!.organizationId).toBe(organizationId);
      expect(stored!.action).toBe("document.created");
      expect(stored!.resourceType).toBe("document");
      expect(stored!.resourceId).toBe(documentId);
      expect(stored!.ipAddress).toBe("192.168.1.1");
      expect(stored!.userAgent).toBe("vitest");
      expect(stored!.metadata?.description).toBe("Test document creation");
      expect(stored!.createdAt).toBeGreaterThan(0);
    });

    test("persists all audit-log fields including oldValues and newValues", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logAuditEvent, {
        organizationId,
        actorType: "user",
        actorId: "auth_test_user",
        action: "document.updated",
        resourceType: "document",
        resourceId: documentId,
        documentId,
        oldValues: { name: "Old Name" },
        newValues: { name: "New Name" },
        ipAddress: "10.0.0.1",
        metadata: {
          description: "Renamed document",
          source: "api",
          sessionId: "sess_abc",
        },
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.oldValues).toEqual({ name: "Old Name" });
      expect(stored!.newValues).toEqual({ name: "New Name" });
      expect(stored!.metadata?.sessionId).toBe("sess_abc");
    });

    test("sets optional fields to undefined when omitted", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logAuditEvent, {
        organizationId,
        actorType: "system",
        action: "other",
        resourceType: "other",
        ipAddress: "127.0.0.1",
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.userId).toBeUndefined();
      expect(stored!.actorId).toBeUndefined();
      expect(stored!.documentId).toBeUndefined();
      expect(stored!.recipientId).toBeUndefined();
      expect(stored!.metadata).toBeUndefined();
      expect(stored!.userAgent).toBeUndefined();
    });

    test("logs recipient-type audit events", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logAuditEvent, {
        organizationId,
        actorType: "recipient",
        actorId: recipientId,
        action: "recipient.signed",
        resourceType: "recipient",
        resourceId: recipientId,
        documentId,
        recipientId,
        ipAddress: "10.0.0.2",
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.actorType).toBe("recipient");
      expect(stored!.action).toBe("recipient.signed");
    });
  });

  // ---------------------------------------------------------------------------
  // logDocumentEvent
  // ---------------------------------------------------------------------------

  describe("logDocumentEvent", () => {
    test("inserts a document audit event with user actor", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logDocumentEvent, {
        organizationId,
        userId: "auth_test_user",
        action: "document.sent",
        documentId,
        ipAddress: "10.0.0.1",
        userAgent: "vitest-doc",
        description: "Document sent to signers",
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.actorType).toBe("user");
      expect(stored!.actorId).toBe("auth_test_user");
      expect(stored!.action).toBe("document.sent");
      expect(stored!.resourceType).toBe("document");
      expect(stored!.resourceId).toBe(documentId);
      expect(stored!.documentId).toBe(documentId);
      expect(stored!.metadata?.description).toBe("Document sent to signers");
    });

    test("tracks old and new document values", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logDocumentEvent, {
        organizationId,
        userId: "auth_test_user",
        action: "document.updated",
        documentId,
        oldValues: { status: "draft" },
        newValues: { status: "sent" },
        ipAddress: "10.0.0.1",
        description: "Status changed from draft to sent",
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.oldValues).toEqual({ status: "draft" });
      expect(stored!.newValues).toEqual({ status: "sent" });
    });
  });

  // ---------------------------------------------------------------------------
  // logSecurityEvent
  // ---------------------------------------------------------------------------

  describe("logSecurityEvent", () => {
    test("logs a user login security event", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logSecurityEvent, {
        organizationId,
        userId: "auth_test_user",
        action: "user.login",
        ipAddress: "203.0.113.1",
        userAgent: "Mozilla/5.0",
        metadata: {
          description: "User signed in via email/password",
          source: "web",
          sessionId: "sess_login_1",
        },
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.actorType).toBe("user");
      expect(stored!.actorId).toBe("auth_test_user");
      expect(stored!.action).toBe("user.login");
      expect(stored!.resourceType).toBe("other");
      expect(stored!.ipAddress).toBe("203.0.113.1");
    });

    test("logs a logout event", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logSecurityEvent, {
        organizationId,
        userId: "auth_test_user",
        action: "user.logout",
        ipAddress: "203.0.113.1",
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.action).toBe("user.logout");
    });

    test("logs organization lifecycle events", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logSecurityEvent, {
        organizationId,
        userId: "auth_test_user",
        action: "organization.created",
        resourceId: organizationId,
        ipAddress: "192.168.1.1",
        metadata: {
          description: "Organization created by admin",
        },
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.action).toBe("organization.created");
      expect(stored!.resourceId).toBe(organizationId);
    });

    test("logs member management events", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logSecurityEvent, {
        organizationId,
        userId: "auth_test_user",
        action: "member.role_changed",
        ipAddress: "10.0.0.1",
        metadata: {
          description: "Admin changed member role from viewer to editor for target@test.com",
          source: "web",
        },
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.action).toBe("member.role_changed");
      expect(stored!.metadata?.description).toContain("viewer");
      expect(stored!.metadata?.description).toContain("editor");
    });

    test("uses default 0.0.0.0 when ipAddress is omitted", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logSecurityEvent, {
        organizationId,
        userId: "auth_test_user",
        action: "user.login",
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.ipAddress).toBe("0.0.0.0");
    });

    test("logs email delivery events", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logSecurityEvent, {
        organizationId,
        action: "email.delivered",
        ipAddress: "0.0.0.0",
        metadata: {
          description: "Signing invitation delivered to signer@test.com",
          source: "resend",
        },
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.action).toBe("email.delivered");
      expect(stored!.metadata?.source).toBe("resend");
    });

    test("allows userId to be omitted for system events", async () => {
      const logId = await t.mutation(internal.audit_logs.mutations.logSecurityEvent, {
        organizationId,
        action: "other",
        ipAddress: "0.0.0.0",
        metadata: {
          description: "Automated system event",
          source: "system",
        },
      });

      const stored = await t.run(async (ctx) => {
        return await ctx.db.get(logId);
      });

      expect(stored!.userId).toBeUndefined();
      expect(stored!.actorType).toBe("user");
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-mutation consistency
  // ---------------------------------------------------------------------------

  test("logs from different mutations appear in document audit trail order", async () => {
    await t.mutation(internal.audit_logs.mutations.logDocumentEvent, {
      organizationId,
      userId: "auth_test_user",
      action: "document.created",
      documentId,
      ipAddress: "10.0.0.1",
    });

    await t.mutation(internal.audit_logs.mutations.logAuditEvent, {
      organizationId,
      actorType: "recipient",
      actorId: recipientId,
      action: "recipient.viewed",
      resourceType: "recipient",
      resourceId: recipientId,
      documentId,
      recipientId,
      ipAddress: "10.0.0.2",
    });

    await t.mutation(internal.audit_logs.mutations.logDocumentEvent, {
      organizationId,
      userId: "auth_test_user",
      action: "document.completed",
      documentId,
      ipAddress: "10.0.0.1",
    });

    const logs = await t.run(async (ctx) => {
      const entries: Doc<"audit_logs">[] = [];
      for await (const log of ctx.db
        .query("audit_logs")
        .withIndex("by_document_created", (q) => q.eq("documentId", documentId))
        .order("desc")) {
        entries.push(log);
      }
      return entries;
    });

    expect(logs).toHaveLength(3);
    expect(logs[0]!.action).toBe("document.completed");
    expect(logs[1]!.action).toBe("recipient.viewed");
    expect(logs[2]!.action).toBe("document.created");
  });
});
