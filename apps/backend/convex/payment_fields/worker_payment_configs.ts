import { v } from "convex/values";

import { internalAction } from "../_generated/server";

const paymentFieldConfigUpdateArgs = {
  id: v.string(),
  paymentStatus: v.optional(v.string()),
  vortexPayableId: v.optional(v.string()),
  vortexRecurringPayableId: v.optional(v.string()),
  vortexInstallmentPayableId: v.optional(v.string()),
  vortexDepositBalancePayableId: v.optional(v.string()),
  vortexPaymentRequestId: v.optional(v.string()),
  hostedInvoiceUrl: v.optional(v.string()),
  providerInvoiceId: v.optional(v.string()),
  providerSubscriptionId: v.optional(v.string()),
  providerPaymentIntentId: v.optional(v.string()),
};

export const updatePaymentFieldConfig = internalAction({
  args: paymentFieldConfigUpdateArgs,
  handler: async (_ctx, args) => {
    const url = process.env.SIGN_API_EMAIL_URL;
    const key = process.env.SIGN_API_EMAIL_KEY;
    if (!url || !key) {
      return { updated: false };
    }

    const res = await fetch(
      `${url}/internal/payment-field-configs/${encodeURIComponent(args.id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": key,
        },
        body: JSON.stringify({
          paymentStatus: args.paymentStatus,
          vortexPayableId: args.vortexPayableId,
          vortexRecurringPayableId: args.vortexRecurringPayableId,
          vortexInstallmentPayableId: args.vortexInstallmentPayableId,
          vortexDepositBalancePayableId: args.vortexDepositBalancePayableId,
          vortexPaymentRequestId: args.vortexPaymentRequestId,
          hostedInvoiceUrl: args.hostedInvoiceUrl,
          providerInvoiceId: args.providerInvoiceId,
          providerSubscriptionId: args.providerSubscriptionId,
          providerPaymentIntentId: args.providerPaymentIntentId,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Worker payment-field-configs patch failed: ${res.status} ${text}`
      );
    }

    return { updated: true };
  },
});
