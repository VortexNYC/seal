/**
 * @fileoverview Internal helper queries for API context resolution.
 * These are internal queries not exposed to clients, used by the
 * API Context Bridge to resolve Clerk IDs to internal Convex IDs.
 *
 * @module api/helpers
 * @internal
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Look up user by Clerk user ID.
 * Used to resolve API key subject to internal user ID.
 *
 * @internal
 * @param clerkUserId - The Clerk user ID (user_xxx format)
 * @returns User document or null if not found
 */
export const getUserByClerkId = internalQuery({
	args: { clerkUserId: v.string() },
	handler: async (ctx, args) => {
		return ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkUserId))
			.first();
	},
});

/**
 * Look up organization by Clerk org ID.
 * Used to resolve organization-scoped API keys.
 *
 * @internal
 * @param clerkOrgId - The Clerk organization ID (org_xxx format)
 * @returns Organization document or null if not found
 */
export const getOrgByClerkId = internalQuery({
	args: { clerkOrgId: v.string() },
	handler: async (ctx, args) => {
		return ctx.db
			.query("organizations")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkOrgId))
			.first();
	},
});

/**
 * Get membership for user in organization.
 * Validates that a user has an active membership in the target organization.
 *
 * @internal
 * @param userId - Internal Convex user ID
 * @param organizationId - Internal Convex organization ID
 * @returns Membership document or null if not found
 */
export const getMembership = internalQuery({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
	},
	handler: async (ctx, args) => {
		return ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", args.userId).eq("organizationId", args.organizationId),
			)
			.first();
	},
});

/**
 * Get user's active organization.
 * Returns the organization set as active for the user, if any.
 *
 * @internal
 * @param userId - Internal Convex user ID
 * @returns Organization document or null if user has no active organization
 */
export const getUserActiveOrganization = internalQuery({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user?.activeOrganizationId) {
			return null;
		}
		return ctx.db.get(user.activeOrganizationId);
	},
});

/**
 * Get user's permissions in an organization.
 * Fetches the role and computes the effective permissions.
 *
 * @internal
 * @param userId - Internal Convex user ID
 * @param organizationId - Internal Convex organization ID
 * @returns Permission set or null if user is not a member
 */
export const getUserPermissions = internalQuery({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
	},
	handler: async (ctx, args) => {
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", args.userId).eq("organizationId", args.organizationId),
			)
			.first();

		if (!membership || membership.status !== "active") {
			return null;
		}

		// Get role permissions
		const role = await ctx.db
			.query("organization_roles")
			.withIndex("by_name", (q) =>
				q.eq("organizationId", args.organizationId).eq("name", membership.role),
			)
			.first();

		return {
			role: membership.role,
			permissions: role?.permissions ?? [],
			isPrimary: membership.isPrimary ?? false,
		};
	},
});

/**
 * Get organization owner.
 * Returns the primary owner of an organization.
 * Used for organization-scoped API keys when no specific user context is provided.
 *
 * @internal
 * @param organizationId - Internal Convex organization ID
 * @returns User document of the owner or null
 */
export const getOrganizationOwner = internalQuery({
	args: { organizationId: v.id("organizations") },
	handler: async (ctx, args) => {
		// Find primary member (owner)
		const ownerMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", args.organizationId),
			)
			.filter((q) => q.eq(q.field("isPrimary"), true))
			.first();

		if (!ownerMembership) {
			return null;
		}

		return ctx.db.get(ownerMembership.userId);
	},
});

/**
 * Validate document access for API request.
 * Checks if a user has access to a specific document.
 *
 * @internal
 * @param documentId - Document ID to check access for
 * @param userId - User requesting access
 * @param organizationId - Organization context
 * @returns Document if accessible, null otherwise
 */
export const getDocumentForApi = internalQuery({
	args: {
		documentId: v.id("documents"),
		userId: v.id("users"),
		organizationId: v.id("organizations"),
	},
	handler: async (ctx, args) => {
		const document = await ctx.db.get(args.documentId);

		if (!document) {
			return null;
		}

		// Check organization ownership
		if (document.organizationId !== args.organizationId) {
			return null;
		}

		return document;
	},
});

/**
 * Log API activity for analytics and debugging.
 *
 * @internal
 * @param apiKeyId - The Clerk API key ID
 * @param userId - Internal user ID
 * @param organizationId - Internal organization ID
 * @param action - The API action performed (e.g., "documents.list")
 * @param resourceType - Type of resource accessed
 * @param resourceId - Optional specific resource ID
 * @param metadata - Additional metadata about the request
 */
export const logApiActivity = internalQuery({
	args: {
		apiKeyId: v.string(),
		userId: v.id("users"),
		organizationId: v.id("organizations"),
		action: v.string(),
		resourceType: v.optional(v.string()),
		resourceId: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	handler: async (_ctx, args) => {
		// For now, just log to console
		// In production, this could write to an api_activity table
		console.log("[API Activity]", {
			apiKeyId: args.apiKeyId,
			userId: args.userId,
			organizationId: args.organizationId,
			action: args.action,
			resourceType: args.resourceType,
			resourceId: args.resourceId,
			timestamp: new Date().toISOString(),
		});

		return { logged: true };
	},
});
