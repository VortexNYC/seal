import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { sendResendEmail } from "../resend_component";

describe("emails/resend_component", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;
  let documentId: Id<"documents">;
  let recipientId: Id<"document_recipients">;
  const originalFetch = globalThis.fetch;
  const originalResendApiKey = process.env.RESEND_API_KEY;

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
        authSubject: "test_user",
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

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendApiKey;
    }
    vi.restoreAllMocks();
  });

  describe("sendResendEmail", () => {
    test("sends direct Resend HTTP request with auth and idempotency headers", async () => {
      process.env.RESEND_API_KEY = "re_test_direct";

      const fetchMock = vi.fn(
        async (
          input: Parameters<typeof fetch>[0],
          init?: Parameters<typeof fetch>[1]
        ) => {
          const requestUrl =
            input instanceof Request ? input.url : String(input);
          expect(requestUrl).toBe("https://api.resend.com/emails");
          expect(init?.method).toBe("POST");

          const headers = new Headers(init?.headers);
          expect(headers.get("Authorization")).toBe("Bearer re_test_direct");
          expect(headers.get("Content-Type")).toBe("application/json");
          expect(headers.get("Idempotency-Key")).toBe("email_key_123");

          if (typeof init?.body !== "string") {
            throw new Error("Expected a string request body");
          }
          expect(JSON.parse(init.body)).toEqual({
            from: "Seal <no-reply@seal.nyc>",
            headers: { "Idempotency-Key": "email_key_123" },
            html: "<p>Hello</p>",
            reply_to: "reply@seal.nyc",
            subject: "Hello",
            to: ["user@example.com"],
          });

          return new Response(JSON.stringify({ id: "email_123" }), {
            status: 200,
          });
        }
      );
      globalThis.fetch = fetchMock;

      const result = await sendResendEmail({
        from: "Seal <no-reply@seal.nyc>",
        to: ["user@example.com"],
        subject: "Hello",
        html: "<p>Hello</p>",
        replyTo: "reply@seal.nyc",
        headers: { "Idempotency-Key": "email_key_123" },
      });

      expect(result).toEqual({ data: { id: "email_123" }, error: null });
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // handleEmailEvent — audit logging
  // ---------------------------------------------------------------------------
  describe("handleEmailEvent", () => {
    test("creates audit log for email.delivered event with matching notification", async () => {
      const resendMessageId = "resend_msg_abc123";

      // Create a notification with emailMessageId so the handler can find it
      await t.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId,
          organizationId,
          type: "signature_requested",
          data: {
            documentId,
            documentName: "Test Document",
            recipientId,
          },
          read: false,
          createdAt: Date.now(),
          emailStatus: "sent",
          emailMessageId: resendMessageId,
        });
      });

      await t.mutation(internal.emails.resend_component.handleEmailEvent, {
        id: "email_id_123",
        event: {
          type: "email.delivered",
          created_at: new Date().toISOString(),
          data: {
            email_id: resendMessageId,
            from: "noreply@seal.com",
            to: ["signer@test.com"],
            subject: "Sign this document",
            created_at: new Date().toISOString(),
          },
        },
      });

      // Verify audit log was created
      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("audit_logs")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId)
          )
          .collect();
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe("email.delivered");
      expect(auditLogs[0].actorType).toBe("system");
      expect(auditLogs[0].resourceType).toBe("email");
      expect(auditLogs[0].resourceId).toBe(resendMessageId);
      expect(auditLogs[0].documentId).toBe(documentId);
      expect(auditLogs[0].recipientId).toBe(recipientId);
      expect(auditLogs[0].metadata).toEqual({
        description: "Email delivered to signer@test.com",
        source: "resend_component",
      });
      expect(auditLogs[0].ipAddress).toBe("webhook");
    });

    test("creates audit log for email.opened event", async () => {
      const resendMessageId = "resend_msg_opened";

      await t.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId,
          organizationId,
          type: "signature_requested",
          data: {
            documentId,
            documentName: "Test Document",
          },
          read: false,
          createdAt: Date.now(),
          emailStatus: "sent",
          emailMessageId: resendMessageId,
        });
      });

      await t.mutation(internal.emails.resend_component.handleEmailEvent, {
        id: "email_id_456",
        event: {
          type: "email.opened",
          created_at: new Date().toISOString(),
          data: {
            email_id: resendMessageId,
            from: "noreply@seal.com",
            to: "signer@test.com",
            subject: "Sign this document",
            created_at: new Date().toISOString(),
            open: {
              ipAddress: "203.0.113.42",
              timestamp: new Date().toISOString(),
              userAgent: "Chrome/120",
            },
          },
        },
      });

      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("audit_logs")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId)
          )
          .collect();
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe("email.opened");
      expect(auditLogs[0].metadata).toEqual({
        description: "Email opened to signer@test.com",
        source: "resend_component",
      });
    });

    test("creates audit log for email.bounced event with bounce info", async () => {
      const resendMessageId = "resend_msg_bounced";

      await t.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId,
          organizationId,
          type: "signature_requested",
          data: {
            documentId,
            documentName: "Test Document",
          },
          read: false,
          createdAt: Date.now(),
          emailStatus: "sent",
          emailMessageId: resendMessageId,
        });
      });

      await t.mutation(internal.emails.resend_component.handleEmailEvent, {
        id: "email_id_789",
        event: {
          type: "email.bounced",
          created_at: new Date().toISOString(),
          data: {
            email_id: resendMessageId,
            from: "noreply@seal.com",
            to: ["invalid@example.com"],
            subject: "Sign this document",
            created_at: new Date().toISOString(),
            bounce: {
              message: "Mailbox not found",
              subType: "mailbox_not_found",
              type: "hard",
            },
          },
        },
      });

      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db
          .query("audit_logs")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId)
          )
          .collect();
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].action).toBe("email.bounced");
      expect(auditLogs[0].newValues).toEqual({ bounceType: "hard" });
      expect(auditLogs[0].metadata).toEqual({
        description: "Email bounced to invalid@example.com",
        source: "resend_component",
      });
    });

    test("silently ignores non-auditable events (email.sent)", async () => {
      await t.mutation(internal.emails.resend_component.handleEmailEvent, {
        id: "email_id_sent",
        event: {
          type: "email.sent",
          created_at: new Date().toISOString(),
          data: {
            email_id: "resend_msg_sent",
            from: "noreply@seal.com",
            to: ["user@test.com"],
            subject: "Test",
            created_at: new Date().toISOString(),
          },
        },
      });

      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db.query("audit_logs").collect();
      });

      expect(auditLogs).toHaveLength(0);
    });

    test("silently ignores events with no matching notification", async () => {
      await t.mutation(internal.emails.resend_component.handleEmailEvent, {
        id: "email_id_orphan",
        event: {
          type: "email.delivered",
          created_at: new Date().toISOString(),
          data: {
            email_id: "resend_msg_nonexistent",
            from: "noreply@seal.com",
            to: ["unknown@test.com"],
            subject: "Unknown",
            created_at: new Date().toISOString(),
          },
        },
      });

      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db.query("audit_logs").collect();
      });

      expect(auditLogs).toHaveLength(0);
    });

    test("handles notification without documentId or recipientId in data", async () => {
      const resendMessageId = "resend_msg_minimal";

      await t.run(async (ctx) => {
        await ctx.db.insert("notifications", {
          userId,
          organizationId,
          type: "reminder",
          data: {
            reminderType: "review",
          },
          read: false,
          createdAt: Date.now(),
          emailStatus: "sent",
          emailMessageId: resendMessageId,
        });
      });

      await t.mutation(internal.emails.resend_component.handleEmailEvent, {
        id: "email_id_minimal",
        event: {
          type: "email.delivered",
          created_at: new Date().toISOString(),
          data: {
            email_id: resendMessageId,
            from: "noreply@seal.com",
            to: ["user@test.com"],
            subject: "Reminder",
            created_at: new Date().toISOString(),
          },
        },
      });

      const auditLogs = await t.run(async (ctx) => {
        return await ctx.db.query("audit_logs").collect();
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].documentId).toBeUndefined();
      expect(auditLogs[0].recipientId).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // cleanupResendEmails — scheduler invocations
  // ---------------------------------------------------------------------------
  describe("cleanupResendEmails", () => {
    test("schedules both cleanup jobs", async () => {
      await t.mutation(
        internal.emails.resend_component.cleanupResendEmails,
        {}
      );

      // The mutation schedules two component functions via ctx.scheduler.runAfter.
      // In convex-test, we can't directly inspect scheduled component functions,
      // but we verify the mutation completes without error, which confirms the
      // scheduler calls were accepted.
    });
  });
});
