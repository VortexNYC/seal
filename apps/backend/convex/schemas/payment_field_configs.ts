import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

/**
 * Payment Field Configs Table Schema
 *
 * Stores complex payment configuration for signature fields of type "payment".
 * Each row has a 1:1 relationship with a signature_fields row where fieldType === "payment".
 *
 * Supports: one-time payments, recurring billing, installments, and deposit+balance.
 */

export const paymentTypeTuple = v.union(
  v.literal("one_time"),
  v.literal("recurring"),
  v.literal("installments"),
  v.literal("deposit_balance")
);
export type PaymentType = Infer<typeof paymentTypeTuple>;

export const dueDateTermsTuple = v.union(
  v.literal("on_receipt"),
  v.literal("net_15"),
  v.literal("net_30"),
  v.literal("net_60"),
  v.literal("custom")
);
export type DueDateTerms = Infer<typeof dueDateTermsTuple>;

export const paymentMethodTuple = v.union(
  v.literal("card"),
  v.literal("ach_debit"),
  v.literal("apple_pay"),
  v.literal("google_pay"),
  v.literal("link")
);
export type PaymentMethod = Infer<typeof paymentMethodTuple>;

export const paymentStatusTuple = v.union(
  v.literal("pending"),
  v.literal("created"),
  v.literal("awaiting"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled")
);
export type PaymentStatus = Infer<typeof paymentStatusTuple>;

const lineItemValidator = v.object({
  id: v.string(),
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(), // cents
  providerProductId: v.optional(v.string()),
  providerPriceId: v.optional(v.string()),
});

const lateFeeValidator = v.object({
  enabled: v.boolean(),
  type: v.union(v.literal("percentage"), v.literal("fixed")),
  amount: v.number(),
  gracePeriodDays: v.number(),
});

const recurringConfigValidator = v.object({
  interval: v.union(v.literal("week"), v.literal("month"), v.literal("year")),
  intervalCount: v.number(),
  endCondition: v.union(
    v.literal("never"),
    v.literal("after_count"),
    v.literal("on_date")
  ),
  endAfterCount: v.optional(v.number()),
  endOnDate: v.optional(v.number()),
});

const installmentsConfigValidator = v.object({
  count: v.number(),
  interval: v.union(v.literal("week"), v.literal("month")),
  firstPaymentAmount: v.optional(v.number()), // cents, if different from equal split
});

const depositBalanceConfigValidator = v.object({
  depositPercent: v.number(),
  balanceDueDays: v.number(),
});

export const paymentFieldConfigsTable = defineTable({
  // References
  fieldId: v.id("signature_fields"),
  documentId: v.id("documents"),
  organizationId: v.id("organizations"),

  // Payment type
  paymentType: paymentTypeTuple,

  // Line items
  items: v.array(lineItemValidator),
  currency: v.string(), // ISO 4217, e.g. "usd"

  // Terms
  dueDateTerms: dueDateTermsTuple,
  customDueDays: v.optional(v.number()), // only when dueDateTerms === "custom" and relative days stated
  customDueDate: v.optional(v.string()), // ISO 8601 date, only when dueDateTerms === "custom" and a calendar date is stated
  lateFees: v.optional(lateFeeValidator),

  // Type-specific configs
  recurringConfig: v.optional(recurringConfigValidator),
  installmentsConfig: v.optional(installmentsConfigValidator),
  depositBalanceConfig: v.optional(depositBalanceConfigValidator),

  // Payment methods
  allowedPaymentMethods: v.array(paymentMethodTuple),

  // Fee handling
  feeHandling: v.union(v.literal("absorb"), v.literal("pass_to_recipient")),

  // Tax
  taxEnabled: v.boolean(),
  taxBehavior: v.optional(
    v.union(v.literal("inclusive"), v.literal("exclusive"))
  ),

  // Denormalized total for display
  totalAmountCents: v.number(),

  // Provider references (populated when document is sent)
  providerInvoiceId: v.optional(v.string()),
  providerSubscriptionId: v.optional(v.string()),
  providerPaymentIntentId: v.optional(v.string()),
  hostedInvoiceUrl: v.optional(v.string()),
  vortexPayableId: v.optional(v.string()),
  vortexDepositBalancePayableId: v.optional(v.string()),
  vortexInstallmentPayableId: v.optional(v.string()),
  vortexRecurringPayableId: v.optional(v.string()),
  vortexPaymentRequestId: v.optional(v.string()),

  // Payment status
  paymentStatus: v.optional(paymentStatusTuple),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_field", ["fieldId"])
  .index("by_document", ["documentId"])
  .index("by_organization", ["organizationId"])
  .index("by_provider_invoice", ["providerInvoiceId"])
  .index("by_provider_subscription", ["providerSubscriptionId"])
  .index("by_vortex_payable", ["vortexPayableId"]);
