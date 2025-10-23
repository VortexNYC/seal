import { defineSchema } from "convex/server";
import { organizationInvitationsTable } from "./schemas/organization_invitations";
import {
	organizationMembersTable,
	type OrganizationMemberRole,
	type OrganizationMemberStatus,
} from "./schemas/organization_members";
import { organizationsTable, organizationTypeTuple } from "./schemas/organizations";
import { subscriptionPricesTable } from "./schemas/subscription_prices";
import { subscriptionProductsTable } from "./schemas/subscription_products";
import { subscriptionsTable } from "./schemas/subscriptions";
import { usersTable, type UserStatus } from "./schemas/users";
import type { Infer } from "convex/values";

// Re-export types for use in other files
export type MemberStatus = UserStatus; // Member status uses the same values as user status
export type OrganizationRole = OrganizationMemberRole; // Alias for backward compatibility
export type UserType = "personal" | "business"; // Simple user type classification
export type OrganizationType = Infer<typeof organizationTypeTuple>;

// Re-export status and role types
export { type OrganizationMemberRole, type OrganizationMemberStatus, type UserStatus };

export default defineSchema({
	users: usersTable,
	organizations: organizationsTable,
	organization_members: organizationMembersTable,
	organization_invitations: organizationInvitationsTable,

	subscriptions: subscriptionsTable,
	subscription_products: subscriptionProductsTable,
	subscription_prices: subscriptionPricesTable,
});
