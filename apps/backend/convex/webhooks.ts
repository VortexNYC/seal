/**
 * Webhook functions for syncing Clerk events to Convex
 * These functions are called by webhook handlers and don't require authentication
 */

import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import type { OrganizationRole } from "./schema";

/**
 * Sync user from Clerk webhook
 */
export const syncUser = mutation({
	args: {
		clerkId: v.string(),
		name: v.optional(v.string()),
		email: v.string(),
		avatar: v.optional(v.string()),
		isEmailVerified: v.boolean(),
		timezone: v.optional(v.string()),
		locale: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if user already exists
		const existingUser = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
			.first();

		const userData = {
			clerkId: args.clerkId,
			name: args.name || undefined,
			email: args.email,
			avatar: args.avatar || undefined,
			isEmailVerified: args.isEmailVerified,
			lastLoginAt: Date.now(),
			timezone: args.timezone || "UTC",
			locale: args.locale || "en-US",
			updatedAt: Date.now(),
		};

		if (existingUser) {
			// Update existing user
			await ctx.db.patch(existingUser._id, userData);
			return { userId: existingUser._id };
		} else {
			// Create new user
			// Note: Organization creation is handled by ensureMyMembership mutation
			// which runs automatically when user first accesses the app
			const userId = await ctx.db.insert("users", userData);
			return { userId };
		}
	},
});

/**
 * Delete user from Clerk webhook
 */
export const deleteUser = mutation({
	args: {
		clerkId: v.string(),
	},
	handler: async (ctx, args) => {
		// Find user by clerk ID
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
			.first();

		if (!user) {
			// User doesn't exist, which is fine for deletion
			// This can happen if the user was never synced or already deleted
			console.log(
				`[deleteUser] User with clerkId ${args.clerkId} not found (already deleted or never synced)`,
			);
			return { success: true };
		}

		// Get all memberships for this user
		const memberships = await ctx.db
			.query("organization_members")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		// Remove user from all organizations
		for (const membership of memberships) {
			await ctx.db.delete(membership._id);
		}

		// Delete the user
		await ctx.db.delete(user._id);

		return { success: true };
	},
});

/**
 * Sync organization from Clerk webhook
 */
export const syncOrganization = mutation({
	args: {
		clerkId: v.string(),
		name: v.string(),
		slug: v.optional(v.string()),
		logo: v.optional(v.string()),
		metadata: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if organization already exists by Clerk ID first
		let existingOrg = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
			.first();

		// If not found by Clerk ID, check by slug (for backwards compatibility)
		if (!existingOrg) {
			existingOrg = await ctx.db
				.query("organizations")
				.withIndex("by_slug", (q) =>
					q.eq(
						"slug",
						args.slug || args.name.toLowerCase().replace(/\s+/g, "-"),
					),
				)
				.first();
		}

		const organizationData = {
			name: args.name,
			slug: args.slug || args.name.toLowerCase().replace(/\s+/g, "-"),
			type: "company" as const, // Default to company type for Clerk organizations
			logo: args.logo || undefined,
			metadata: args.metadata || undefined,
			currency: "BRL", // Default currency
			currencyKind: "normal" as const,
			timezone: "UTC", // Default timezone
			isActive: true,
			clerkId: args.clerkId,
			updatedAt: Date.now(),
		};

		if (existingOrg) {
			// Update existing organization
			await ctx.db.patch(existingOrg._id, organizationData);
			return { organizationId: existingOrg._id };
		} else {
			// Create new organization
			const organizationId = await ctx.db.insert(
				"organizations",
				organizationData,
			);
			return { organizationId };
		}
	},
});

/**
 * Delete organization from Clerk webhook
 */
export const deleteOrganization = mutation({
	args: {
		clerkId: v.string(),
	},
	handler: async (ctx, args) => {
		// Find organization by Clerk ID
		const organization = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
			.first();

		if (!organization) {
			// Organization doesn't exist, which is fine for deletion
			// This can happen if the organization was never synced or already deleted
			console.log(
				`[deleteOrganization] Organization with clerkId ${args.clerkId} not found (already deleted or never synced)`,
			);
			return { success: true };
		}

		const members = await ctx.db
			.query("organization_members")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organization._id),
			)
			.collect();

		for (const member of members) {
			await ctx.db.delete(member._id);
		}

		// Delete organization
		await ctx.db.delete(organization._id);

		return { success: true };
	},
});

/**
 * Sync organization membership from Clerk webhook
 */
