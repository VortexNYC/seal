/**
 * Enhanced authentication context with permission resolution
 * This extends the existing auth.ts with fine-grained permission management
 */

import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	type RoleTemplate,
	getExpandedPermissions,
	hasAllPermissions,
	hasAnyPermission,
	hasPermission,
	isValidPermission,
} from "./permissions";

/**
 * Enhanced auth context with permissions
 */
export interface AuthContextWithPermissions {
	userId: Id<"users">;
	organizationId: Id<"organizations">;
	email?: string;
	name?: string;
	role: string;
	permissions: string[];
	isOwner: boolean;
	isAdmin: boolean;
	hasPermission: (permission: string) => boolean;
	hasAnyPermission: (permissions: string[]) => boolean;
	hasAllPermissions: (permissions: string[]) => boolean;

	// Include the full docs for backward compatibility
	user: Doc<"users">;
	member: Doc<"organization_members">;
	organization: Doc<"organizations">;
}

/**
 * Get enhanced auth context with resolved permissions
 * This function handles the full permission resolution flow:
 * 1. Authenticate user via Clerk
 * 2. Load user from database
 * 3. Check super admin status
 * 4. Load organization membership
 * 5. Validate membership and organization status
 * 6. Resolve permissions from multiple sources:
 *    - Role template
 *    - Custom role (if assigned)
 *    - Permission overrides
 * 7. Return context with permission helpers
 */
export async function getAuthContextWithPermissions(
	ctx: QueryCtx | MutationCtx,
): Promise<AuthContextWithPermissions> {
	// Step 1: Get Clerk identity
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new ConvexError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
		});
	}

	// Step 2: Load user from database
	const clerkUserId = identity.subject;
	const user = await ctx.db
		.query("users")
		.withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkUserId))
		.first();

	if (!user) {
		throw new ConvexError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	// Step 3: Check super admin status
	if (user.isSuperAdmin) {
		// Super admins bypass all organization checks
		// We still need a valid organization for context
		if (!user.activeOrganizationId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Super admin must have an active organization",
			});
		}

		const organization = await ctx.db.get(user.activeOrganizationId);
		if (!organization) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Organization not found",
			});
		}

		// Get membership for full context
		const member = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q.eq("userId", user._id).eq("organizationId", user.activeOrganizationId!),
			)
			.first();

		if (!member) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "No membership found for super admin",
			});
		}

		return {
			userId: user._id,
			organizationId: user.activeOrganizationId,
			email: user.email,
			name: user.name,
			role: "super_admin",
			permissions: ["*"],
			isOwner: true,
			isAdmin: true,
			hasPermission: () => true,
			hasAnyPermission: () => true,
			hasAllPermissions: () => true,
			user,
			member,
			organization,
		};
	}

	// Step 4: Get active organization
	if (!user.activeOrganizationId) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "No active organization",
		});
	}

	// Step 5: Load membership
	const membership = await ctx.db
		.query("organization_members")
		.withIndex("by_user_organization", (q) =>
			q.eq("userId", user._id).eq("organizationId", user.activeOrganizationId!),
		)
		.first();

	if (!membership) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Not a member of active organization",
		});
	}

	// Step 6: Validate membership status
	if (membership.status !== "active") {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: `Membership is ${membership.status}`,
		});
	}

	// Step 7: Load organization
	const organization = await ctx.db.get(user.activeOrganizationId);
	if (!organization) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Organization not found",
		});
	}

	// Step 8: Validate organization status
	const orgStatus = organization.status ?? "active"; // Default to active for backward compatibility
	if (orgStatus !== "active") {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: `Organization is ${orgStatus}`,
		});
	}

	// Step 9: Resolve permissions from multiple sources
	let permissions: string[] = [];

	// 9a. From custom role if assigned
	if (membership.roleId) {
		const role = await ctx.db.get(membership.roleId);
		if (role) {
			// Use custom role permissions
			permissions = role.permissions.filter(isValidPermission);
		} else {
			// Fallback to template if custom role is deleted
			permissions = getExpandedPermissions(membership.role as RoleTemplate);
		}
	} else {
		// Use role template
		permissions = getExpandedPermissions(membership.role as RoleTemplate);
	}

	// 9b. Apply permission overrides
	if (membership.permissionOverrides) {
		if (membership.permissionOverrides.add) {
			// Add extra permissions
			permissions = [...permissions, ...membership.permissionOverrides.add];
		}
		if (membership.permissionOverrides.remove) {
			// Remove specific permissions
			const removeSet = new Set(membership.permissionOverrides.remove);
			permissions = permissions.filter((p) => !removeSet.has(p));
		}
	}

	// Deduplicate and sort
	permissions = Array.from(new Set(permissions)).sort();

	// Determine role flags
	const isOwner = membership.role === "owner";
	const isAdmin = ["owner", "admin"].includes(membership.role);

	return {
		userId: user._id,
		organizationId: user.activeOrganizationId,
		email: user.email,
		name: user.name,
		role: membership.role,
		permissions,
		isOwner,
		isAdmin,
		hasPermission: (permission: string) =>
			hasPermission(permissions, permission),
		hasAnyPermission: (perms: string[]) => hasAnyPermission(permissions, perms),
		hasAllPermissions: (perms: string[]) =>
			hasAllPermissions(permissions, perms),
		user,
		member: membership,
		organization,
	};
}
