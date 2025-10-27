/**
 * Invitations table schema for Control Zero
 */

import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";
import { organizationMemberRoleTuple } from "./organization_members";

export const organizationInvitationStatusTuple = v.union(
	v.literal("pending"),
	v.literal("accepted"),
	v.literal("declined"),
	v.literal("expired"),
);
export type OrganizationInvitationStatus = Infer<
	typeof organizationInvitationStatusTuple
>;

export const organizationInvitationsTable = defineTable({
	organizationId: v.id("organizations"),
	email: v.string(),
	role: organizationMemberRoleTuple,
	status: organizationInvitationStatusTuple,
	token: v.string(),
	invitedBy: v.id("users"),
	acceptedBy: v.optional(v.id("users")),
	acceptedAt: v.optional(v.number()),
	expiresAt: v.number(),
	createdAt: v.number(),
	// Clerk-specific fields
	clerkInvitationId: v.optional(v.string()),
	clerkOrganizationId: v.optional(v.string()),
	roleId: v.optional(v.id("organization_roles")), // Custom role reference
})
	.index("by_organization", ["organizationId"])
	.index("by_email", ["email"])
	.index("by_token", ["token"])
	.index("by_clerk_invitation_id", ["clerkInvitationId"]);
