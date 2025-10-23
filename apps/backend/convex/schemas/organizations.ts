import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const organizationTypeTuple = v.union(
	v.literal("personal"),
	v.literal("group"),
	v.literal("company"),
);
export type OrganizationType = Infer<typeof organizationTypeTuple>;

export const organizationsTable = defineTable({
	name: v.string(),
	slug: v.string(),
	type: organizationTypeTuple,
	logo: v.optional(v.string()),
	metadata: v.optional(v.string()),
	timezone: v.string(), // default "UTC"
	isActive: v.boolean(),
	clerkId: v.optional(v.string()),

	updatedAt: v.number(),
})
	.index("by_slug", ["slug"])
	.index("by_type", ["type"])
	.index("by_active", ["isActive"])
	.index("by_clerk_id", ["clerkId"]);
