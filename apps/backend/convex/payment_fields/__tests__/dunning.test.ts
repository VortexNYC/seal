import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

describe("dunning (payment recovery)", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;
  let userId: Id<"users">;
  let invoiceId: Id<"document_invoices">;

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
        email: "owner@test.com",
        name: "Owner",
        authSubject: "owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Contract",
        organizationId,
        ownerId: userId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test-123",
        workflowStatus: "sent",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    invoiceId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_invoices", {
        documentId,
        organizationId,
        providerAccountId: "acct_test_456",
        providerInvoiceId: "in_test_dunning",
        status: "uncollectible",
        customerEmail: "customer@example.com",
        customerName: "Jane Doe",
        amountDue: 50000,
        currency: "usd",
        hostedInvoiceUrl: "https://invoice.stripe.com/test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  test("startDunning activates dunning on uncollectible invoice", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.dunning.startDunning, {
      invoiceId,
    });

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });

    expect(sealAssertPresent(invoice).dunningStatus).toBe("active");
    expect(sealAssertPresent(invoice).dunningStep).toBe(0);
    expect(sealAssertPresent(invoice).dunningStartedAt).toBeDefined();
    expect(sealAssertPresent(invoice).nextDunningAt).toBeDefined();
  });

  test("startDunning is idempotent — does not restart active dunning", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });

    const firstStart = await t.run(async (ctx) => {
      const inv = await ctx.db.get(invoiceId);
      return sealAssertPresent(inv).dunningStartedAt;
    });

    // Try to start again
    await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });

    const secondStart = await t.run(async (ctx) => {
      const inv = await ctx.db.get(invoiceId);
      return sealAssertPresent(inv).dunningStartedAt;
    });

    // Should not have changed
    expect(secondStart).toBe(firstStart);
  });

  test("startDunning does nothing for paid invoices", async () => {
    const { internal } = await import("../../_generated/api");

    // Mark as paid first
    await t.run(async (ctx) => {
      await ctx.db.patch(invoiceId, { status: "paid" });
    });

    const result = await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });
    expect(result).toBeNull();

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });

    expect(sealAssertPresent(invoice).dunningStatus).toBeUndefined();
  });

  test("startDunning does not restart completed dunning", async () => {
    const { internal } = await import("../../_generated/api");

    // Start and complete the full sequence
    await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });
    await t.mutation(internal.payment_fields.dunning.advanceDunningStep, {
      invoiceId,
      completedStep: 0,
    });
    await t.mutation(internal.payment_fields.dunning.advanceDunningStep, {
      invoiceId,
      completedStep: 1,
    });
    await t.mutation(internal.payment_fields.dunning.advanceDunningStep, {
      invoiceId,
      completedStep: 2,
    });

    // Try to restart — should be blocked
    const result = await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });
    expect(result).toBeNull();

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });
    expect(sealAssertPresent(invoice).dunningStatus).toBe("completed");
  });

  test("startDunning does not restart cancelled dunning", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });
    await t.mutation(internal.payment_fields.dunning.cancelDunning, { invoiceId });

    // Try to restart — should be blocked
    const result = await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });
    expect(result).toBeNull();

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });
    expect(sealAssertPresent(invoice).dunningStatus).toBe("cancelled");
  });

  test("cancelDunning stops active dunning", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });
    await t.mutation(internal.payment_fields.dunning.cancelDunning, { invoiceId });

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });

    expect(sealAssertPresent(invoice).dunningStatus).toBe("cancelled");
    expect(sealAssertPresent(invoice).dunningCompletedAt).toBeDefined();
    expect(sealAssertPresent(invoice).nextDunningAt).toBeUndefined();
  });

  test("cancelDunning does nothing if not active", async () => {
    const { internal } = await import("../../_generated/api");

    // No dunning started — should be a no-op
    await t.mutation(internal.payment_fields.dunning.cancelDunning, { invoiceId });

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });

    expect(sealAssertPresent(invoice).dunningStatus).toBeUndefined();
  });

  test("advanceDunningStep moves to next step", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });
    await t.mutation(internal.payment_fields.dunning.advanceDunningStep, {
      invoiceId,
      completedStep: 0,
    });

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });

    expect(sealAssertPresent(invoice).dunningStep).toBe(1);
    expect(sealAssertPresent(invoice).lastDunningEmailAt).toBeDefined();
    expect(sealAssertPresent(invoice).nextDunningAt).toBeDefined();
    // Next step should be ~3 days from now
    expect(
      sealAssertPresent(sealAssertPresent(invoice).nextDunningAt) -
        sealAssertPresent(sealAssertPresent(invoice).lastDunningEmailAt),
    ).toBeGreaterThanOrEqual(3 * 24 * 60 * 60 * 1000 - 1000);
  });

  test("advanceDunningStep completes after final step", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });
    await t.mutation(internal.payment_fields.dunning.advanceDunningStep, {
      invoiceId,
      completedStep: 0,
    });
    await t.mutation(internal.payment_fields.dunning.advanceDunningStep, {
      invoiceId,
      completedStep: 1,
    });
    await t.mutation(internal.payment_fields.dunning.advanceDunningStep, {
      invoiceId,
      completedStep: 2,
    });

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });

    expect(sealAssertPresent(invoice).dunningStatus).toBe("completed");
    expect(sealAssertPresent(invoice).dunningCompletedAt).toBeDefined();
    expect(sealAssertPresent(invoice).nextDunningAt).toBeUndefined();
  });

  test("processDunningEmails skips invoices not yet due", async () => {
    const { internal } = await import("../../_generated/api");

    // Start dunning and advance past step 0 (sets nextDunningAt 3 days out)
    await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });
    await t.mutation(internal.payment_fields.dunning.advanceDunningStep, {
      invoiceId,
      completedStep: 0,
    });

    // Run cron — step 1 isn't due yet (3 days out)
    const result = await t.mutation(internal.payment_fields.dunning.processDunningEmails, {});

    expect(result.emailsScheduled).toBe(0);
  });

  test("processDunningEmails cancels dunning for paid invoices", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.dunning.startDunning, { invoiceId });

    // Mark invoice as paid
    await t.run(async (ctx) => {
      await ctx.db.patch(invoiceId, { status: "paid", paidAt: Date.now() });
    });

    // Advance step so nextDunningAt is in the past (to trigger processing)
    await t.mutation(internal.payment_fields.dunning.advanceDunningStep, {
      invoiceId,
      completedStep: 0,
    });
    // Backdate nextDunningAt so it's due now
    await t.run(async (ctx) => {
      await ctx.db.patch(invoiceId, { nextDunningAt: Date.now() - 1000 });
    });

    const result = await t.mutation(internal.payment_fields.dunning.processDunningEmails, {});

    // Should cancel, not schedule
    expect(result.emailsScheduled).toBe(0);

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });
    expect(sealAssertPresent(invoice).dunningStatus).toBe("cancelled");
  });
});
