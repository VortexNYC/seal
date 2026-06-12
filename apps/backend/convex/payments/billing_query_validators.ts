import { v } from "convex/values";

export const billingSubscriptionValidator = v.object({
  status: v.string(),
  currentPeriodStart: v.number(),
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.boolean(),
  canceledAt: v.optional(v.number()),
  trialStart: v.optional(v.number()),
  trialEnd: v.optional(v.number()),
  tier: v.string(),
  planName: v.string(),
  features: v.union(v.string(), v.null()),
  unitAmount: v.number(),
  currency: v.string(),
  interval: v.string(),
  intervalCount: v.number(),
});

export const availablePlanPriceValidator = v.object({
  amount: v.number(),
  currency: v.string(),
  lookupKey: v.union(v.string(), v.null()),
});

export const availablePlanValidator = v.object({
  productId: v.string(),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  tier: v.union(v.string(), v.null()),
  useType: v.union(v.string(), v.null()),
  features: v.union(v.string(), v.null()),
  pricing: v.object({
    monthly: v.union(availablePlanPriceValidator, v.null()),
    yearly: v.union(availablePlanPriceValidator, v.null()),
  }),
});
