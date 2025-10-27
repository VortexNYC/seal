/**
 * Mutations for organization roles
 */

import { ConvexError, v } from "convex/values";
import { isValidPermission } from "../auth/permissions";
import { permissionMutation } from "../auth/wrappers";

/**
 * Create a new custom role
 */
export const create = permissionMutation("users:roles")({
	args: {
		name: v.string(),
		permissions: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		// Validate permissions
		const validPermissions = Array.from(
			new Set(args.permissions.filter(isValidPermission)),
		);

		if (validPermissions.length === 0) {
			throw new ConvexError({
				code: "BAD_REQUEST",
				message: "At least one valid permission is required",
			});
		}

		// Check for duplicate name
		const existing = await ctx.db
			.query("organization_roles")
			.withIndex("by_name", (q) =>
				q.eq("organizationId", ctx.auth.organizationId).eq("name", args.name),
			)
			.first();

		if (existing) {
			throw new ConvexError({
				code: "CONFLICT",
				message: "Role name already exists in this organization",
			});
		}

		const now = Date.now();
		const id = await ctx.db.insert("organization_roles", {
			name: args.name,
			permissions: validPermissions,
			organizationId: ctx.auth.organizationId,
			type: "custom",
			createdAt: now,
			updatedAt: now,
		});

		return { roleId: id };
	},
});

/**
 * Update an existing role
 */
export const update = permissionMutation("users:roles")({
	args: {
		roleId: v.id("organization_roles"),
		name: v.optional(v.string()),
		permissions: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const role = await ctx.db.get(args.roleId);

		if (!role) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Role not found",
			});
		}

		// Ensure role belongs to user's organization
		if (role.organizationId !== ctx.auth.organizationId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Cannot modify role from different organization",
			});
		}

		// Prevent system role modification
		if (role.type === "system") {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Cannot modify system role",
			});
		}

		const updates: {
			name?: string;
			permissions?: string[];
			updatedAt: number;
		} = {
			updatedAt: Date.now(),
		};

		// Update name if provided
		if (args.name !== undefined) {
			const newName = args.name;
			// Check for duplicate
			const duplicate = await ctx.db
				.query("organization_roles")
				.withIndex("by_name", (q) =>
					q.eq("organizationId", ctx.auth.organizationId).eq("name", newName),
				)
				.first();

			if (duplicate && duplicate._id !== args.roleId) {
				throw new ConvexError({
					code: "CONFLICT",
					message: "Role name already exists in this organization",
				});
			}

			updates.name = args.name;
		}

		// Update permissions if provided
		if (args.permissions !== undefined) {
			const validPermissions = Array.from(
				new Set(args.permissions.filter(isValidPermission)),
			);

			if (validPermissions.length === 0) {
				throw new ConvexError({
					code: "BAD_REQUEST",
					message: "At least one valid permission is required",
				});
			}

			updates.permissions = validPermissions;
		}

		await ctx.db.patch(args.roleId, updates);
		return { ok: true };
	},
});

/**
 * Delete a custom role
 */
export const remove = permissionMutation("users:roles")({
	args: { roleId: v.id("organization_roles") },
	handler: async (ctx, args) => {
		const role = await ctx.db.get(args.roleId);

		if (!role) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Role not found",
			});
		}

		// Ensure role belongs to user's organization
		if (role.organizationId !== ctx.auth.organizationId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Cannot delete role from different organization",
			});
		}

		// Prevent system role deletion
		if (role.type === "system") {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Cannot delete system role",
			});
		}

		// Check if role is assigned to any members
		const assigned = await ctx.db
			.query("organization_members")
			.withIndex("by_role", (q) => q.eq("roleId", args.roleId))
			.first();

		if (assigned) {
			throw new ConvexError({
				code: "CONFLICT",
				message:
					"Role is assigned to members. Reassign members before deleting.",
			});
		}

		await ctx.db.delete(args.roleId);
		return { ok: true };
	},
});
