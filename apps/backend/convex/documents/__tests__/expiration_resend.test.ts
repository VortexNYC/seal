/**
 * Tests for document expiration re-send flow:
 * - expirationPeriodToMs utility (tested via mutation behavior)
 * - markDocumentAsSent with expired documents
 * - resetExpiredRecipient internal mutation
 * - reactivateExpiredDocument internal mutation
 */

// Set before imports — modules in the import chain initialize Resend at module level
process.env.RESEND_API_KEY = "re_test_dummy";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

// ─── Pure function tests (dynamic import to avoid Resend side effect) ─

describe("expirationPeriodToMs", () => {
  const MS_PER_DAY = 86_400_000;

  test("converts days correctly", async () => {
    const { expirationPeriodToMs } = await import("../send_document_action");
    expect(expirationPeriodToMs(1, "day")).toBe(MS_PER_DAY);
    expect(expirationPeriodToMs(7, "day")).toBe(7 * MS_PER_DAY);
    expect(expirationPeriodToMs(30, "day")).toBe(30 * MS_PER_DAY);
  });

  test("converts weeks correctly", async () => {
    const { expirationPeriodToMs } = await import("../send_document_action");
    expect(expirationPeriodToMs(1, "week")).toBe(7 * MS_PER_DAY);
    expect(expirationPeriodToMs(2, "week")).toBe(14 * MS_PER_DAY);
    expect(expirationPeriodToMs(4, "week")).toBe(28 * MS_PER_DAY);
  });

  test("converts months correctly (30-day months)", async () => {
    const { expirationPeriodToMs } = await import("../send_document_action");
    expect(expirationPeriodToMs(1, "month")).toBe(30 * MS_PER_DAY);
    expect(expirationPeriodToMs(3, "month")).toBe(90 * MS_PER_DAY);
    expect(expirationPeriodToMs(12, "month")).toBe(360 * MS_PER_DAY);
  });
});

// ─── DB-dependent tests ─────────────────────────────────────────────

describe("resetExpiredRecipient", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;
  let documentId: Id<"documents">;

  const ONE_DAY = 86_400_000;

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
        workflowStatus: "expired",
        sentAt: Date.now() - 14 * ONE_DAY,
        expiredAt: Date.now() - ONE_DAY,
        expirationPeriod: { amount: 7, unit: "day" as const },
      });
    });
  });

  test("resets status to pending and clears expirationNotifiedAt", async () => {
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "recipient@test.com",
        name: "Test Recipient",
        role: "signer",
        status: "expired",
        order: 0,
        signingToken: "token-123",
        tokenExpiresAt: Date.now() + 30 * ONE_DAY,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() - ONE_DAY,
        expirationNotifiedAt: Date.now() - ONE_DAY,
      });
    });

    const newExpiresAt = Date.now() + 7 * ONE_DAY;
    await t.mutation(internal.documents.send_document_action.resetExpiredRecipient, {
      recipientId,
      expiresAt: newExpiresAt,
    });

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient).not.toBeNull();
    expect(recipient!.status).toBe("pending");
    expect(recipient!.expiresAt).toBe(newExpiresAt);
    expect(recipient!.expirationNotifiedAt).toBeUndefined();
  });

  test("works without providing new expiresAt", async () => {
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "recipient@test.com",
        name: "Test Recipient",
        role: "signer",
        status: "expired",
        order: 0,
        signingToken: "token-456",
        tokenExpiresAt: Date.now() + 30 * ONE_DAY,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() - ONE_DAY,
        expirationNotifiedAt: Date.now() - ONE_DAY,
      });
    });

    await t.mutation(internal.documents.send_document_action.resetExpiredRecipient, {
      recipientId,
    });

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient).not.toBeNull();
    expect(recipient!.status).toBe("pending");
    expect(recipient!.expirationNotifiedAt).toBeUndefined();
    // expiresAt should be undefined since we didn't provide one
    expect(recipient!.expiresAt).toBeUndefined();
  });
});

