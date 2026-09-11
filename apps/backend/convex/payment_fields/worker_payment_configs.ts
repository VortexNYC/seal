import { v } from "convex/values";

import { internalAction } from "../_generated/server";

const paymentFieldConfigCreateArgs = {
  id: v.string(),
  publicId: v.string(),
  fieldId: v.string(),
  documentId: v.string(),
  organizationId: v.string(),
  paymentType: v.string(),
  items: v.string(),
  currency: v.string(),
  dueDateTerms: v.string(),
  customDueDays: v.optional(v.number()),
  customDueDate: v.optional(v.string()),
  lateFees: v.optional(v.string()),
  recurringConfig: v.optional(v.string()),
  installmentsConfig: v.optional(v.string()),
  depositBalanceConfig: v.optional(v.string()),
  allowedPaymentMethods: v.string(),
  feeHandling: v.string(),
  taxEnabled: v.boolean(),
  taxBehavior: v.optional(v.string()),
  totalAmountCents: v.number(),
  providerInvoiceId: v.optional(v.string()),
  providerSubscriptionId: v.optional(v.string()),
  providerPaymentIntentId: v.optional(v.string()),
  hostedInvoiceUrl: v.optional(v.string()),
  vortexPayableId: v.optional(v.string()),
  vortexDepositBalancePayableId: v.optional(v.string()),
  vortexInstallmentPayableId: v.optional(v.string()),
  vortexRecurringPayableId: v.optional(v.string()),
  vortexPaymentRequestId: v.optional(v.string()),
  paymentStatus: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

export const createPaymentFieldConfig = internalAction({
  args: paymentFieldConfigCreateArgs,
  handler: async (_ctx, args) => {
    const url = process.env.SIGN_API_EMAIL_URL;
    const key = process.env.SIGN_API_EMAIL_KEY;
    if (!url || !key) {
      return { created: false };
    }

    const res = await fetch(`${url}/internal/payment-field-configs`, {
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
        `Worker payment-field-configs create failed: ${res.status} ${text}`
      );
    }

    return { created: true };
  },
});
