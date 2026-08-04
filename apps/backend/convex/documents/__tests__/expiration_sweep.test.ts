function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}
// Set before imports — expiration_sweep.ts imports email.ts which initializes Resend at module level
process.env.RESEND_API_KEY = "re_test_dummy";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("sweepExpiredRecipients", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;
  let documentId: Id<"documents">;

  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  function makeRecipientData(
    overrides: Partial<{
      email: string;
      name: string;
      status:
        | "pending"
        | "viewed"
        | "signed"
        | "approved"
        | "declined"
        | "expired";
      expiresAt: number;
      expirationNotifiedAt: number;
      order: number;
    }> = {}
  ) {
    const now = Date.now();
    return {
      documentId,
      email: overrides.email ?? "recipient@test.com",
      name: overrides.name ?? "Test Recipient",
      role: "signer" as const,
      status: overrides.status ?? "pending",
      order: overrides.order ?? 0,
      signingToken: `token-${Math.random().toString(36).slice(2)}`,
      tokenExpiresAt: now + 30 * ONE_DAY,
      createdAt: now,
      updatedAt: now,
      ...(overrides.expiresAt !== undefined
        ? { expiresAt: overrides.expiresAt }
        : {}),
      ...(overrides.expirationNotifiedAt !== undefined
        ? { expirationNotifiedAt: overrides.expirationNotifiedAt }
        : {}),
    };
  }

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
        workflowStatus: "sent",
        sentAt: Date.now(),
        expirationPeriod: { amount: 7, unit: "day" },
      });
    });

    // Activate fake timers AFTER DB setup — fake timers replace setTimeout which
    // convex-test uses internally, causing beforeEach to hang on slow CI runners.
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers first — finishAllScheduledFunctions can hang when
    // fake timers intercept internal setTimeout calls on slow CI runners.
    vi.useRealTimers();
  });

  test("expires pending recipients past their expiresAt", async () => {
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          status: "pending",
          expiresAt: Date.now() - ONE_HOUR, // expired 1 hour ago
        })
      );
    });

    await t.mutation(
      internal.documents.expiration_sweep.sweepExpiredRecipients,
      {}
    );

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient).not.toBeNull();
    expect(sealAssertPresent(recipient).status).toBe("expired");
    expect(sealAssertPresent(recipient).expirationNotifiedAt).toBeTypeOf(
      "number"
    );
  });

  test("does NOT expire recipients with future expiresAt", async () => {
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          status: "pending",
          expiresAt: Date.now() + 7 * ONE_DAY, // expires in 7 days
        })
      );
    });

    await t.mutation(
      internal.documents.expiration_sweep.sweepExpiredRecipients,
      {}
    );

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient).not.toBeNull();
    expect(sealAssertPresent(recipient).status).toBe("pending");
    expect(sealAssertPresent(recipient).expirationNotifiedAt).toBeUndefined();
  });

  test("transitions document to expired when all recipients are expired", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          status: "pending",
          expiresAt: Date.now() - ONE_HOUR,
        })
      );
    });

    await t.mutation(
      internal.documents.expiration_sweep.sweepExpiredRecipients,
      {}
    );

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc).not.toBeNull();
    expect(sealAssertPresent(doc).workflowStatus).toBe("expired");
    expect(sealAssertPresent(doc).expiredAt).toBeTypeOf("number");
  });

  test("does NOT transition document when some recipients still active", async () => {
    await t.run(async (ctx) => {
      // Recipient 1: expired
      await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          email: "expired@test.com",
          status: "pending",
          expiresAt: Date.now() - ONE_HOUR,
          order: 0,
        })
      );
      // Recipient 2: still active (future expiry)
      await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          email: "active@test.com",
          status: "pending",
          expiresAt: Date.now() + 7 * ONE_DAY,
          order: 1,
        })
      );
    });

    await t.mutation(
      internal.documents.expiration_sweep.sweepExpiredRecipients,
      {}
    );

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc).not.toBeNull();
    expect(sealAssertPresent(doc).workflowStatus).toBe("sent");
    expect(sealAssertPresent(doc).expiredAt).toBeUndefined();

    // Verify the expired recipient was still marked
    const recipients = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .collect();
    });

    const expiredRecipient = recipients.find(
      (r) => r.email === "expired@test.com"
    );
    const activeRecipient = recipients.find(
      (r) => r.email === "active@test.com"
    );

    expect(sealAssertPresent(expiredRecipient).status).toBe("expired");
    expect(sealAssertPresent(activeRecipient).status).toBe("pending");
  });

  test("expires viewed recipients past their expiresAt", async () => {
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          status: "viewed",
          expiresAt: Date.now() - ONE_HOUR,
        })
      );
    });

    await t.mutation(
      internal.documents.expiration_sweep.sweepExpiredRecipients,
      {}
    );

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient).not.toBeNull();
    expect(sealAssertPresent(recipient).status).toBe("expired");
    expect(sealAssertPresent(recipient).expirationNotifiedAt).toBeTypeOf(
      "number"
    );
  });

  test("skips already-notified recipients (idempotent)", async () => {
    const notifiedAt = Date.now() - 2 * ONE_HOUR;
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          status: "expired",
          expiresAt: Date.now() - 3 * ONE_HOUR,
          expirationNotifiedAt: notifiedAt,
        })
      );
    });

    const result = await t.mutation(
      internal.documents.expiration_sweep.sweepExpiredRecipients,
      {}
    );

    // No recipients should have been processed
    expect(result.recipientsExpired).toBe(0);

    // Verify the expirationNotifiedAt was not updated
    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient).not.toBeNull();
    expect(sealAssertPresent(recipient).expirationNotifiedAt).toBe(notifiedAt);
  });

  test("does not expire recipients without expiresAt set", async () => {
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          status: "pending",
          // No expiresAt
        })
      );
    });

    await t.mutation(
      internal.documents.expiration_sweep.sweepExpiredRecipients,
      {}
    );

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient).not.toBeNull();
    expect(sealAssertPresent(recipient).status).toBe("pending");
  });

  test("returns correct counts", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          email: "r1@test.com",
          status: "pending",
          expiresAt: Date.now() - ONE_HOUR,
          order: 0,
        })
      );
      await ctx.db.insert(
        "document_recipients",
        makeRecipientData({
          email: "r2@test.com",
          status: "viewed",
          expiresAt: Date.now() - ONE_HOUR,
          order: 1,
        })
      );
    });

    const result = await t.mutation(
      internal.documents.expiration_sweep.sweepExpiredRecipients,
      {}
    );

    expect(result.recipientsExpired).toBe(2);
    // All recipients are now expired and terminal, so document should also transition
    expect(result.documentsExpired).toBe(1);
  });
});
