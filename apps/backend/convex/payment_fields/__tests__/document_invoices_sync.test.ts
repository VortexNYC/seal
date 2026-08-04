import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

describe("document_invoices sync via storeProviderPaymentIds and updatePaymentStatusFromProviderInvoice", () => {
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
        items: [
          {
            id: "item1",
            description: "Service",
            quantity: 1,
            unitPrice: 50000,
          },
        ],
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

  test("storeProviderPaymentIds creates document_invoices record", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(
      internal.payment_fields.mutations.storeProviderPaymentIds,
      {
        configId,
        paymentStatus: "awaiting",
        providerInvoiceId: "in_test_123",
        hostedInvoiceUrl: "https://billing.vortex.test/test",
        providerAccountId: "acct_test_456",
        customerEmail: "customer@example.com",
        customerName: "Jane Doe",
      }
    );

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .collect();
    });

    expect(invoices).toHaveLength(1);
    expect(sealAssertPresent(invoices[0]).providerInvoiceId).toBe(
      "in_test_123"
    );
    expect(sealAssertPresent(invoices[0]).providerAccountId).toBe(
      "acct_test_456"
    );
    expect(sealAssertPresent(invoices[0]).customerEmail).toBe(
      "customer@example.com"
    );
    expect(sealAssertPresent(invoices[0]).customerName).toBe("Jane Doe");
    expect(sealAssertPresent(invoices[0]).amountDue).toBe(50000);
    expect(sealAssertPresent(invoices[0]).currency).toBe("usd");
    expect(sealAssertPresent(invoices[0]).status).toBe("open");
    expect(sealAssertPresent(invoices[0]).hostedInvoiceUrl).toBe(
      "https://billing.vortex.test/test"
    );
  });

  test("document_invoices accepts Vortex Billing invoice records without provider IDs", async () => {
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
        hostedInvoiceUrl:
          "https://notable-leopard-969.convex.site/pay/pay_test",
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
    expect(invoice?.providerAccountId).toBeUndefined();
    expect(invoice?.providerInvoiceId).toBeUndefined();
    expect(invoice?.vortexPayableId).toBe("payable_test");
    expect(invoice?.vortexPaymentRequestId).toBe("preq_test");
  });

  test("storeProviderPaymentIds is idempotent — does not create duplicate invoices", async () => {
    const { internal } = await import("../../_generated/api");

    const storeArgs = {
      configId,
      paymentStatus: "awaiting" as const,
      providerInvoiceId: "in_test_idempotent",
      providerAccountId: "acct_test_456",
      customerEmail: "customer@example.com",
    };

    await t.mutation(
      internal.payment_fields.mutations.storeProviderPaymentIds,
      storeArgs
    );
    await t.mutation(
      internal.payment_fields.mutations.storeProviderPaymentIds,
      storeArgs
    );

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) =>
          q.eq("providerInvoiceId", "in_test_idempotent")
        )
        .collect();
    });

    expect(invoices).toHaveLength(1);
  });

  test("storeProviderPaymentIds without providerAccountId does not create invoice record", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(
      internal.payment_fields.mutations.storeProviderPaymentIds,
      {
        configId,
        paymentStatus: "awaiting",
        providerInvoiceId: "in_test_no_account",
      }
    );

    const invoices = await t.run(async (ctx) => {
      return await ctx.db.query("document_invoices").collect();
    });

    expect(invoices).toHaveLength(0);
  });

  test("updatePaymentStatusFromProviderInvoice syncs paid status to document_invoices", async () => {
    const { internal } = await import("../../_generated/api");

    // First create the invoice record via storeProviderPaymentIds
    await t.mutation(
      internal.payment_fields.mutations.storeProviderPaymentIds,
      {
        configId,
        paymentStatus: "awaiting",
        providerInvoiceId: "in_test_paid",
        providerAccountId: "acct_test_456",
        customerEmail: "payer@example.com",
      }
    );

    // Now simulate Vortex Billing webhook updating to paid
    const result = await t.mutation(
      internal.payment_fields.mutations.updatePaymentStatusFromProviderInvoice,
      {
        providerInvoiceId: "in_test_paid",
        paymentStatus: "paid",
      }
    );

    expect(result).not.toBeNull();
    expect(sealAssertPresent(result).documentId).toBe(documentId);

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) =>
          q.eq("providerInvoiceId", "in_test_paid")
        )
        .collect();
    });

    expect(invoices).toHaveLength(1);
    expect(sealAssertPresent(invoices[0]).status).toBe("paid");
    expect(sealAssertPresent(invoices[0]).paidAt).toBeDefined();
  });

  test("updatePaymentStatusFromProviderInvoice syncs failed status as uncollectible", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(
      internal.payment_fields.mutations.storeProviderPaymentIds,
      {
        configId,
        paymentStatus: "awaiting",
        providerInvoiceId: "in_test_failed",
        providerAccountId: "acct_test_456",
        customerEmail: "payer@example.com",
      }
    );

    await t.mutation(
      internal.payment_fields.mutations.updatePaymentStatusFromProviderInvoice,
      {
        providerInvoiceId: "in_test_failed",
        paymentStatus: "failed",
      }
    );

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) =>
          q.eq("providerInvoiceId", "in_test_failed")
        )
        .collect();
    });

    expect(sealAssertPresent(invoices[0]).status).toBe("uncollectible");
  });

  test("updatePaymentStatusFromProviderInvoice syncs cancelled status as void", async () => {
    const { internal } = await import("../../_generated/api");

    await t.mutation(
      internal.payment_fields.mutations.storeProviderPaymentIds,
      {
        configId,
        paymentStatus: "awaiting",
        providerInvoiceId: "in_test_void",
        providerAccountId: "acct_test_456",
        customerEmail: "payer@example.com",
      }
    );

    await t.mutation(
      internal.payment_fields.mutations.updatePaymentStatusFromProviderInvoice,
      {
        providerInvoiceId: "in_test_void",
        paymentStatus: "cancelled",
      }
    );

    const invoices = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_provider_invoice", (q) =>
          q.eq("providerInvoiceId", "in_test_void")
        )
        .collect();
    });

    expect(sealAssertPresent(invoices[0]).status).toBe("void");
    expect(sealAssertPresent(invoices[0]).voidedAt).toBeDefined();
  });
});
