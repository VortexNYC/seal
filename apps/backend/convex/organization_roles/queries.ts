/**
 * Queries for organization roles
 */

import { ConvexError, v } from "convex/values";

import { components } from "../_generated/api";
import { permissionQuery } from "../auth/wrappers";
import {
  type ComponentResolvedRole,
  getComponentRoleByKey,
  listComponentRolesByOrganization,
} from "../lib/componentOrgReads";

function toLegacyRole(role: ComponentResolvedRole) {
  return {
    _id: role.roleId,
    organizationId: role.organizationId,
    name: role.name,
    permissions: role.permissions,
    type: role.isSystem ? "system" : "custom",
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

/**
 * List all roles for the current organization
 * Includes both system and custom roles
 */
export const list = permissionQuery("users:roles")({
  args: {},
  handler: async (ctx) => {
    const roles = await listComponentRolesByOrganization(
      ctx,
      ctx.auth.organization
    );
    return roles.map(toLegacyRole);
  },
});

/**
 * Get a specific role by ID
 */
export const getById = permissionQuery("users:roles")({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const componentOrganizationId =
      ctx.auth.organization.vortexAuthOrganizationId;
    if (!componentOrganizationId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Role not found",
      });
    }

    const role = await ctx.runQuery(
      components.vortexAuth.organizations.getRole,
      {
        roleId: args.id,
        organizationId: componentOrganizationId,
      }
    );

    if (!role) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Role not found",
      });
    }

    if (role.organizationId !== componentOrganizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot access role from different organization",
      });
    }

    return toLegacyRole({
      roleId: role._id,
      organizationId: ctx.auth.organizationId,
      name: role.key,
      permissions: role.permissions,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    });
  },
});

/**
 * Get role by name within the current organization
 */
export const getByName = permissionQuery("users:roles")({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const role = await getComponentRoleByKey(
      ctx,
      ctx.auth.organization,
      args.name
    );

    if (!role) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Role not found",
      });
    }

    return toLegacyRole(role);
  },
});

/**
 * List only custom roles (excludes system roles)
 */
export const listCustom = permissionQuery("users:roles")({
  args: {},
  handler: async (ctx) => {
    const roles = await listComponentRolesByOrganization(
      ctx,
      ctx.auth.organization
    );
    return roles.filter((role) => !role.isSystem).map(toLegacyRole);
  },
});

/**
 * Check if a role name is available in the organization
 */
export const isNameAvailable = permissionQuery("users:roles")({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const existing = await getComponentRoleByKey(
      ctx,
      ctx.auth.organization,
      args.name
    );
    return { available: !existing };
  },
});
