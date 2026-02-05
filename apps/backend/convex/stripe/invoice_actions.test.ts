import { beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createAuthenticatedContext } from "../test.setup";

const mockStripeInvoices = vi.hoisted(() => ({
  create: vi.fn(),
  del: vi.fn(),
  retrieve: vi.fn(),
  finalizeInvoice: vi.fn(),
}));

const mockStripeInvoiceItems = vi.hoisted(() => ({
  create: vi.fn(),
}));

const mockStripeCustomers = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("stripe", () => {
  class StripeMock {
    invoices = mockStripeInvoices;
    invoiceItems = mockStripeInvoiceItems;
    customers = mockStripeCustomers;
  }

  return { default: StripeMock };
});

describe("Stripe Invoice actions", () => {
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;
  let documentId: Id<"documents">;
  let t: ReturnType<typeof createAuthenticatedContext>;

  beforeEach(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    mockStripeInvoices.retrieve.mockReset();
    mockStripeInvoices.finalizeInvoice.mockReset();
    mockStripeInvoices.create.mockReset();
    mockStripeInvoices.del.mockReset();
    mockStripeInvoiceItems.create.mockReset();
    mockStripeCustomers.list.mockReset();
    mockStripeCustomers.create.mockReset();
    mockStripeCustomers.update.mockReset();

    t = createAuthenticatedContext("clerk_test_user");

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Stripe Org",
        slug: "stripe-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@stripe.test",
        name: "Stripe Owner",
        clerkId: "clerk_test_user",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("organization_members", {
        userId,
        organizationId,
        role: "owner",
        status: "active",
        isPrimary: true,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Invoice Doc",
        ownerId: userId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 2048,
        fileType: "application/pdf",
        storageId: "storage-invoice-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("stripe_accounts", {
        organizationId,
        stripeAccountId: "acct_test_123",
        accountType: "standard",
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        feeHandling: "absorb",
        defaultCurrency: "usd",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  test("finalizes draft invoices and persists hosted URL", async () => {
    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_test_draft",
      status: "draft",
      customer_email: "customer@test.com",
      customer_name: "Customer",
      amount_due: 2500,
      currency: "usd",
      hosted_invoice_url: null,
      invoice_pdf: null,
    });

    mockStripeInvoices.finalizeInvoice.mockResolvedValue({
      id: "in_test_draft",
      status: "open",
      customer_email: "customer@test.com",
      customer_name: "Customer",
      amount_due: 2500,
      currency: "usd",
      hosted_invoice_url: "https://stripe.test/invoice",
      invoice_pdf: "https://stripe.test/invoice.pdf",
    });

    const result = await t.action(
      internal.stripe.invoice_actions.finalizeInvoiceForDocumentInternal,
      {
        documentId,
        stripeInvoiceId: "in_test_draft",
      },
    );

    expect(mockStripeInvoices.finalizeInvoice).toHaveBeenCalledTimes(1);
    expect(result.hostedInvoiceUrl).toBe("https://stripe.test/invoice");

    const record = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", "in_test_draft"))
        .first();
    });

    expect(record?.status).toBe("open");
    expect(record?.hostedInvoiceUrl).toBe("https://stripe.test/invoice");
  });

  test("returns existing invoice when already finalized", async () => {
    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_test_open",
      status: "open",
      customer_email: "open@test.com",
      customer_name: "Open Customer",
      amount_due: 1200,
      currency: "usd",
      hosted_invoice_url: "https://stripe.test/open",
      invoice_pdf: null,
    });

    const result = await t.action(
      internal.stripe.invoice_actions.finalizeInvoiceForDocumentInternal,
      {
        documentId,
        stripeInvoiceId: "in_test_open",
      },
    );

    expect(mockStripeInvoices.finalizeInvoice).not.toHaveBeenCalled();
    expect(result.hostedInvoiceUrl).toBe("https://stripe.test/open");

    const record = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", "in_test_open"))
        .first();
    });

    expect(record?.status).toBe("open");
    expect(record?.hostedInvoiceUrl).toBe("https://stripe.test/open");
  });

  test("adds platform fee line item when pass_to_recipient", async () => {
    await t.run(async (ctx) => {
      const account = await ctx.db
        .query("stripe_accounts")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .first();

      if (!account) {
        throw new Error("Stripe account not found");
      }

      await ctx.db.patch(account._id, { feeHandling: "pass_to_recipient" });
    });

    mockStripeCustomers.list.mockResolvedValue({ data: [] });
    mockStripeCustomers.create.mockResolvedValue({
      id: "cus_test_1",
      email: "recipient@test.com",
      name: "Recipient",
    });

    mockStripeInvoices.create.mockResolvedValue({
      id: "in_fee_test",
    });

    mockStripeInvoiceItems.create.mockResolvedValue({});

    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_fee_test",
      status: "draft",
      customer_email: "recipient@test.com",
      customer_name: "Recipient",
      amount_due: 10100,
      currency: "usd",
      hosted_invoice_url: null,
      invoice_pdf: null,
      lines: { data: [] },
    });

    await t.action(api.stripe.invoice_actions.createDraftInvoiceForDocument, {
      documentId,
      recipientEmail: "recipient@test.com",
      recipientName: "Recipient",
      description: "Document service fee",
      amountCents: 10000,
      currency: "usd",
    });

    expect(mockStripeInvoices.create).toHaveBeenCalledTimes(1);
    const [invoiceCreateArgs] = mockStripeInvoices.create.mock.calls[0] ?? [];
    expect(invoiceCreateArgs?.application_fee_amount).toBe(100);

    expect(mockStripeInvoiceItems.create).toHaveBeenCalledTimes(2);
    const [baseLineItemArgs] = mockStripeInvoiceItems.create.mock.calls[0] ?? [];
    const [feeLineItemArgs] = mockStripeInvoiceItems.create.mock.calls[1] ?? [];

    expect(baseLineItemArgs?.amount).toBe(10000);
    expect(baseLineItemArgs?.description).toBe("Document service fee");
    expect(feeLineItemArgs?.amount).toBe(100);
    expect(feeLineItemArgs?.description).toBe("Platform fee (Seal)");
  });

  test("does not add platform fee line item when absorb", async () => {
    mockStripeCustomers.list.mockResolvedValue({ data: [] });
    mockStripeCustomers.create.mockResolvedValue({
      id: "cus_test_2",
      email: "recipient2@test.com",
      name: "Recipient 2",
    });

    mockStripeInvoices.create.mockResolvedValue({
      id: "in_fee_absorb",
    });

    mockStripeInvoiceItems.create.mockResolvedValue({});

    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_fee_absorb",
      status: "draft",
      customer_email: "recipient2@test.com",
      customer_name: "Recipient 2",
      amount_due: 10000,
      currency: "usd",
      hosted_invoice_url: null,
      invoice_pdf: null,
      lines: { data: [] },
    });

    await t.action(api.stripe.invoice_actions.createDraftInvoiceForDocument, {
      documentId,
      recipientEmail: "recipient2@test.com",
      recipientName: "Recipient 2",
      description: "Document service fee",
      amountCents: 10000,
      currency: "usd",
    });

    expect(mockStripeInvoices.create).toHaveBeenCalledTimes(1);
    const [invoiceCreateArgs] = mockStripeInvoices.create.mock.calls[0] ?? [];
    expect(invoiceCreateArgs?.application_fee_amount).toBe(100);

    expect(mockStripeInvoiceItems.create).toHaveBeenCalledTimes(1);
    const [baseLineItemArgs] = mockStripeInvoiceItems.create.mock.calls[0] ?? [];

    expect(baseLineItemArgs?.amount).toBe(10000);
    expect(baseLineItemArgs?.description).toBe("Document service fee");
  });

  test("rounds platform fee down for fractional cents", async () => {
    mockStripeCustomers.list.mockResolvedValue({ data: [] });
    mockStripeCustomers.create.mockResolvedValue({
      id: "cus_test_round_down",
      email: "rounddown@test.com",
      name: "Round Down",
    });

    mockStripeInvoices.create.mockResolvedValue({
      id: "in_round_down",
    });

    mockStripeInvoiceItems.create.mockResolvedValue({});

    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_round_down",
      status: "draft",
      customer_email: "rounddown@test.com",
      customer_name: "Round Down",
      amount_due: 333,
      currency: "usd",
      hosted_invoice_url: null,
      invoice_pdf: null,
      lines: { data: [] },
    });

    await t.action(api.stripe.invoice_actions.createDraftInvoiceForDocument, {
      documentId,
      recipientEmail: "rounddown@test.com",
      recipientName: "Round Down",
      description: "Document service fee",
      amountCents: 333,
      currency: "usd",
    });

    const [invoiceCreateArgs] = mockStripeInvoices.create.mock.calls[0] ?? [];
    expect(invoiceCreateArgs?.application_fee_amount).toBe(3);
  });

  test("rounds platform fee up when at half-cent", async () => {
    mockStripeCustomers.list.mockResolvedValue({ data: [] });
    mockStripeCustomers.create.mockResolvedValue({
      id: "cus_test_round_up",
      email: "roundup@test.com",
      name: "Round Up",
    });

    mockStripeInvoices.create.mockResolvedValue({
      id: "in_round_up",
    });

    mockStripeInvoiceItems.create.mockResolvedValue({});

    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_round_up",
      status: "draft",
      customer_email: "roundup@test.com",
      customer_name: "Round Up",
      amount_due: 350,
      currency: "usd",
      hosted_invoice_url: null,
      invoice_pdf: null,
      lines: { data: [] },
    });

    await t.action(api.stripe.invoice_actions.createDraftInvoiceForDocument, {
      documentId,
      recipientEmail: "roundup@test.com",
      recipientName: "Round Up",
      description: "Document service fee",
      amountCents: 350,
      currency: "usd",
    });

    const [invoiceCreateArgs] = mockStripeInvoices.create.mock.calls[0] ?? [];
    expect(invoiceCreateArgs?.application_fee_amount).toBe(4);
  });

  test("rounds Pro platform fee down for fractional cents", async () => {
    const productId = await t.run(async (ctx) => {
      const existingProduct = await ctx.db
        .query("subscription_products")
        .withIndex("by_external_product_id", (q) => q.eq("externalProductId", "prod_pro"))
        .first();

      if (existingProduct) {
        return existingProduct._id;
      }

      return await ctx.db.insert("subscription_products", {
        externalProductId: "prod_pro",
        name: "Pro",
        description: "Pro Plan",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("subscription_prices", {
        externalPriceId: "price_pro",
        externalProductId: "prod_pro",
        subscriptionProductId: productId,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        recurring: { interval: "month", intervalCount: 1 },
        unitAmount: 1000,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        userId,
        externalCustomerId: "cus_pro",
        externalSubscriptionId: "sub_pro",
        externalPriceId: "price_pro",
        status: "active",
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 1000 * 60 * 60 * 24 * 30,
        cancelAtPeriodEnd: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    mockStripeCustomers.list.mockResolvedValue({ data: [] });
    mockStripeCustomers.create.mockResolvedValue({
      id: "cus_test_pro_rounddown",
      email: "pro-rounddown@test.com",
      name: "Pro Round Down",
    });

    mockStripeInvoices.create.mockResolvedValue({
      id: "in_pro_rounddown",
    });

    mockStripeInvoiceItems.create.mockResolvedValue({});

    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_pro_rounddown",
      status: "draft",
      customer_email: "pro-rounddown@test.com",
      customer_name: "Pro Round Down",
      amount_due: 333,
      currency: "usd",
      hosted_invoice_url: null,
      invoice_pdf: null,
      lines: { data: [] },
    });

    await t.action(api.stripe.invoice_actions.createDraftInvoiceForDocument, {
      documentId,
      recipientEmail: "pro-rounddown@test.com",
      recipientName: "Pro Round Down",
      description: "Document service fee",
      amountCents: 333,
      currency: "usd",
    });

    const [invoiceCreateArgs] = mockStripeInvoices.create.mock.calls[0] ?? [];
    expect(invoiceCreateArgs?.application_fee_amount).toBe(1);
  });

  test("rounds Pro platform fee up when at half-cent", async () => {
    const productId = await t.run(async (ctx) => {
      const existingProduct = await ctx.db
        .query("subscription_products")
        .withIndex("by_external_product_id", (q) => q.eq("externalProductId", "prod_pro"))
        .first();

      if (existingProduct) {
        return existingProduct._id;
      }

      return await ctx.db.insert("subscription_products", {
        externalProductId: "prod_pro",
        name: "Pro",
        description: "Pro Plan",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("subscription_prices", {
        externalPriceId: "price_pro_up",
        externalProductId: "prod_pro",
        subscriptionProductId: productId,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        recurring: { interval: "month", intervalCount: 1 },
        unitAmount: 1000,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        userId,
        externalCustomerId: "cus_pro_up",
        externalSubscriptionId: "sub_pro_up",
        externalPriceId: "price_pro_up",
        status: "active",
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 1000 * 60 * 60 * 24 * 30,
        cancelAtPeriodEnd: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    mockStripeCustomers.list.mockResolvedValue({ data: [] });
    mockStripeCustomers.create.mockResolvedValue({
      id: "cus_test_pro_roundup",
      email: "pro-roundup@test.com",
      name: "Pro Round Up",
    });

    mockStripeInvoices.create.mockResolvedValue({
      id: "in_pro_roundup",
    });

    mockStripeInvoiceItems.create.mockResolvedValue({});

    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_pro_roundup",
      status: "draft",
      customer_email: "pro-roundup@test.com",
      customer_name: "Pro Round Up",
      amount_due: 800,
      currency: "usd",
      hosted_invoice_url: null,
      invoice_pdf: null,
      lines: { data: [] },
    });

    await t.action(api.stripe.invoice_actions.createDraftInvoiceForDocument, {
      documentId,
      recipientEmail: "pro-roundup@test.com",
      recipientName: "Pro Round Up",
      description: "Document service fee",
      amountCents: 800,
      currency: "usd",
    });

    const [invoiceCreateArgs] = mockStripeInvoices.create.mock.calls[0] ?? [];
    expect(invoiceCreateArgs?.application_fee_amount).toBe(2);
  });

  test("deletes existing draft before creating a new one", async () => {
    const existingInvoiceId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_invoices", {
        documentId,
        organizationId,
        stripeAccountId: "acct_test_123",
        stripeInvoiceId: "in_old_draft",
        stripeCustomerId: "cus_old",
        status: "draft",
        customerEmail: "old@test.com",
        customerName: "Old Customer",
        amountDue: 5000,
        currency: "usd",
        hostedInvoiceUrl: undefined,
        invoicePdf: undefined,
        finalizedAt: undefined,
        paidAt: undefined,
        voidedAt: undefined,
        deletedAt: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    mockStripeInvoices.del.mockResolvedValue({ id: "in_old_draft", deleted: true });
    mockStripeCustomers.list.mockResolvedValue({ data: [] });
    mockStripeCustomers.create.mockResolvedValue({
      id: "cus_new",
      email: "new@test.com",
      name: "New Customer",
    });

    mockStripeInvoices.create.mockResolvedValue({
      id: "in_new_draft",
    });

    mockStripeInvoiceItems.create.mockResolvedValue({});

    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_new_draft",
      status: "draft",
      customer_email: "new@test.com",
      customer_name: "New Customer",
      amount_due: 5000,
      currency: "usd",
      hosted_invoice_url: null,
      invoice_pdf: null,
      lines: { data: [] },
    });

    await t.action(api.stripe.invoice_actions.createDraftInvoiceForDocument, {
      documentId,
      recipientEmail: "new@test.com",
      recipientName: "New Customer",
      description: "Document service fee",
      amountCents: 5000,
      currency: "usd",
    });

    expect(mockStripeInvoices.del).toHaveBeenCalledTimes(1);
    expect(mockStripeInvoices.del).toHaveBeenCalledWith("in_old_draft", {
      stripeAccount: "acct_test_123",
    });

    const oldRecord = await t.run(async (ctx) => {
      return await ctx.db.get(existingInvoiceId);
    });

    expect(oldRecord?.status).toBe("deleted");
    expect(oldRecord?.deletedAt).toBeDefined();
  });

  test("uses Pro fee for pass_to_recipient line item", async () => {
    await t.run(async (ctx) => {
      const account = await ctx.db
        .query("stripe_accounts")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .first();

      if (!account) {
        throw new Error("Stripe account not found");
      }

      await ctx.db.patch(account._id, { feeHandling: "pass_to_recipient" });
    });

    const productId = await t.run(async (ctx) => {
      const existingProduct = await ctx.db
        .query("subscription_products")
        .withIndex("by_external_product_id", (q) => q.eq("externalProductId", "prod_pro"))
        .first();

      if (existingProduct) {
        return existingProduct._id;
      }

      return await ctx.db.insert("subscription_products", {
        externalProductId: "prod_pro",
        name: "Pro",
        description: "Pro Plan",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("subscription_prices", {
        externalPriceId: "price_pro_pass",
        externalProductId: "prod_pro",
        subscriptionProductId: productId,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        recurring: { interval: "month", intervalCount: 1 },
        unitAmount: 1000,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        userId,
        externalCustomerId: "cus_pro_pass",
        externalSubscriptionId: "sub_pro_pass",
        externalPriceId: "price_pro_pass",
        status: "active",
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 1000 * 60 * 60 * 24 * 30,
        cancelAtPeriodEnd: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    mockStripeCustomers.list.mockResolvedValue({ data: [] });
    mockStripeCustomers.create.mockResolvedValue({
      id: "cus_test_pro_pass",
      email: "pro-pass@test.com",
      name: "Pro Pass",
    });

    mockStripeInvoices.create.mockResolvedValue({
      id: "in_pro_pass",
    });

    mockStripeInvoiceItems.create.mockResolvedValue({});

    mockStripeInvoices.retrieve.mockResolvedValue({
      id: "in_pro_pass",
      status: "draft",
      customer_email: "pro-pass@test.com",
      customer_name: "Pro Pass",
      amount_due: 10025,
      currency: "usd",
      hosted_invoice_url: null,
      invoice_pdf: null,
      lines: { data: [] },
    });

    await t.action(api.stripe.invoice_actions.createDraftInvoiceForDocument, {
      documentId,
      recipientEmail: "pro-pass@test.com",
      recipientName: "Pro Pass",
      description: "Document service fee",
      amountCents: 10000,
      currency: "usd",
    });

    const [invoiceCreateArgs] = mockStripeInvoices.create.mock.calls[0] ?? [];
    expect(invoiceCreateArgs?.application_fee_amount).toBe(25);

    expect(mockStripeInvoiceItems.create).toHaveBeenCalledTimes(2);
    const [baseLineItemArgs] = mockStripeInvoiceItems.create.mock.calls[0] ?? [];
    const [feeLineItemArgs] = mockStripeInvoiceItems.create.mock.calls[1] ?? [];

    expect(baseLineItemArgs?.amount).toBe(10000);
    expect(feeLineItemArgs?.amount).toBe(25);
    expect(feeLineItemArgs?.description).toBe("Platform fee (Seal)");
  });
});
