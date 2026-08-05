/**
 * Core Vortex Auth role-manager surface adapters.
 *
 * FunctionReference shapes for `@vortexnyc/auth/react`
 * VortexOrganizationRoleManagerSurface — custom org roles on settings/team.
 */
import { ConvexError, v } from "convex/values";

import { components } from "../_generated/api";
import { query } from "../_generated/server";
import { authMutation, authQuery } from "../auth";
import { PERMISSIONS } from "../auth/permissions";
import {
  getComponentRoleByKey,
  listComponentRolesByOrganization,
} from "../lib/componentOrgReads";
import { ensureVortexAuthOrganization } from "../lib/vortexAuthOrganizations";

function requireRoleManagePermission(ctx: {
  auth: {
    hasPermission: (permission: string) => boolean;
    isAdmin: () => boolean;
  };
}): void {
  if (
    ctx.auth.hasPermission("users:roles") ||
    ctx.auth.hasPermission("org:users:update_role") ||
    ctx.auth.isAdmin()
  ) {
    return;
  }
  throw new ConvexError({
    code: "FORBIDDEN",
    message: "Insufficient permissions to manage roles",
  });
}
/** Permission checklist for VortexOrganizationRoleManagerSurface. */
export const listPermissions = query({
  args: {},
  handler: async () => {
    return Object.entries(PERMISSIONS)
      .filter(([key]) => key !== "system:super" && key !== "system:maintenance")
      .map(([key, description]) => ({ key, description }));
  },
});

/** Active-org roles (system + custom) from the vortexAuth component. */
export const listRoles = authQuery({
  args: {},
  handler: async (ctx) => {
    requireRoleManagePermission(ctx);

    const roles = await listComponentRolesByOrganization(
      ctx,
      ctx.auth.organization
    );

    return roles.map((role) => ({
      _id: role.roleId,
      name: role.name,
      key: role.name,
      permissions: role.permissions,
      isSystem: role.isSystem,
      type: role.isSystem ? "system" : "custom",
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  },
});

/** Create a custom component role for the active organization. */
export const createRole = authMutation({
  args: {
    name: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    requireRoleManagePermission(ctx);

    const normalizedName = args.name.trim();
    if (!normalizedName) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Role name required",
      });
    }

    const reserved = new Set(["system", "owner", "admin", "member", "viewer"]);
    if (reserved.has(normalizedName.toLowerCase())) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Cannot create a role with a system template name",
      });
    }

    const catalogKeys = new Set(Object.keys(PERMISSIONS));
    for (const permission of args.permissions) {
      if (!catalogKeys.has(permission)) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: `Unknown permission: ${permission}`,
        });
      }
      if (
        permission === "system:super" ||
        permission === "system:maintenance"
      ) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: "System permissions cannot be granted on custom roles",
        });
      }
    }

    if (args.permissions.length === 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "At least one permission is required",
      });
    }

    const { organization } = ctx.auth;
    const existing = await getComponentRoleByKey(
      ctx,
      organization,
      normalizedName
    );
    if (existing) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "Role already exists",
      });
    }

    const vortexAuthOrganizationId = await ensureVortexAuthOrganization(
      ctx,
      organization._id
    );
    const result = await ctx.runMutation(
      components.vortexAuth.organizations.ensureRole,
      {
        organizationId: vortexAuthOrganizationId,
        key: normalizedName,
        name: normalizedName,
        permissions: args.permissions,
        isSystem: false,
      }
    );
    return result.roleId;
  },
});
