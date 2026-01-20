import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const subscriptionProductStatusTuple = v.union(
	v.literal("active"),
	v.literal("archived"),
	v.literal("deleted"),
);
export type SubscriptionProductStatus = Infer<
	typeof subscriptionProductStatusTuple
>;

export const subscriptionProductsTable = defineTable({
	externalProductId: v.string(),

	name: v.string(),
	description: v.optional(v.string()),

	status: subscriptionProductStatusTuple,

	metadata: v.optional(
		v.object({
			tier: v.string(), // "starter" | "pro" | "business"
			includedCredits: v.number(),
			features: v.optional(v.array(v.string())),
			purchase_type: v.optional(v.string()),
		}),
	),

	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_external_product_id", ["externalProductId"])
	.index("by_status", ["status"]);
