import { defineTable } from "convex/server";
import { v } from "convex/values";

export const stripeAccountsTable = defineTable({
  organizationId: v.id("organizations"),
  stripeAccountId: v.string(),
  accountType: v.union(v.literal("standard"), v.literal("express")),
  chargesEnabled: v.boolean(),
  payoutsEnabled: v.boolean(),
  detailsSubmitted: v.boolean(),
  requirements: v.optional(
    v.object({
      currentlyDue: v.array(v.string()),
      eventuallyDue: v.array(v.string()),
      pastDue: v.array(v.string()),
      disabledReason: v.optional(v.string()),
    }),
  ),
  capabilities: v.optional(
    v.object({
      cardPayments: v.string(),
      transfers: v.string(),
      usBankAccountAchPayments: v.optional(v.string()),
    }),
  ),
  feeHandling: v.union(v.literal("absorb"), v.literal("pass_to_recipient")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_stripe_account", ["stripeAccountId"]);

export type StripeAccountType = "standard" | "express";
export type StripeFeeHandling = "absorb" | "pass_to_recipient";
