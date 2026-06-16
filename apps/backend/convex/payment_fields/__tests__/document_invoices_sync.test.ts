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

describe("document_invoices sync via storeStripeIds and updatePaymentStatusFromWebhook", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;
  let userId: Id<"users">;
  let fieldId: Id<"signature_fields">;
  let configId: Id<"payment_field_configs">;

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

    fieldId = await t.run(async (ctx) => {
      return await ctx.db.insert("signature_fields", {
        documentId,
        fieldType: "payment",
        label: "Payment",
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

    configId = await t.run(async (ctx) => {
      return await ctx.db.insert("payment_field_configs", {
        fieldId,
        documentId,
        organizationId,
        paymentType: "one_time",
        items: [{ id: "item1", description: "Service", quantity: 1, unitPrice: 50000 }],
        currency: "usd",
        dueDateTerms: "net_30",
        allowedPaymentMethods: ["card"],
        feeHandling: "absorb",
        taxEnabled: false,
        totalAmountCents: 50000,
        paymentStatus: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  test("storeStripeIds creates document_invoices record", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.mutations.storeStripeIds, {
      configId,
      paymentStatus: "awaiting",
      stripeInvoiceId: "in_test_123",
      hostedInvoiceUrl: "https://invoice.stripe.com/test",
      stripeAccountId: "acct_test_456",
      customerEmail: "customer@example.com",
      customerName: "Jane Doe",
    });

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .collect();
    });

    expect(invoices).toHaveLength(1);
    expect(sealAssertPresent(invoices[0]).stripeInvoiceId).toBe("in_test_123");
    expect(sealAssertPresent(invoices[0]).stripeAccountId).toBe("acct_test_456");
    expect(sealAssertPresent(invoices[0]).customerEmail).toBe("customer@example.com");
    expect(sealAssertPresent(invoices[0]).customerName).toBe("Jane Doe");
    expect(sealAssertPresent(invoices[0]).amountDue).toBe(50000);
    expect(sealAssertPresent(invoices[0]).currency).toBe("usd");
    expect(sealAssertPresent(invoices[0]).status).toBe("open");
    expect(sealAssertPresent(invoices[0]).hostedInvoiceUrl).toBe("https://invoice.stripe.com/test");
  });

  test("document_invoices accepts Vortex Billing invoice records without Stripe IDs", async () => {
    const now = Date.now();

    const invoiceId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_invoices", {
        documentId,
        organizationId,
        provider: "vortex_billing",
        status: "open",
        customerEmail: "vortex-buyer@example.com",
        customerName: "Vortex Buyer",
        amountDue: 4200,
        currency: "usd",
        hostedInvoiceUrl: "https://notable-leopard-969.convex.site/pay/pay_test",
        vortexPayableId: "payable_test",
        vortexPaymentRequestId: "preq_test",
        dunningStatus: "none",
        finalizedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    });

    const invoice = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceId);
    });

    expect(invoice?.provider).toBe("vortex_billing");
    expect(invoice?.stripeAccountId).toBeUndefined();
    expect(invoice?.stripeInvoiceId).toBeUndefined();
    expect(invoice?.vortexPayableId).toBe("payable_test");
    expect(invoice?.vortexPaymentRequestId).toBe("preq_test");
  });

  test("storeStripeIds is idempotent — does not create duplicate invoices", async () => {
    const { internal } = await import("../../_generated/api");

    const storeArgs = {
      configId,
      paymentStatus: "awaiting" as const,
      stripeInvoiceId: "in_test_idempotent",
      stripeAccountId: "acct_test_456",
      customerEmail: "customer@example.com",
    };

    await t.mutation(internal.payment_fields.mutations.storeStripeIds, storeArgs);
    await t.mutation(internal.payment_fields.mutations.storeStripeIds, storeArgs);

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", "in_test_idempotent"))
        .collect();
    });

    expect(invoices).toHaveLength(1);
  });

  test("storeStripeIds without stripeAccountId does not create invoice record", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.mutations.storeStripeIds, {
      configId,
      paymentStatus: "awaiting",
      stripeInvoiceId: "in_test_no_account",
    });

    const invoices = await t.run(async (ctx) => {
      return await ctx.db.query("document_invoices").collect();
    });

    expect(invoices).toHaveLength(0);
  });

  test("updatePaymentStatusFromWebhook syncs paid status to document_invoices", async () => {
    const { internal } = await import("../../_generated/api");

    // First create the invoice record via storeStripeIds
    await t.mutation(internal.payment_fields.mutations.storeStripeIds, {
      configId,
      paymentStatus: "awaiting",
      stripeInvoiceId: "in_test_paid",
      stripeAccountId: "acct_test_456",
      customerEmail: "payer@example.com",
    });

    // Now simulate Stripe webhook updating to paid
    const result = await t.mutation(
      internal.payment_fields.mutations.updatePaymentStatusFromWebhook,
      {
        stripeInvoiceId: "in_test_paid",
        paymentStatus: "paid",
      },
    );

    expect(result).not.toBeNull();
    expect(sealAssertPresent(result).documentId).toBe(documentId);

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", "in_test_paid"))
        .collect();
    });

    expect(invoices).toHaveLength(1);
    expect(sealAssertPresent(invoices[0]).status).toBe("paid");
    expect(sealAssertPresent(invoices[0]).paidAt).toBeDefined();
  });

  test("updatePaymentStatusFromWebhook syncs failed status as uncollectible", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.mutations.storeStripeIds, {
      configId,
      paymentStatus: "awaiting",
      stripeInvoiceId: "in_test_failed",
      stripeAccountId: "acct_test_456",
      customerEmail: "payer@example.com",
    });

    await t.mutation(internal.payment_fields.mutations.updatePaymentStatusFromWebhook, {
      stripeInvoiceId: "in_test_failed",
      paymentStatus: "failed",
    });

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", "in_test_failed"))
        .collect();
    });

    expect(sealAssertPresent(invoices[0]).status).toBe("uncollectible");
  });

  test("updatePaymentStatusFromWebhook syncs cancelled status as void", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(internal.payment_fields.mutations.storeStripeIds, {
      configId,
      paymentStatus: "awaiting",
      stripeInvoiceId: "in_test_void",
      stripeAccountId: "acct_test_456",
      customerEmail: "payer@example.com",
    });

    await t.mutation(internal.payment_fields.mutations.updatePaymentStatusFromWebhook, {
      stripeInvoiceId: "in_test_void",
      paymentStatus: "cancelled",
    });

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", "in_test_void"))
        .collect();
    });

    expect(sealAssertPresent(invoices[0]).status).toBe("void");
    expect(sealAssertPresent(invoices[0]).voidedAt).toBeDefined();
  });
});
