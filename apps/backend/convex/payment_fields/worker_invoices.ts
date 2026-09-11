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
