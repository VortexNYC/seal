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

describe("recurring invoice sync via upsertRecurringInvoice", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;
  let userId: Id<"users">;
  let fieldId: Id<"signature_fields">;

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
        name: "Recurring Contract",
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

    fieldId = await t.run(async (ctx) => {
      return await ctx.db.insert("signature_fields", {
        documentId,
        fieldType: "payment",
        label: "Monthly Payment",
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

    // Create a recurring payment config with providerSubscriptionId
    await t.run(async (ctx) => {
      return await ctx.db.insert("payment_field_configs", {
        fieldId,
        documentId,
        organizationId,
        paymentType: "recurring",
        items: [{ id: "item1", description: "Monthly Service", quantity: 1, unitPrice: 10000 }],
        currency: "usd",
        dueDateTerms: "on_receipt",
        allowedPaymentMethods: ["card"],
        feeHandling: "absorb",
        taxEnabled: false,
        totalAmountCents: 10000,
        paymentStatus: "awaiting",
        providerSubscriptionId: "sub_recurring_123",
        providerInvoiceId: "in_initial_123",
        recurringConfig: {
          interval: "month",
          intervalCount: 1,
          endCondition: "never",
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  test("creates document_invoices record for a new subscription invoice", async () => {
    const { internal } = await import("../../_generated/api");

    const result = await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_cycle2_456",
      providerSubscriptionId: "sub_recurring_123",
      providerCustomerId: "cus_test_789",
      providerAccountId: "acct_test_001",
      status: "draft",
      customerEmail: "customer@example.com",
      customerName: "Jane Doe",
      amountDue: 10000,
      currency: "usd",
    });

    expect(result).not.toBeNull();
    expect(sealAssertPresent(result).created).toBe(true);

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", "in_cycle2_456"))
        .collect();
    });

    expect(invoices).toHaveLength(1);
    expect(sealAssertPresent(invoices[0]).documentId).toBe(documentId);
    expect(sealAssertPresent(invoices[0]).organizationId).toBe(organizationId);
    expect(sealAssertPresent(invoices[0]).providerSubscriptionId).toBe("sub_recurring_123");
    expect(sealAssertPresent(invoices[0]).providerCustomerId).toBe("cus_test_789");
    expect(sealAssertPresent(invoices[0]).customerEmail).toBe("customer@example.com");
    expect(sealAssertPresent(invoices[0]).amountDue).toBe(10000);
    expect(sealAssertPresent(invoices[0]).status).toBe("draft");
    // Draft invoices should not have finalizedAt
    expect(sealAssertPresent(invoices[0]).finalizedAt).toBeUndefined();
  });

  test("idempotent — does not create duplicate records", async () => {
    const { internal } = await import("../../_generated/api");

    const args = {
      providerInvoiceId: "in_idempotent_test",
      providerSubscriptionId: "sub_recurring_123",
      providerAccountId: "acct_test_001",
      status: "draft" as const,
      customerEmail: "customer@example.com",
      amountDue: 10000,
      currency: "usd",
    };

    const first = await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, args);
    const second = await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, args);

    expect(sealAssertPresent(first).created).toBe(true);
    expect(sealAssertPresent(second).created).toBe(false);

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", "in_idempotent_test"))
        .collect();
    });

    expect(invoices).toHaveLength(1);
  });

  test("updates existing record on finalized (draft → open)", async () => {
    const { internal } = await import("../../_generated/api");

    // First create as draft
    await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_finalize_test",
      providerSubscriptionId: "sub_recurring_123",
      providerAccountId: "acct_test_001",
      status: "draft",
      customerEmail: "customer@example.com",
      amountDue: 10000,
      currency: "usd",
    });

    // Then finalize (invoice.finalized webhook)
    await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_finalize_test",
      providerSubscriptionId: "sub_recurring_123",
      providerAccountId: "acct_test_001",
      status: "open",
      customerEmail: "customer@example.com",
      amountDue: 10000,
      currency: "usd",
      hostedInvoiceUrl: "https://billing.vortex.test/finalized",
      invoicePdf: "https://billing.vortex.test/finalized.pdf",
    });

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", "in_finalize_test"))
        .collect();
    });

    expect(invoices).toHaveLength(1);
    expect(sealAssertPresent(invoices[0]).status).toBe("open");
    expect(sealAssertPresent(invoices[0]).hostedInvoiceUrl).toBe(
      "https://billing.vortex.test/finalized",
    );
    expect(sealAssertPresent(invoices[0]).invoicePdf).toBe(
      "https://billing.vortex.test/finalized.pdf",
    );
    expect(sealAssertPresent(invoices[0]).finalizedAt).toBeDefined();
  });

  test("returns null for unknown subscription", async () => {
    const { internal } = await import("../../_generated/api");

    const result = await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_unknown_sub",
      providerSubscriptionId: "sub_nonexistent_999",
      providerAccountId: "acct_test_001",
      status: "open",
      customerEmail: "nobody@example.com",
      amountDue: 5000,
      currency: "usd",
    });

    expect(result).toBeNull();
  });

  test("creates open invoice with finalizedAt set", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_open_direct",
      providerSubscriptionId: "sub_recurring_123",
      providerAccountId: "acct_test_001",
      status: "open",
      customerEmail: "customer@example.com",
      amountDue: 10000,
      currency: "usd",
      hostedInvoiceUrl: "https://billing.vortex.test/open",
    });

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", "in_open_direct"))
        .collect();
    });

    expect(invoices).toHaveLength(1);
    expect(sealAssertPresent(invoices[0]).status).toBe("open");
    expect(sealAssertPresent(invoices[0]).finalizedAt).toBeDefined();
    expect(sealAssertPresent(invoices[0]).hostedInvoiceUrl).toBe("https://billing.vortex.test/open");
  });

  test("tracks multiple billing cycles as separate invoice records", async () => {
    const { internal } = await import("../../_generated/api");

    // Cycle 2
    await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_cycle2",
      providerSubscriptionId: "sub_recurring_123",
      providerAccountId: "acct_test_001",
      status: "open",
      customerEmail: "customer@example.com",
      amountDue: 10000,
      currency: "usd",
    });

    // Cycle 3
    await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_cycle3",
      providerSubscriptionId: "sub_recurring_123",
      providerAccountId: "acct_test_001",
      status: "open",
      customerEmail: "customer@example.com",
      amountDue: 10000,
      currency: "usd",
    });

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .collect();
    });

    expect(invoices).toHaveLength(2);
    const invoiceIds = invoices.map((i) => i.providerInvoiceId).sort();
    expect(invoiceIds).toEqual(["in_cycle2", "in_cycle3"]);
  });

  test("P1: cycle 2+ invoices get paid via updatePaymentStatusFromProviderInvoice", async () => {
    const { internal } = await import("../../_generated/api");

    // Create cycle 2 invoice via upsertRecurringInvoice
    await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_cycle2_paid",
      providerSubscriptionId: "sub_recurring_123",
      providerAccountId: "acct_test_001",
      status: "open",
      customerEmail: "customer@example.com",
      amountDue: 10000,
      currency: "usd",
    });

    // Simulate invoice.paid webhook — config lookup won't match (config has in_initial_123)
    // but document_invoices lookup should match
    const result = await t.mutation(
      internal.payment_fields.mutations.updatePaymentStatusFromProviderInvoice,
      {
        providerInvoiceId: "in_cycle2_paid",
        paymentStatus: "paid",
      },
    );

    expect(result).not.toBeNull();
    expect(sealAssertPresent(result).invoiceRecordId).toBeDefined();
    expect(sealAssertPresent(result).documentId).toBe(documentId);

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", "in_cycle2_paid"))
        .collect();
    });

    expect(sealAssertPresent(invoices[0]).status).toBe("paid");
    expect(sealAssertPresent(invoices[0]).paidAt).toBeDefined();
  });

  test("P2: replayed create/finalize does not regress terminal status", async () => {
    const { internal } = await import("../../_generated/api");

    // Create invoice and mark it paid
    await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_regress_test",
      providerSubscriptionId: "sub_recurring_123",
      providerAccountId: "acct_test_001",
      status: "open",
      customerEmail: "customer@example.com",
      amountDue: 10000,
      currency: "usd",
    });

    // Mark as paid via webhook
    await t.mutation(internal.payment_fields.mutations.updatePaymentStatusFromProviderInvoice, {
      providerInvoiceId: "in_regress_test",
      paymentStatus: "paid",
    });

    // Replay invoice.created or invoice.finalized (Vortex Billing retried the event)
    await t.mutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
      providerInvoiceId: "in_regress_test",
      providerSubscriptionId: "sub_recurring_123",
      providerAccountId: "acct_test_001",
      status: "draft",
      customerEmail: "customer@example.com",
      amountDue: 10000,
      currency: "usd",
    });

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) => q.eq("providerInvoiceId", "in_regress_test"))
        .collect();
    });

    // Status should remain "paid", not regressed to "draft"
    expect(sealAssertPresent(invoices[0]).status).toBe("paid");
  });
});
