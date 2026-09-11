/**
 * Unified authentication context for Seal.
 *
 * Single resolution path used by RLS wrappers (`auth/wrappers.ts`) and the
 * legacy `auth.ts` barrel. Permissions come from `auth/permissions.ts`
 * ROLE_TEMPLATES (+ component custom roles). User identity prefers the
 * canonical glue 2-hop lookup (component identity → local users row).
 */

import { ConvexError } from "convex/values";

import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { AuthUtils, type AuthMember } from "../auth.utils";
import { resolveComponentMembershipForOrganization } from "../lib/componentOrgReads";
import { findCurrentUserRow } from "../lib/identity";
import { resolveActiveOrganizationId } from "../lib/resolveActiveOrganization";
import { enforceActiveOrgSecurityPolicy } from "../lib/suiteOrgPolicy";
import type { OrganizationRole, UserType } from "../schema";
import {
  getExpandedPermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isPermissionKey,
  isRoleTemplate,
  type PermissionKey,
} from "./permissions";

function sortedPermissionKeys(
  permissions: Iterable<PermissionKey>
): PermissionKey[] {
  const result: PermissionKey[] = [];
  for (const key of permissions) {
    let insertAt = result.length;
    for (let index = 0; index < result.length; index += 1) {
      const existing = result[index];
      if (existing !== undefined && key < existing) {
        insertAt = index;
        break;
      }
    }
    result.splice(insertAt, 0, key);
  }
  return result;
}

/**
 * User subset carried in the auth context. Fields are sourced from Vortex Auth;
 * the `_id` is the Seal local bridge id.
 */
export type AuthUser = Pick<
  Doc<"users">,
  "_id" | "vortexAuthUserId" | "activeOrganizationId"
>;

/**
 * Organization subset carried in the auth context. Fields are sourced from
 * Vortex Auth; the `_id` is the Seal local bridge id.
 */
export type AuthOrganization = Pick<
  Doc<"organizations">,
  "_id" | "vortexAuthOrganizationId" | "status"
>;

/**
 * Unified auth context — Stack A fields (docs/orgs) + Stack B fields (RLS/AI).
 * `isAdmin` / `isOwner` are callables (Stack A call sites use `isAdmin()`).
 * RLS reads them via `isAdmin()` / `isOwner()`.
 *
 * `user` and `organization` are intentionally narrow; they represent the
 * Vortex Auth identity + the Seal bridge id, not the full local documents.
 */
export interface AuthContextWithPermissions {
  userId: Id<"users">;
  organizationId: Id<"organizations">;
  email?: string;
  name?: string;
  role: string;
  permissions: string[];
  isOwner: () => boolean;
  isAdmin: () => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: OrganizationRole) => boolean;
  canAccessOrganization: (orgId: Id<"organizations">) => boolean;
  isPersonalUser: () => boolean;
  isBusinessUser: () => boolean;
  canManageFinances: () => boolean;
  canManageSubscription: () => boolean;
  canManageMembers: () => boolean;

  user: AuthUser;
  member: AuthMember;
  organization: AuthOrganization;
  subscription?: Doc<"subscriptions">;
  userType: UserType;
}

/** @deprecated Prefer AuthContextWithPermissions — alias for migration. */
export type AuthContext = AuthContextWithPermissions;

