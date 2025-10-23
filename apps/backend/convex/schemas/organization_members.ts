import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";
import { userStatus } from "./users";

export const organizationMemberRoleTuple = v.union(
	v.literal("system"),
	v.literal("admin"),
	v.literal("owner"),
	v.literal("member"),
	v.literal("viewer"),
);
export type OrganizationMemberRole = Infer<typeof organizationMemberRoleTuple>;

export const organizationMemberStatus = userStatus;
export type OrganizationMemberStatus = Infer<typeof organizationMemberStatus>;

export const organizationMembersTable = defineTable({
	userId: v.id("users"),
	organizationId: v.id("organizations"),

	role: organizationMemberRoleTuple,
	permissions: v.optional(v.array(v.string())),

	status: organizationMemberStatus,

	isPrimary: v.boolean(),

	externalId: v.optional(v.string()),
})
	.index("by_user", ["userId"])
	.index("by_organization", ["organizationId"])
	.index("by_user_organization", ["userId", "organizationId"])
	.index("by_user_primary", ["userId", "isPrimary"])
	.index("by_organization_status", ["organizationId", "status"])
	.index("by_user_status", ["userId", "status"]);
