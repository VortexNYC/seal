import { v } from "convex/values";

export const feeHandlingValidator = v.union(
  v.literal("absorb"),
  v.literal("pass_to_recipient")
);

export const merchantConnectionStatusValidator = v.union(
  v.literal("not_connected"),
  v.literal("pending"),
  v.literal("restricted"),
  v.literal("connected")
);

export const merchantAccountValidator = v.object({
  _id: v.id("merchant_accounts"),
  processorAccountId: v.string(),
  accountType: v.union(v.literal("standard"), v.literal("express")),
  chargesEnabled: v.boolean(),
  payoutsEnabled: v.boolean(),
  detailsSubmitted: v.boolean(),
  feeHandling: feeHandlingValidator,
  defaultCurrency: v.optional(v.string()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
  capabilities: v.optional(
    v.object({
      cardPayments: v.string(),
      transfers: v.string(),
      usBankAccountAchPayments: v.optional(v.string()),
    })
  ),
  requirements: v.optional(
    v.object({
      currentlyDue: v.array(v.string()),
      eventuallyDue: v.array(v.string()),
      pastDue: v.array(v.string()),
      disabledReason: v.optional(v.string()),
    })
  ),
});

export const merchantAccountResultValidator = v.object({
  status: merchantConnectionStatusValidator,
  account: v.union(merchantAccountValidator, v.null()),
  canManage: v.boolean(),
});
