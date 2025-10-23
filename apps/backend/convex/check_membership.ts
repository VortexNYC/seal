/**
 * Check if user has organization membership
 * This is a lightweight query that doesn't require organization context
 */

import { ConvexError } from "convex/values";
import { query } from "./_generated/server";

/**
 * Check if current user has any organization memberships
 * Returns true if user has at least one membership, false otherwise
 */
export const hasOrganization = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError("Authentication required");
		}

		// Get user by Clerk ID
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
			.first();

		if (!user) {
			// User doesn't exist yet (webhook might not have synced)
			return { hasOrganization: false, userId: null };
		}

		// Check if user has any organization memberships
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.first();

		let activeOrganizationId = user.activeOrganizationId ?? null;
		let activeOrganizationSlug: string | null = null;

		if (!activeOrganizationId && membership) {
			activeOrganizationId = membership.organizationId;
		}

		if (activeOrganizationId) {
			const activeOrganization = await ctx.db.get(activeOrganizationId);

			if (activeOrganization) {
				activeOrganizationSlug = activeOrganization.slug;
			} else {
				activeOrganizationId = null;
			}
		}

		return {
			hasOrganization: !!membership,
			userId: user._id,
			activeOrganizationId,
			activeOrganizationSlug,
		};
	},
});

export const listUserOrganizations = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError("Authentication required");
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
			.first();

		if (!user) {
			return [];
		}

		const memberships = await ctx.db
			.query("organization_members")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		const organizations = await Promise.all(
			memberships.map(async (membership) => {
				const organization = await ctx.db.get(membership.organizationId);
				if (!organization) {
					return null;
				}

				return {
					organizationId: membership.organizationId,
					organizationName: organization.name,
					organizationSlug: organization.slug,
					role: membership.role,
				};
			}),
		);

		return organizations.filter((org) => org !== null);
	},
});
