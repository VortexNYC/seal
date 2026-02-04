/**
 * Queries for organization roles
 */

import { ConvexError, v } from "convex/values";

import { permissionQuery } from "../auth/wrappers";

/**
 * List all roles for the current organization
 * Includes both system and custom roles
 */
export const list = permissionQuery("users:roles")({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db
      .query("organization_roles")
      .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organizationId))
      .collect();

    return roles;
  },
});

/**
 * Get a specific role by ID
 */
export const getById = permissionQuery("users:roles")({
  args: { id: v.id("organization_roles") },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.id);

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
        message: "Cannot access role from different organization",
      });
    }

    return role;
  },
});

/**
 * Get role by name within the current organization
 */
export const getByName = permissionQuery("users:roles")({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const role = await ctx.db
      .query("organization_roles")
      .withIndex("by_name", (q) =>
        q.eq("organizationId", ctx.auth.organizationId).eq("name", args.name),
      )
      .first();

    if (!role) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Role not found",
      });
    }

    return role;
  },
});

/**
 * List only custom roles (excludes system roles)
 */
export const listCustom = permissionQuery("users:roles")({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db
      .query("organization_roles")
      .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organizationId))
      .filter((q) => q.eq(q.field("type"), "custom"))
      .collect();

    return roles;
  },
});

/**
 * Check if a role name is available in the organization
 */
export const isNameAvailable = permissionQuery("users:roles")({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organization_roles")
      .withIndex("by_name", (q) =>
        q.eq("organizationId", ctx.auth.organizationId).eq("name", args.name),
      )
      .first();

    return { available: !existing };
  },
});
