/**
 * Query and mutation wrappers for permission-based access control
 *
 * These wrappers automatically check permissions before executing handlers,
 * providing a clean and consistent API for protecting endpoints.
 *
 * RLS (Row-Level Security) is automatically applied to ctx.db through
 * wrapDatabaseReader/wrapDatabaseWriter from convex-helpers.
 */

import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { wrapDatabaseReader, wrapDatabaseWriter } from "convex-helpers/server/rowLevelSecurity";
import { ConvexError } from "convex/values";

import { mutation, query } from "../_generated/server";
import { rlsRules } from "../rls";
import { getAuthContextWithPermissions } from "./auth.permissions";

/**
 * Basic authenticated query (no permission check)
 * Use this when you just need to know who the user is
 * RLS is automatically applied to ctx.db
 */
export const authQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContextWithPermissions(ctx);
    const rules = await rlsRules(ctx);
    return {
      auth,
      db: wrapDatabaseReader(ctx, ctx.db, rules),
    };
  }),
);

/**
 * Single permission required for query
 * Use this for most read operations
 * RLS is automatically applied to ctx.db
 *
 * @example
 * export const list = permissionQuery("documents:view")({
 *   args: {},
 *   handler: async (ctx) => {
 *     // Permission already checked, RLS applied to db
 *     return await ctx.db
 *       .query("documents")
 *       .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organizationId))
 *       .take(100);
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

      const rules = await rlsRules(ctx);
      return {
        auth,
        db: wrapDatabaseReader(ctx, ctx.db, rules),
      };
    }),
  );

/**
 * Any of multiple permissions required (OR logic)
 * Use when user needs at least one of several permissions
 * RLS is automatically applied to ctx.db
 *
 * @example
 * export const myQuery = permissionAnyQuery(["documents:edit", "documents:delete"])({
 *   args: {},
 *   handler: async (ctx) => {
 *     // User has at least one of the permissions, RLS applied
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

      const rules = await rlsRules(ctx);
      return {
        auth,
        db: wrapDatabaseReader(ctx, ctx.db, rules),
      };
    }),
  );

/**
 * All permissions required (AND logic)
 * Use when user needs multiple specific permissions
 * RLS is automatically applied to ctx.db
 *
 * @example
 * export const myQuery = permissionAllQuery(["documents:edit", "documents:share"])({
 *   args: {},
 *   handler: async (ctx) => {
 *     // User has all required permissions, RLS applied
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

      const rules = await rlsRules(ctx);
      return {
        auth,
        db: wrapDatabaseReader(ctx, ctx.db, rules),
      };
    }),
  );

/**
 * Admin-only query
 * Requires user to be an admin or owner
 * RLS is automatically applied to ctx.db
 *
 * @example
 * export const dangerousQuery = adminQuery({
 *   args: {},
 *   handler: async (ctx) => {
 *     // Only admins and owners can execute, RLS applied
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

    const rules = await rlsRules(ctx);
    return {
      auth,
      db: wrapDatabaseReader(ctx, ctx.db, rules),
    };
  }),
);

/**
 * Owner-only query
 * Requires user to be an owner
 * RLS is automatically applied to ctx.db
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

    const rules = await rlsRules(ctx);
    return {
      auth,
      db: wrapDatabaseReader(ctx, ctx.db, rules),
    };
  }),
);

// =====================
// MUTATION WRAPPERS
// =====================

/**
 * Basic authenticated mutation (no permission check)
 * RLS is automatically applied to ctx.db
 */
export const authMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const auth = await getAuthContextWithPermissions(ctx);
    const rules = await rlsRules(ctx);
    return {
      auth,
      db: wrapDatabaseWriter(ctx, ctx.db, rules),
    };
  }),
);

/**
 * Single permission required for mutation
 * Use this for most write operations
 * RLS is automatically applied to ctx.db
 *
 * @example
 * export const create = permissionMutation("documents:create")({
 *   args: { title: v.string() },
 *   handler: async (ctx, args) => {
 *     // Permission already checked, RLS applied to db
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

      const rules = await rlsRules(ctx);
      return {
        auth,
        db: wrapDatabaseWriter(ctx, ctx.db, rules),
      };
    }),
  );

/**
 * Any of multiple permissions required (OR logic)
 * RLS is automatically applied to ctx.db
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

      const rules = await rlsRules(ctx);
      return {
        auth,
        db: wrapDatabaseWriter(ctx, ctx.db, rules),
      };
    }),
  );

/**
 * All permissions required (AND logic)
 * RLS is automatically applied to ctx.db
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

      const rules = await rlsRules(ctx);
      return {
        auth,
        db: wrapDatabaseWriter(ctx, ctx.db, rules),
      };
    }),
  );

/**
 * Admin-only mutation
 * Requires user to be an admin or owner
 * RLS is automatically applied to ctx.db
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

    const rules = await rlsRules(ctx);
    return {
      auth,
      db: wrapDatabaseWriter(ctx, ctx.db, rules),
    };
  }),
);

/**
 * Owner-only mutation
 * Requires user to be an owner
 * RLS is automatically applied to ctx.db
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

    const rules = await rlsRules(ctx);
    return {
      auth,
      db: wrapDatabaseWriter(ctx, ctx.db, rules),
    };
  }),
);