export const syncOrganizationMembership = mutation({
	args: {
		userClerkId: v.string(),
		organizationClerkId: v.string(),
		role: v.string(),
	},
	handler: async (ctx, args) => {
		// Find user by Clerk ID
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userClerkId))
			.first();

		if (!user) {
			throw new ConvexError(`User with clerkId ${args.userClerkId} not found`);
		}

		// Find organization by Clerk ID
		const organization = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) =>
				q.eq("clerkId", args.organizationClerkId),
			)
			.first();

		if (!organization) {
			// Organization webhook hasn't been processed yet (webhook ordering issue)
			// This is expected and will be retried by Clerk automatically
			console.log(
				`⚠️ Organization ${args.organizationClerkId} not found yet - webhook will be retried`,
			);
			// Return success to avoid blocking the webhook queue
			// Clerk will retry this webhook later
			return { skipped: true, reason: "Organization not synced yet" };
		}

		// CRITICAL: Never touch personal organizations - they are managed independently
		// Personal orgs don't have clerkId and are created/managed by ensureMyMembership
		if (organization.type === "personal") {
			console.log(
				`⚠️ Ignoring webhook for personal organization ${organization._id} - managed independently`,
			);
			return {
				skipped: true,
				reason: "Personal organizations are not managed by Clerk",
			};
		}

		// Check if membership already exists
		const existingMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", user._id).eq("organizationId", organization._id),
			)
			.first();

		// Check if user has any other memberships (to determine if this is their first org)
		const userMemberships = await ctx.db
			.query("organization_members")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		const isFirstOrganization = userMemberships.length === 0;

		// Map Clerk roles to our role system
		// Only for Clerk-managed organizations (company/group types)
		// Personal organizations are handled by ensureMyMembership and never reach here
		const clerkRole = args.role?.toLowerCase() || "";
		let mappedRole: OrganizationRole;

		// Clerk sends "org:admin" for organization creators/owners
		// We should map this to "owner" role since they created the org
		if (clerkRole.includes("admin") || clerkRole === "org:admin") {
			mappedRole = "owner"; // Creator of the organization should be owner
		} else if (clerkRole.includes("member")) {
			mappedRole = "member";
		} else {
			// Safe default for unrecognized roles
			mappedRole = "viewer";
		}

		console.log(
			`✅ Creating membership - User: ${args.userClerkId}, Org: ${args.organizationClerkId}, Role: ${mappedRole} (from Clerk role: ${args.role}), isFirstOrg: ${isFirstOrganization}`,
		);

		const membershipData = {
			organizationId: organization._id,
			userId: user._id,
			role: mappedRole,
			status: "active" as const,
			isPrimary: isFirstOrganization, // First organization becomes primary
			permissions: [],
		};

		if (existingMembership) {
			// Update existing membership
			await ctx.db.patch(existingMembership._id, membershipData);
			return { membershipId: existingMembership._id };
		} else {
			// Create new membership
			const membershipId = await ctx.db.insert(
				"organization_members",
				membershipData,
			);

			// Set as active organization if user doesn't have one
			if (!user.activeOrganizationId) {
				await ctx.db.patch(user._id, {
					activeOrganizationId: organization._id,
					updatedAt: Date.now(),
				});
			}

			return { membershipId };
		}
	},
});

/**
 * Remove organization membership from Clerk webhook
 */
export const removeOrganizationMembership = mutation({
	args: {
		userClerkId: v.string(),
		organizationClerkId: v.string(),
	},
	handler: async (ctx, args) => {
		// Find user by Clerk ID
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userClerkId))
			.first();

		if (!user) {
			throw new ConvexError(`User with clerkId ${args.userClerkId} not found`);
		}

		// Find organization by Clerk ID
		const organization = await ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) =>
				q.eq("clerkId", args.organizationClerkId),
			)
			.first();

		if (!organization) {
			throw new ConvexError(
				`Organization with clerkId ${args.organizationClerkId} not found`,
			);
		}

		// Find and remove the membership
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", user._id).eq("organizationId", organization._id),
			)
			.first();

		if (!membership) {
			// Membership doesn't exist, which is fine for deletion
			return { success: true };
		}

		// Remove the membership
		await ctx.db.delete(membership._id);

		// If this was the user's active organization, clear it
		if (user.activeOrganizationId === organization._id) {
			await ctx.db.patch(user._id, {
				activeOrganizationId: undefined,
				updatedAt: Date.now(),
			});
		}

		return { success: true };
	},
});
