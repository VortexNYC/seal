import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Product Features synced from Stripe Entitlements API
 *
 * Features are defined in Stripe and attached to Products.
 * When a customer subscribes, they get entitlements to these features.
 *
 * @see https://docs.stripe.com/billing/entitlements
 */
export const productFeaturesTable = defineTable({
	// Stripe feature ID (feat_xxx)
	externalFeatureId: v.string(),

	// The product this feature is attached to
	externalProductId: v.string(),
	subscriptionProductId: v.id("subscription_products"),

	// Feature lookup key (e.g., "api_access", "custom_branding")
	lookupKey: v.string(),

	// Feature name for display
	name: v.string(),

	// Feature description (from Stripe feature metadata.description)
	description: v.optional(v.string()),

	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_external_feature_id", ["externalFeatureId"])
	.index("by_external_product_id", ["externalProductId"])
	.index("by_subscription_product_id", ["subscriptionProductId"])
	.index("by_lookup_key", ["lookupKey"]);
