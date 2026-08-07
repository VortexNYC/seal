/**
 * Mutations for organization roles
 */

import { ConvexError, v } from "convex/values";

import { components } from "../_generated/api";
import { isValidPermission } from "../auth/permissions";
import { permissionMutation } from "../auth/wrappers";
import { getComponentRoleByKey } from "../lib/componentOrgReads";
import { ensureVortexAuthOrganization } from "../lib/vortexAuthOrganizations";

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
      new Set(args.permissions.filter(isValidPermission))
    );

    if (validPermissions.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "At least one valid permission is required",
      });
    }

    const existing = await getComponentRoleByKey(
      ctx,
      ctx.auth.organization,
      args.name
    );
    if (existing !== null) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Role name already exists in this organization",
      });
    }

    const organizationId = await ensureVortexAuthOrganization(
      ctx,
      ctx.auth.organizationId,
      ctx.auth.user.vortexAuthUserId
    );
    const result = await ctx.runMutation(
      components.vortexAuth.organizations.ensureRole,
      {
        organizationId: organizationId,
        key: args.name,
        name: args.name,
        permissions: validPermissions,
        isSystem: false,
        createdBy: ctx.auth.user.vortexAuthUserId,
      }
    );

    return { roleId: result.roleId };
  },
});

/**
 * Update an existing role
 */
export const update = permissionMutation("users:roles")({
  args: {
    roleId: v.string(),
    name: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
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
        roleId: args.roleId,
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
        message: "Cannot modify role from different organization",
      });
    }

    // Prevent system role modification
    if (role.isSystem) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot modify system role",
      });
    }

    let nextName: string | undefined;
    let nextPermissions: string[] | undefined;

    if (args.name !== undefined) {
      const newName = args.name;
      const duplicate = await getComponentRoleByKey(
        ctx,
        ctx.auth.organization,
        newName
      );

      if (duplicate && duplicate.roleId !== args.roleId) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "Role name already exists in this organization",
        });
      }

      nextName = args.name;
    }

    if (args.permissions !== undefined) {
      const validPermissions = Array.from(
        new Set(args.permissions.filter(isValidPermission))
      );

      if (validPermissions.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "At least one valid permission is required",
        });
      }

      nextPermissions = validPermissions;
    }

    await ctx.runMutation(components.vortexAuth.organizations.setRoleDetails, {
      roleId: args.roleId,
      name: nextName,
      permissions: nextPermissions,
    });
    return { ok: true };
  },
});

/**
 * Delete a custom role
 */
export const remove = permissionMutation("users:roles")({
  args: { roleId: v.string() },
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
        roleId: args.roleId,
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
        message: "Cannot delete role from different organization",
      });
    }

    // Prevent system role deletion
    if (role.isSystem) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot delete system role",
      });
    }

    await ctx.runMutation(components.vortexAuth.organizations.deleteRole, {
      roleId: args.roleId,
      organizationId: componentOrganizationId,
    });
    return { ok: true };
  },
});
