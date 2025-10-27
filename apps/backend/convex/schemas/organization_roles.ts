import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const organizationRoleType = v.union(
	v.literal("system"),
	v.literal("custom"),
);
export type OrganizationRoleType = Infer<typeof organizationRoleType>;

export const organizationRolesTable = defineTable({
	name: v.string(),
	permissions: v.array(v.string()),
	organizationId: v.id("organizations"),
	type: organizationRoleType,
	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_organization", ["organizationId"])
	.index("by_name", ["organizationId", "name"])
	.index("by_type", ["type"]);
