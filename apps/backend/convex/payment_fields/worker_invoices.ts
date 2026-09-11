import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalQuery } from "../_generated/server";

export const getDocumentInvoiceById = internalQuery({
  args: { invoiceId: v.id("document_invoices") },
  handler: async (ctx, args) => {
    return await ctx.db.get("document_invoices", args.invoiceId);
  },
});

function invoicePayload(invoice: Doc<"document_invoices">) {
  return {
    id: invoice._id,
    documentId: invoice.documentId,
    organizationId: invoice.organizationId,
    provider: invoice.provider,
    providerAccountId: invoice.providerAccountId,
    providerInvoiceId: invoice.providerInvoiceId,
    providerCustomerId: invoice.providerCustomerId,
    providerSubscriptionId: invoice.providerSubscriptionId,
    vortexPayableId: invoice.vortexPayableId,
    vortexPaymentRequestId: invoice.vortexPaymentRequestId,
    status: invoice.status,
    customerEmail: invoice.customerEmail,
    customerName: invoice.customerName,
    amountDue: invoice.amountDue,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hostedInvoiceUrl,
    invoicePdf: invoice.invoicePdf,
    finalizedAt: invoice.finalizedAt,
    paidAt: invoice.paidAt,
    voidedAt: invoice.voidedAt,
    deletedAt: invoice.deletedAt,
    dunningStatus: invoice.dunningStatus,
    dunningStep: invoice.dunningStep,
    dunningStartedAt: invoice.dunningStartedAt,
    lastDunningEmailAt: invoice.lastDunningEmailAt,
    nextDunningAt: invoice.nextDunningAt,
    dunningCompletedAt: invoice.dunningCompletedAt,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

const documentInvoiceCreateArgs = {
  id: v.string(),
  documentId: v.id("documents"),
  organizationId: v.id("organizations"),
  provider: v.optional(v.string()),
  providerAccountId: v.optional(v.string()),
  providerInvoiceId: v.optional(v.string()),
  providerCustomerId: v.optional(v.string()),
  providerSubscriptionId: v.optional(v.string()),
  vortexPayableId: v.optional(v.string()),
  vortexPaymentRequestId: v.optional(v.string()),
  status: v.string(),
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
  dunningStatus: v.optional(v.string()),
  dunningStep: v.optional(v.number()),
  dunningStartedAt: v.optional(v.number()),
  lastDunningEmailAt: v.optional(v.number()),
  nextDunningAt: v.optional(v.number()),
  dunningCompletedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const createDocumentInvoice = internalAction({
  args: documentInvoiceCreateArgs,
  handler: async (_ctx, args) => {
    const url = process.env.SIGN_API_EMAIL_URL;
    const key = process.env.SIGN_API_EMAIL_KEY;
    if (!url || !key) {
      return { created: false };
    }

    const res = await fetch(`${url}/internal/document-invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": key,
      },
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Worker document-invoices create failed: ${res.status} ${text}`
      );
    }

    return { created: true };
  },
});

export const syncDocumentInvoiceToWorker = internalAction({
  args: { invoiceId: v.id("document_invoices") },
  handler: async (ctx, args) => {
    const url = process.env.SIGN_API_EMAIL_URL;
    const key = process.env.SIGN_API_EMAIL_KEY;
    if (!url || !key) {
      return { synced: false };
    }

    const invoice: Doc<"document_invoices"> | null = await ctx.runQuery(
      internal.payment_fields.worker_invoices.getDocumentInvoiceById,
      { invoiceId: args.invoiceId }
    );

    if (!invoice) {
      return { synced: false };
    }

    const res = await fetch(`${url}/internal/document-invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": key,
      },
      body: JSON.stringify(invoicePayload(invoice)),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Worker document-invoices sync failed: ${res.status} ${text}`
      );
    }

    return { synced: true };
  },
});
