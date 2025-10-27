/**
 * Guard functions for common permission checks
 *
 * These are helper functions that can be called inside handlers
 * for additional validation beyond the wrapper-level checks
 */

import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { AuthContextWithPermissions } from "./auth.permissions";

/**
 * Ensure user is an owner
 * Throws if user is not an owner
 */
export function ensureOwner(auth: AuthContextWithPermissions): void {
	if (!auth.isOwner) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Owner privileges required",
		});
	}
}

/**
 * Ensure user is an admin (owner or admin role)
 * Throws if user is not an admin
 */
export function ensureAdmin(auth: AuthContextWithPermissions): void {
	if (!auth.isAdmin) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Admin privileges required",
		});
	}
}

/**
 * Ensure a resource belongs to the user's organization
 * Throws if organization IDs don't match
 *
 * @example
 * const document = await ctx.db.get(args.id);
 * ensureOrganizationScope(ctx.auth, document.organizationId);
 */
export function ensureOrganizationScope(
	auth: AuthContextWithPermissions,
	targetOrgId?: Id<"organizations">,
): void {
	if (targetOrgId && targetOrgId !== auth.organizationId) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message:
				"Organization scope mismatch - cannot access resources from different organization",
		});
	}
}

/**
 * Ensure user is an admin AND the resource belongs to their organization
 * Combines ensureAdmin and ensureOrganizationScope
 */
export function ensureAdminForOrg(
	auth: AuthContextWithPermissions,
	targetOrgId?: Id<"organizations">,
): void {
	ensureAdmin(auth);
	ensureOrganizationScope(auth, targetOrgId);
}

/**
 * Ensure user is an owner AND the resource belongs to their organization
 * Combines ensureOwner and ensureOrganizationScope
 */
export function ensureOwnerForOrg(
	auth: AuthContextWithPermissions,
	targetOrgId?: Id<"organizations">,
): void {
	ensureOwner(auth);
	ensureOrganizationScope(auth, targetOrgId);
}

/**
 * Ensure user has a specific permission
 * Throws if user doesn't have the permission
 *
 * @example
 * ensurePermission(ctx.auth, "documents:delete");
 */
export function ensurePermission(
	auth: AuthContextWithPermissions,
	permission: string,
): void {
	if (!auth.hasPermission(permission)) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: `Insufficient permissions: ${permission} required`,
			permission,
		});
	}
}

/**
 * Ensure user has any of the specified permissions
 * Throws if user doesn't have at least one
 */
export function ensureAnyPermission(
	auth: AuthContextWithPermissions,
	permissions: string[],
): void {
	if (!auth.hasAnyPermission(permissions)) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: `Insufficient permissions: one of [${permissions.join(", ")}] required`,
			permissions,
		});
	}
}

/**
 * Ensure user has all of the specified permissions
 * Throws if user doesn't have every single one
 */
export function ensureAllPermissions(
	auth: AuthContextWithPermissions,
	permissions: string[],
): void {
	if (!auth.hasAllPermissions(permissions)) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: `Insufficient permissions: all of [${permissions.join(", ")}] required`,
			permissions,
		});
	}
}

/**
 * Ensure user owns a resource
 * Useful for operations that should only be performed by the creator
 *
 * @example
 * const document = await ctx.db.get(args.id);
 * ensureResourceOwner(ctx.auth, document.createdBy);
 */
export function ensureResourceOwner(
	auth: AuthContextWithPermissions,
	resourceOwnerId: Id<"users">,
): void {
	if (auth.userId !== resourceOwnerId) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "You can only modify your own resources",
		});
	}
}

/**
 * Ensure user owns a resource OR is an admin
 * Common pattern: user can edit their own stuff, or admins can edit anything
 *
 * @example
 * const document = await ctx.db.get(args.id);
 * ensureResourceOwnerOrAdmin(ctx.auth, document.createdBy);
 */
export function ensureResourceOwnerOrAdmin(
	auth: AuthContextWithPermissions,
	resourceOwnerId: Id<"users">,
): void {
	const isResourceOwner = auth.userId === resourceOwnerId;
	const isAdmin = auth.isAdmin;

	if (!isResourceOwner && !isAdmin) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "You can only modify your own resources unless you are an admin",
		});
	}
}
