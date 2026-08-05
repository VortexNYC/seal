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
 * Unified auth context — Stack A fields (docs/orgs) + Stack B fields (RLS/AI).
 * `isAdmin` / `isOwner` are callables (Stack A call sites use `isAdmin()`).
 * RLS reads them via `isAdmin()` / `isOwner()`.
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

  user: Doc<"users">;
  member: AuthMember;
  organization: Doc<"organizations">;
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
  userId: Id<"users">,
  organizationId: Id<"organizations">,
  notFoundMessage: string
): Promise<AuthMember> {
  const user = await ctx.db.get(userId);
  if (!user) {
    throwPermissionAuthError("UNAUTHORIZED", "User not found");
  }
  const organization = await getOrganizationOrThrow(ctx, organizationId);
  const componentMembership = await resolveComponentMembershipForOrganization(
    ctx,
    user,
    organization
  );

  if (!componentMembership) {
    throwPermissionAuthError("FORBIDDEN", notFoundMessage);
  }

  return {
    userId,
    organizationId,
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
  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    throwPermissionAuthError("NOT_FOUND", "Organization not found");
  }
  return organization;
}

async function getActiveSubscription(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
): Promise<Doc<"subscriptions"> | undefined> {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active")
    )
    .order("desc")
    .first();

  return subscription ?? undefined;
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

async function buildActiveMembershipContext(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">
): Promise<{
  membership: AuthMember;
  organization: Doc<"organizations">;
  organizationId: Id<"organizations">;
}> {
  if (!user.activeOrganizationId) {
    throwPermissionAuthError("FORBIDDEN", "No active organization");
  }

  const organizationId = user.activeOrganizationId;
  const membership = await getMembershipOrThrow(
    ctx,
    user._id,
    organizationId,
    "Not a member of active organization"
  );

  if (membership.status !== "active") {
    throwPermissionAuthError("FORBIDDEN", `Membership is ${membership.status}`);
  }

  const organization = await getOrganizationOrThrow(ctx, organizationId);
  const organizationStatus = organization.status ?? "active";
  if (organizationStatus !== "active") {
    throwPermissionAuthError(
      "FORBIDDEN",
      `Organization is ${organizationStatus}`
    );
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
    if (!user.activeOrganizationId) {
      throwPermissionAuthError(
        "FORBIDDEN",
        "Super admin must have an active organization"
      );
    }

    const organizationId = user.activeOrganizationId;
    const organization = await getOrganizationOrThrow(ctx, organizationId);
    const member = await getMembershipOrThrow(
      ctx,
      user._id,
      organizationId,
      "No membership found for super admin"
    );
    const subscription = await getActiveSubscription(ctx, organizationId);

    return buildSuperAdminContext(
      user,
      member,
      organization,
      organizationId,
      subscription
    );
  }

  const { membership, organization, organizationId } =
    await buildActiveMembershipContext(ctx, user);
  const permissions = await resolvePermissions(ctx, membership, organization);
  const subscription = await getActiveSubscription(ctx, organizationId);

  return buildPermissionContext(
    user,
    membership,
    organization,
    organizationId,
    permissions,
    subscription
  );
}

/** Alias — one auth context function for the whole backend. */
export const getAuthContext = getAuthContextWithPermissions;