function throwPermissionAuthError(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

async function requireAuthenticatedUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  // Prefer glue 2-hop (component identity → local user). Fall back to
  // authSubject index for rows not yet backfilled onto vortexAuthUserId.
  const glueUser = await findCurrentUserRow(ctx);
  if (glueUser !== null) {
    return glueUser;
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throwPermissionAuthError("UNAUTHORIZED", "Authentication required");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
    .first();

  if (!user) {
    throwPermissionAuthError("UNAUTHORIZED", "User not found");
  }

  return user;
}

async function getMembershipOrThrow(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  organization: Doc<"organizations">,
  notFoundMessage: string
): Promise<AuthMember> {
  const componentMembership = await resolveComponentMembershipForOrganization(
    ctx,
    user,
    organization
  );

  if (!componentMembership) {
    throwPermissionAuthError("FORBIDDEN", notFoundMessage);
  }

  return {
    userId: user._id,
    organizationId: organization._id,
    role: componentMembership.role,
    status: componentMembership.status,
    permissions: [],
    roleId: componentMembership.roleId,
  };
}

async function getOrganizationOrThrow(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<Doc<"organizations">> {
  const organization = await ctx.db.get("organizations", organizationId);
  if (!organization) {
    throwPermissionAuthError("NOT_FOUND", "Organization not found");
  }

  if (organization.vortexAuthOrganizationId !== undefined) {
    const componentOrg = await ctx.runQuery(
      components.vortexAuth.organizations.getOrganization,
      { organizationId: organization.vortexAuthOrganizationId }
    );
    if (componentOrg === null) {
      throwPermissionAuthError("NOT_FOUND", "Organization not found");
    }
    if (componentOrg.status !== "active") {
      throwPermissionAuthError(
        "FORBIDDEN",
        `Organization is ${componentOrg.status}`
      );
    }
  }

  const organizationStatus = organization.status ?? "active";
  if (organizationStatus !== "active") {
    throwPermissionAuthError(
      "FORBIDDEN",
      `Organization is ${organizationStatus}`
    );
  }

  return organization;
}

function buildSuperAdminContext(
  user: Doc<"users">,
  member: AuthMember,
  organization: Doc<"organizations">,
  organizationId: Id<"organizations">,
  subscription?: Doc<"subscriptions">
): AuthContextWithPermissions {
  return {
    userId: user._id,
    organizationId,
    email: user.email,
    name: user.name,
    role: "super_admin",
    permissions: ["*"],
    isOwner: () => true,
    isAdmin: () => true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    hasRole: () => true,
    canAccessOrganization: (orgId) =>
      AuthUtils.canAccessOrganization(member, orgId),
    isPersonalUser: () => true,
    isBusinessUser: () => false,
    canManageFinances: () => true,
    canManageSubscription: () => true,
    canManageMembers: () => true,
    user,
    member,
    organization,
    subscription,
    userType: "personal",
  };
}

async function loadBetterAuthSessionCreatedAt(
  ctx: QueryCtx | MutationCtx,
  identity: { subject: string; [claim: string]: unknown }
): Promise<number | null> {
  const sessionIdClaim = identity.sessionId;
  const sessionId =
    typeof sessionIdClaim === "string" && sessionIdClaim.length > 0
      ? sessionIdClaim
      : null;
  if (sessionId === null) {
    return null;
  }

  const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "session",
    where: [
      { field: "_id", value: sessionId },
      { field: "userId", value: identity.subject },
    ],
  });
  if (!session || typeof session !== "object" || !("createdAt" in session)) {
    return null;
  }
  const createdAt = session.createdAt;
  if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
    return createdAt;
  }
  return null;
}

