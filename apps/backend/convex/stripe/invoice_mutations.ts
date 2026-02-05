import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Internal queries/mutations for document-scoped Stripe invoices.
 * The Stripe invoice remains the source of truth; this table is for quick lookups.
 */

export const getInvoiceByStripeId = internalQuery({
  args: { stripeInvoiceId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("document_invoices")
      .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();
  },
});

export const getDraftInvoiceByDocument = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("document_invoices")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("status"), "draft"))
      .order("desc")
      .first();
  },
});

export const upsertInvoiceRecord = internalMutation({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    stripeAccountId: v.string(),
    stripeInvoiceId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("paid"),
      v.literal("void"),
      v.literal("uncollectible"),
      v.literal("deleted"),
    ),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    amountDue: v.number(),
    currency: v.string(),
    hostedInvoiceUrl: v.optional(v.string()),
    invoicePdf: v.optional(v.string()),
    finalizedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    voidedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("document_invoices")
      .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();

    const now = Date.now();
    const payload = {
      documentId: args.documentId,
      organizationId: args.organizationId,
      stripeAccountId: args.stripeAccountId,
      stripeInvoiceId: args.stripeInvoiceId,
      stripeCustomerId: args.stripeCustomerId,
      status: args.status,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      amountDue: args.amountDue,
      currency: args.currency,
      hostedInvoiceUrl: args.hostedInvoiceUrl,
      invoicePdf: args.invoicePdf,
      finalizedAt: args.finalizedAt,
      paidAt: args.paidAt,
      voidedAt: args.voidedAt,
      deletedAt: args.deletedAt,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return ctx.db.insert("document_invoices", {
      ...payload,
      createdAt: now,
    });
  },
});

export const updateInvoiceStatus = internalMutation({
  args: {
    stripeInvoiceId: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("paid"),
      v.literal("void"),
      v.literal("uncollectible"),
      v.literal("deleted"),
    ),
    paidAt: v.optional(v.number()),
    voidedAt: v.optional(v.number()),
    hostedInvoiceUrl: v.optional(v.string()),
    invoicePdf: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("document_invoices")
      .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, {
      status: args.status,
      paidAt: args.paidAt,
      voidedAt: args.voidedAt,
      hostedInvoiceUrl: args.hostedInvoiceUrl ?? existing.hostedInvoiceUrl,
      invoicePdf: args.invoicePdf ?? existing.invoicePdf,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

export const markInvoiceDeleted = internalMutation({
  args: { stripeInvoiceId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("document_invoices")
      .withIndex("by_stripe_invoice", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, {
      status: "deleted",
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});
