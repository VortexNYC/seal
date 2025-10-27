/**
 * Query and mutation wrappers for permission-based access control
 *
 * These wrappers automatically check permissions before executing handlers,
 * providing a clean and consistent API for protecting endpoints.
 */

import { ConvexError } from "convex/values";
import {
	customCtx,
	customMutation,
	customQuery,
} from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import { getAuthContextWithPermissions } from "./auth.permissions";

/**
 * Basic authenticated query (no permission check)
 * Use this when you just need to know who the user is
 */
export const authQuery = customQuery(
	query,
	customCtx(async (ctx) => {
		const auth = await getAuthContextWithPermissions(ctx);
		return { auth };
	}),
);

/**
 * Single permission required for query
 * Use this for most read operations
 *
 * @example
 * export const list = permissionQuery("documents:view")({
 *   args: {},
 *   handler: async (ctx) => {
 *     // Permission already checked
 *     return await ctx.db.query("documents").collect();
 *   },
 * });
 */
export const permissionQuery = (requiredPermission: string) =>
	customQuery(
		query,
		customCtx(async (ctx) => {
			const auth = await getAuthContextWithPermissions(ctx);

			if (!auth.hasPermission(requiredPermission)) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message: `Insufficient permissions: ${requiredPermission} required`,
					permission: requiredPermission,
				});
			}

			return { auth };
		}),
	);

/**
 * Any of multiple permissions required (OR logic)
 * Use when user needs at least one of several permissions
 *
 * @example
 * export const myQuery = permissionAnyQuery(["documents:edit", "documents:delete"])({
 *   args: {},
 *   handler: async (ctx) => {
 *     // User has at least one of the permissions
 *     return data;
 *   },
 * });
 */
export const permissionAnyQuery = (requiredPermissions: string[]) =>
	customQuery(
		query,
		customCtx(async (ctx) => {
			const auth = await getAuthContextWithPermissions(ctx);

			if (!auth.hasAnyPermission(requiredPermissions)) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message: `Insufficient permissions: one of [${requiredPermissions.join(", ")}] required`,
					permissions: requiredPermissions,
				});
			}

			return { auth };
		}),
	);

/**
 * All permissions required (AND logic)
 * Use when user needs multiple specific permissions
 *
 * @example
 * export const myQuery = permissionAllQuery(["documents:edit", "documents:share"])({
 *   args: {},
 *   handler: async (ctx) => {
 *     // User has all required permissions
 *     return data;
 *   },
 * });
 */
export const permissionAllQuery = (requiredPermissions: string[]) =>
	customQuery(
		query,
		customCtx(async (ctx) => {
			const auth = await getAuthContextWithPermissions(ctx);

			if (!auth.hasAllPermissions(requiredPermissions)) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message: `Insufficient permissions: all of [${requiredPermissions.join(", ")}] required`,
					permissions: requiredPermissions,
				});
			}

			return { auth };
		}),
	);

/**
 * Admin-only query
 * Requires user to be an admin or owner
 *
 * @example
 * export const dangerousQuery = adminQuery({
 *   args: {},
 *   handler: async (ctx) => {
 *     // Only admins and owners can execute
 *     return sensitiveData;
 *   },
 * });
 */
export const adminQuery = customQuery(
	query,
	customCtx(async (ctx) => {
		const auth = await getAuthContextWithPermissions(ctx);

		if (!auth.isAdmin) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Admin privileges required",
			});
		}

		return { auth };
	}),
);

/**
 * Owner-only query
 * Requires user to be an owner
 */
export const ownerQuery = customQuery(
	query,
	customCtx(async (ctx) => {
		const auth = await getAuthContextWithPermissions(ctx);

		if (!auth.isOwner) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Owner privileges required",
			});
		}

		return { auth };
	}),
);

// =====================
// MUTATION WRAPPERS
// =====================

/**
 * Basic authenticated mutation (no permission check)
 */
export const authMutation = customMutation(
	mutation,
	customCtx(async (ctx) => {
		const auth = await getAuthContextWithPermissions(ctx);
		return { auth };
	}),
);

/**
 * Single permission required for mutation
 * Use this for most write operations
 *
 * @example
 * export const create = permissionMutation("documents:create")({
 *   args: { title: v.string() },
 *   handler: async (ctx, args) => {
 *     // Permission already checked
 *     const id = await ctx.db.insert("documents", { title: args.title });
 *     return { id };
 *   },
 * });
 */
export const permissionMutation = (requiredPermission: string) =>
	customMutation(
		mutation,
		customCtx(async (ctx) => {
			const auth = await getAuthContextWithPermissions(ctx);

			if (!auth.hasPermission(requiredPermission)) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message: `Insufficient permissions: ${requiredPermission} required`,
					permission: requiredPermission,
				});
			}

			return { auth };
		}),
	);

/**
 * Any of multiple permissions required (OR logic)
 */
export const permissionAnyMutation = (requiredPermissions: string[]) =>
	customMutation(
		mutation,
		customCtx(async (ctx) => {
			const auth = await getAuthContextWithPermissions(ctx);

			if (!auth.hasAnyPermission(requiredPermissions)) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message: `Insufficient permissions: one of [${requiredPermissions.join(", ")}] required`,
					permissions: requiredPermissions,
				});
			}

			return { auth };
		}),
	);

/**
 * All permissions required (AND logic)
 */
export const permissionAllMutation = (requiredPermissions: string[]) =>
	customMutation(
		mutation,
		customCtx(async (ctx) => {
			const auth = await getAuthContextWithPermissions(ctx);

			if (!auth.hasAllPermissions(requiredPermissions)) {
				throw new ConvexError({
					code: "FORBIDDEN",
					message: `Insufficient permissions: all of [${requiredPermissions.join(", ")}] required`,
					permissions: requiredPermissions,
				});
			}

			return { auth };
		}),
	);

/**
 * Admin-only mutation
 * Requires user to be an admin or owner
 */
export const adminMutation = customMutation(
	mutation,
	customCtx(async (ctx) => {
		const auth = await getAuthContextWithPermissions(ctx);

		if (!auth.isAdmin) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Admin privileges required",
			});
		}

		return { auth };
	}),
);

/**
 * Owner-only mutation
 * Requires user to be an owner
 */
export const ownerMutation = customMutation(
	mutation,
	customCtx(async (ctx) => {
		const auth = await getAuthContextWithPermissions(ctx);

		if (!auth.isOwner) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Owner privileges required",
			});
		}

		return { auth };
	}),
);