describe("reactivateExpiredDocument", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;

  const ONE_DAY = 86_400_000;

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
  });

  test("transitions expired document back to sent", async () => {
    const documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Expired Doc",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        workflowStatus: "expired",
        sentAt: Date.now() - 14 * ONE_DAY,
        expiredAt: Date.now() - ONE_DAY,
      });
    });

    await t.mutation(internal.documents.send_document_action.reactivateExpiredDocument, {
      documentId,
    });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc).not.toBeNull();
    expect(doc!.workflowStatus).toBe("sent");
    expect(doc!.expiredAt).toBeUndefined();
    expect(doc!.sentAt).toBeTypeOf("number");
    // sentAt should be recent (within last second)
    expect(doc!.sentAt!).toBeGreaterThan(Date.now() - 1000);
  });

  test("does nothing if document is not expired", async () => {
    const documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Sent Doc",
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
        sentAt: Date.now() - ONE_DAY,
      });
    });

    await t.mutation(internal.documents.send_document_action.reactivateExpiredDocument, {
      documentId,
    });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc).not.toBeNull();
    expect(doc!.workflowStatus).toBe("sent");
  });
});

describe("markDocumentAsSent (re-send expired flow)", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;

  const ONE_DAY = 86_400_000;

  beforeEach(async () => {
    vi.useFakeTimers();
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("resets expired recipients to pending with new expiresAt", async () => {
    const documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Expired Doc",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        workflowStatus: "expired",
        sentAt: Date.now() - 14 * ONE_DAY,
        expiredAt: Date.now() - ONE_DAY,
      });
    });

    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "recipient@test.com",
        name: "Test Recipient",
        role: "signer",
        status: "expired",
        order: 0,
        signingToken: "token-resend",
        tokenExpiresAt: Date.now() + 30 * ONE_DAY,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() - ONE_DAY,
        expirationNotifiedAt: Date.now() - ONE_DAY,
      });
    });

    await t.mutation(internal.documents.send_document_action.markDocumentAsSent, {
      documentId,
      expirationPeriod: { amount: 14, unit: "day" },
    });

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient).not.toBeNull();
    expect(recipient!.status).toBe("pending");
    expect(recipient!.expirationNotifiedAt).toBeUndefined();
    // New expiresAt should be ~14 days from now
    expect(recipient!.expiresAt).toBeGreaterThan(Date.now());
    expect(recipient!.expiresAt).toBeLessThanOrEqual(Date.now() + 14 * ONE_DAY + 1000);
  });

  test("clears expiredAt on document when re-sending", async () => {
    const documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Expired Doc",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        workflowStatus: "expired",
        sentAt: Date.now() - 14 * ONE_DAY,
        expiredAt: Date.now() - ONE_DAY,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("document_recipients", {
        documentId,
        email: "recipient@test.com",
        name: "Test",
        role: "signer",
        status: "expired",
        order: 0,
        signingToken: "token-clear",
        tokenExpiresAt: Date.now() + 30 * ONE_DAY,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.documents.send_document_action.markDocumentAsSent, {
      documentId,
      expirationPeriod: { amount: 7, unit: "day" },
    });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc).not.toBeNull();
    expect(doc!.workflowStatus).toBe("sent");
    expect(doc!.expiredAt).toBeUndefined();
    expect(doc!.sentAt).toBeTypeOf("number");
  });

  test("does not reset non-expired recipients", async () => {
    const documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Mixed Doc",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        workflowStatus: "expired",
        sentAt: Date.now() - 14 * ONE_DAY,
        expiredAt: Date.now() - ONE_DAY,
      });
    });

    const [expiredId, signedId] = await t.run(async (ctx) => {
      const expired = await ctx.db.insert("document_recipients", {
        documentId,
        email: "expired@test.com",
        name: "Expired",
        role: "signer",
        status: "expired",
        order: 0,
        signingToken: "token-expired",
        tokenExpiresAt: Date.now() + 30 * ONE_DAY,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() - ONE_DAY,
        expirationNotifiedAt: Date.now() - ONE_DAY,
      });

      const signed = await ctx.db.insert("document_recipients", {
        documentId,
        email: "signed@test.com",
        name: "Signed",
        role: "signer",
        status: "signed",
        order: 1,
        signingToken: "token-signed",
        tokenExpiresAt: Date.now() + 30 * ONE_DAY,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return [expired, signed] as const;
    });

    await t.mutation(internal.documents.send_document_action.markDocumentAsSent, {
      documentId,
      expirationPeriod: { amount: 7, unit: "day" },
    });

    const [expired, signed] = await t.run(async (ctx) => {
      return [await ctx.db.get(expiredId), await ctx.db.get(signedId)] as const;
    });

    // Expired recipient should be reset
    expect(expired!.status).toBe("pending");
    expect(expired!.expirationNotifiedAt).toBeUndefined();

    // Signed recipient should NOT be touched
    expect(signed!.status).toBe("signed");
  });
});
