import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const subscriptionProductPriceTypeTuple = v.union(
	v.literal("recurring"),
	v.literal("one_time"),
);
export type SubscriptionProductPriceTypeTuple = Infer<
	typeof subscriptionProductPriceTypeTuple
>;

export const subscriptionProductPriceTypeBillingSchemeTuple = v.union(
	v.literal("per_unit"),
	v.literal("tiered"),
);
export type SubscriptionProductPriceTypeBillingSchemeTuple = Infer<
	typeof subscriptionProductPriceTypeBillingSchemeTuple
>;

export const subscriptionProductPriceStatusTuple = v.union(
	v.literal("active"),
	v.literal("archived"),
	v.literal("deleted"),
);
export type SubscriptionProductPriceStatusTuple = Infer<
	typeof subscriptionProductPriceStatusTuple
>;

export const subscriptionPricesTable = defineTable({
	externalPriceId: v.string(), // Stripe price ID (price_xxx)

	externalProductId: v.string(), // Link to product
	subscriptionProductId: v.id("subscription_products"),

	type: subscriptionProductPriceTypeTuple,
	billingScheme: subscriptionProductPriceTypeBillingSchemeTuple,
	currency: v.string(), // "usd"

	// Recurring price fields
	recurring: v.optional(
		v.object({
			interval: v.string(), // "month" | "year"
			intervalCount: v.number(), // 1 for monthly, 12 for yearly
		}),
	),

	// Pricing
	unitAmount: v.optional(v.number()), // Amount in cents (1500 = $15.00)

	// Metered fields
	usageType: v.optional(v.string()), // "metered" | "licensed"

	// Status of price in Stripe: 'active' | 'archived' | 'deleted'
	status: subscriptionProductPriceStatusTuple,
	lookupKey: v.optional(v.string()), // Lookup key: {tier}:{interval}:v{version}

	// Price metadata from Stripe (plan limits)
	// Note: features should be managed via Stripe Product Features API, but kept here for backwards compatibility
	metadata: v.optional(
		v.object({
			tier: v.optional(v.string()), // "free" | "pro"
			documentsPerMonth: v.optional(v.number()), // -1 = unlimited
			maxRecipients: v.optional(v.number()), // -1 = unlimited
			features: v.optional(v.string()), // deprecated: use Product Features instead
		}),
	),

	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_external_price_id", ["externalPriceId"])
	.index("by_external_product_id", ["externalProductId"])
	.index("by_subscription_product_id", ["subscriptionProductId"])
	.index("by_lookup_key", ["lookupKey"]);