async function enforceSuiteOrgSecurityForActiveOrg(
  ctx: QueryCtx | MutationCtx,
  organization: Doc<"organizations">
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throwPermissionAuthError("UNAUTHORIZED", "Authentication required");
  }
  try {
    // Pass sessionCreatedAt only after policy check inside enforce — when
    // no suite security policy is set, Better Auth is never queried.
    await enforceActiveOrgSecurityPolicy(ctx, {
      organization,
      betterAuthUserId: identity.subject,
      sessionCreatedAt: async () =>
        await loadBetterAuthSessionCreatedAt(ctx, identity),
    });
  } catch (error) {
    if (error instanceof ConvexError) {
      const data = error.data;
      if (isRecord(data) && typeof data.message === "string") {
        throwPermissionAuthError(
          typeof data.code === "string" ? data.code : "FORBIDDEN",
          data.message
        );
      }
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function buildActiveMembershipContext(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">
): Promise<{
  membership: AuthMember;
  organization: Doc<"organizations">;
  organizationId: Id<"organizations">;
}> {
  const organizationId = await resolveActiveOrganizationId(ctx, user);
  if (organizationId === null) {
    throwPermissionAuthError("FORBIDDEN", "No active organization");
  }

  const organization = await getOrganizationOrThrow(ctx, organizationId);

  const membership = await getMembershipOrThrow(
    ctx,
    user,
    organization,
    "Not a member of active organization"
  );

  if (membership.status !== "active") {
    throwPermissionAuthError("FORBIDDEN", `Membership is ${membership.status}`);
  }

  return { membership, organization, organizationId };
}

function resolveRoleTemplate(role: string): PermissionKey[] {
  if (isRoleTemplate(role)) {
    return getExpandedPermissions(role);
  }
  return getExpandedPermissions("member");
}

async function resolvePermissions(
  ctx: QueryCtx | MutationCtx,
  membership: AuthMember,
  organization: Doc<"organizations">
): Promise<PermissionKey[]> {
  let permissions: PermissionKey[] = resolveRoleTemplate(membership.role);

  if (membership.roleId && organization.vortexAuthOrganizationId) {
    const role = await ctx.runQuery(
      components.vortexAuth.organizations.getRole,
      {
        roleId: membership.roleId,
        organizationId: organization.vortexAuthOrganizationId,
      }
    );
    permissions = role
      ? role.permissions.filter(isPermissionKey)
      : resolveRoleTemplate(membership.role);
  }

  if (membership.permissionOverrides?.add) {
    permissions = [
      ...permissions,
      ...membership.permissionOverrides.add.filter(isPermissionKey),
    ];
  }
  if (membership.permissionOverrides?.remove) {
    const removeSet = new Set(
      membership.permissionOverrides.remove.filter(isPermissionKey)
    );
    permissions = permissions.filter(
      (permission) => !removeSet.has(permission)
    );
  }

  return sortedPermissionKeys(new Set(permissions));
}

function buildPermissionContext(
  user: Doc<"users">,
  membership: AuthMember,
  organization: Doc<"organizations">,
  organizationId: Id<"organizations">,
  permissions: string[],
  subscription?: Doc<"subscriptions">
): AuthContextWithPermissions {
  return {
    userId: user._id,
    organizationId,
    email: user.email,
    name: user.name,
    role: membership.role,
    permissions,
    isOwner: () => membership.role === "owner",
    isAdmin: () => ["owner", "admin"].includes(membership.role),
    hasPermission: (permission: string) =>
      hasPermission(permissions, permission),
    hasAnyPermission: (perms: string[]) => hasAnyPermission(permissions, perms),
    hasAllPermissions: (perms: string[]) =>
      hasAllPermissions(permissions, perms),
    hasRole: (role) => AuthUtils.hasRole(membership, role),
    canAccessOrganization: (orgId) =>
      AuthUtils.canAccessOrganization(membership, orgId),
    isPersonalUser: () => true,
    isBusinessUser: () => false,
    canManageFinances: () => AuthUtils.canManageSubscription(membership),
    canManageSubscription: () => AuthUtils.canManageSubscription(membership),
    canManageMembers: () => AuthUtils.canManageMembers(membership),
    user,
    member: membership,
    organization,
    subscription,
    userType: "personal",
  };
}

/**
 * Get unified auth context with resolved permissions + subscription.
 */
export async function getAuthContextWithPermissions(
  ctx: QueryCtx | MutationCtx
): Promise<AuthContextWithPermissions> {
  const user = await requireAuthenticatedUser(ctx);

  if (user.isSuperAdmin) {
    const organizationId = await resolveActiveOrganizationId(ctx, user);
    if (organizationId === null) {
      throwPermissionAuthError(
        "FORBIDDEN",
        "Super admin must have an active organization"
      );
    }

    const organization = await getOrganizationOrThrow(ctx, organizationId);
    const member = await getMembershipOrThrow(
      ctx,
      user,
      organization,
      "No membership found for super admin"
    );

    await enforceSuiteOrgSecurityForActiveOrg(ctx, organization);

    return buildSuperAdminContext(
      user,
      member,
      organization,
      organizationId,
      undefined
    );
  }

  const { membership, organization, organizationId } =
    await buildActiveMembershipContext(ctx, user);
  const permissions = await resolvePermissions(ctx, membership, organization);

  await enforceSuiteOrgSecurityForActiveOrg(ctx, organization);

  return buildPermissionContext(
    user,
    membership,
    organization,
    organizationId,
    permissions,
    undefined
  );
}

/** Alias — one auth context function for the whole backend. */
export const getAuthContext = getAuthContextWithPermissions;
