"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

type ProviderPaymentLink = {
  recipientEmail: string;
  hostedInvoiceUrl: string | null;
  providerInvoiceId: string;
  totalAmountCents: number;
  currency: string;
};

type ProviderPaymentObjectsResult = {
  paymentLinks: ProviderPaymentLink[];
};

type PaymentObjectsResult = {
  paymentLinks: Array<{
    recipientEmail: string;
    hostedPaymentUrl: string | null;
    processorInvoiceId: string;
    totalAmountCents: number;
    currency: string;
  }>;
};

export const createPaymentObjectsForDocumentFields = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.object({
    paymentLinks: v.array(
      v.object({
        recipientEmail: v.string(),
        hostedPaymentUrl: v.union(v.string(), v.null()),
        processorInvoiceId: v.string(),
        totalAmountCents: v.number(),
        currency: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<PaymentObjectsResult> => {
    const result: ProviderPaymentObjectsResult = await ctx.runAction(
      internal.stripe.payment_field_actions.createProviderPaymentObjectsForDocumentFields,
      args,
    );

    return {
      paymentLinks: result.paymentLinks.map((link) => ({
        recipientEmail: link.recipientEmail,
        hostedPaymentUrl: link.hostedInvoiceUrl,
        processorInvoiceId: link.providerInvoiceId,
        totalAmountCents: link.totalAmountCents,
        currency: link.currency,
      })),
    };
  },
});
