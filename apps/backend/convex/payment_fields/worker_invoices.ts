import { v } from "convex/values";

import { internalAction } from "../_generated/server";

const documentInvoiceCreateArgs = {
  id: v.string(),
  documentId: v.string(),
  organizationId: v.string(),
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

export const updateDocumentInvoice = internalAction({
  args: {
    payload: v.string(),
  },
  handler: async (_ctx, args) => {
    const url = process.env.SIGN_API_EMAIL_URL;
    const key = process.env.SIGN_API_EMAIL_KEY;
    if (!url || !key) {
      return { updated: false };
    }

    const body = JSON.parse(args.payload);
    const res = await fetch(
      `${url}/internal/document-invoices/${encodeURIComponent(body.id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": key,
        },
        body: JSON.stringify({
          status: body.status,
          paidAt: body.paidAt,
          voidedAt: body.voidedAt,
          dunningCompletedAt: body.dunningCompletedAt,
          deletedAt: body.deletedAt,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Worker document-invoices patch failed: ${res.status} ${text}`
      );
    }

    return { updated: true };
  },
});
