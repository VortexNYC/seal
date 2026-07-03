import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const subscriptionProductStatusTuple = v.union(
  v.literal("active"),
  v.literal("archived"),
  v.literal("deleted"),
);
export type SubscriptionProductStatus = Infer<typeof subscriptionProductStatusTuple>;

export const subscriptionProductsTable = defineTable({
  externalProductId: v.string(),
  vortexProductId: v.optional(v.string()),

  name: v.string(),
  description: v.optional(v.string()),

  status: subscriptionProductStatusTuple,

  metadata: v.optional(
    v.object({
      tier: v.optional(v.string()), // "free" | "pro"
      useType: v.optional(v.string()), // "personal" | "business"
      features: v.optional(v.string()), // comma-separated: "api_access,webhook_access"
    }),
  ),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_external_product_id", ["externalProductId"])
  .index("by_vortex_product_id", ["vortexProductId"])
  .index("by_status", ["status"]);
