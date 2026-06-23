"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { selectDocumentPaymentProvider } from "../vortex_billing/payable_actions";

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
    const configs: Doc<"payment_field_configs">[] = await ctx.runQuery(
      internal.payment_fields.queries.getPaymentConfigsByDocumentInternal,
      { documentId: args.documentId },
    );

    if (configs.length === 0) {
      return { paymentLinks: [] };
    }

    const provider = selectDocumentPaymentProvider(args.organizationId, configs);
    if (provider === "vortex_billing") {
      const result: ProviderPaymentObjectsResult = await ctx.runAction(
        internal.vortex_billing.payable_actions.createVortexPaymentObjectsForDocumentFields,
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
    }

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
