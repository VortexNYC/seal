import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";

describe("Stripe Invoice mutations", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Invoice Org",
        slug: "invoice-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    const ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@invoice.com",
        name: "Invoice Owner",
        clerkId: "clerk_invoice_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("organization_members", {
        userId: ownerId,
        organizationId,
        role: "owner",
        status: "active",
        isPrimary: true,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Invoice Document",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-invoice",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  test("upserts and updates invoice records", async () => {
    const firstId = await t.run(async (ctx) => {
      return await ctx.runMutation(internal.stripe.invoice_mutations.upsertInvoiceRecord, {
        documentId,
        organizationId,
        stripeAccountId: "acct_test",
        stripeInvoiceId: "in_test_1",
        status: "draft",
        customerEmail: "customer@example.com",
        customerName: "Customer",
        amountDue: 1500,
        currency: "usd",
        hostedInvoiceUrl: undefined,
        invoicePdf: undefined,
        finalizedAt: undefined,
        voidedAt: undefined,
        deletedAt: undefined,
      });
    });

    const updatedId = await t.run(async (ctx) => {
      return await ctx.runMutation(internal.stripe.invoice_mutations.upsertInvoiceRecord, {
        documentId,
        organizationId,
        stripeAccountId: "acct_test",
        stripeInvoiceId: "in_test_1",
        status: "open",
        customerEmail: "customer@example.com",
        customerName: "Customer",
        amountDue: 2000,
        currency: "usd",
        hostedInvoiceUrl: "https://stripe.test/invoice",
        invoicePdf: "https://stripe.test/invoice.pdf",
        finalizedAt: Date.now(),
        voidedAt: undefined,
        deletedAt: undefined,
      });
    });

    expect(updatedId).toBe(firstId);

    const record = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", "in_test_1"))
        .first();
    });

    expect(record?.status).toBe("open");
    expect(record?.amountDue).toBe(2000);
    expect(record?.hostedInvoiceUrl).toBe("https://stripe.test/invoice");
  });

  test("marks invoice as deleted", async () => {
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.stripe.invoice_mutations.upsertInvoiceRecord, {
        documentId,
        organizationId,
        stripeAccountId: "acct_test",
        stripeInvoiceId: "in_test_delete",
        status: "draft",
        customerEmail: "customer@example.com",
        customerName: undefined,
        amountDue: 500,
        currency: "usd",
        hostedInvoiceUrl: undefined,
        invoicePdf: undefined,
        finalizedAt: undefined,
        voidedAt: undefined,
        deletedAt: undefined,
      });
    });

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.stripe.invoice_mutations.markInvoiceDeleted, {
        stripeInvoiceId: "in_test_delete",
      });
    });

    const record = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_invoices")
        .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", "in_test_delete"))
        .first();
    });

    expect(record?.status).toBe("deleted");
    expect(record?.deletedAt).toBeDefined();
  });
});
