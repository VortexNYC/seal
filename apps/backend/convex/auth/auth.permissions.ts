/**
 * Enhanced authentication context with permission resolution
 * This extends the existing auth.ts with fine-grained permission management
 */

import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getExpandedPermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isValidPermission,
  type PermissionKey,
  type RoleTemplate,
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

function throwPermissionAuthError(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

async function requireAuthenticatedUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throwPermissionAuthError("UNAUTHORIZED", "Authentication required");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
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
  notFoundMessage: string,
): Promise<Doc<"organization_members">> {
  const membership = await ctx.db
    .query("organization_members")
    .withIndex("by_user_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();

  if (!membership) {
    throwPermissionAuthError("FORBIDDEN", notFoundMessage);
  }

  return membership;
}

async function getOrganizationOrThrow(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<Doc<"organizations">> {
  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    throwPermissionAuthError("NOT_FOUND", "Organization not found");
  }
  return organization;
}

function buildSuperAdminContext(
  user: Doc<"users">,
  member: Doc<"organization_members">,
  organization: Doc<"organizations">,
  organizationId: Id<"organizations">,
): AuthContextWithPermissions {
  return {
    userId: user._id,
    organizationId,
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

async function buildActiveMembershipContext(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<{
  membership: Doc<"organization_members">;
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
    "Not a member of active organization",
  );

  if (membership.status !== "active") {
    throwPermissionAuthError("FORBIDDEN", `Membership is ${membership.status}`);
  }

  const organization = await getOrganizationOrThrow(ctx, organizationId);
  const organizationStatus = organization.status ?? "active";
  if (organizationStatus !== "active") {
    throwPermissionAuthError("FORBIDDEN", `Organization is ${organizationStatus}`);
  }

  return { membership, organization, organizationId };
}

function isPermissionKey(permission: string): permission is PermissionKey {
  return isValidPermission(permission);
}

async function resolvePermissions(
  ctx: QueryCtx | MutationCtx,
  membership: Doc<"organization_members">,
): Promise<PermissionKey[]> {
  let permissions: PermissionKey[] = getExpandedPermissions(membership.role as RoleTemplate);

  if (membership.roleId) {
    const role = await ctx.db.get(membership.roleId);
    permissions = role
      ? role.permissions.filter(isPermissionKey)
      : getExpandedPermissions(membership.role as RoleTemplate);
  }

  if (membership.permissionOverrides?.add) {
    permissions = [...permissions, ...membership.permissionOverrides.add.filter(isPermissionKey)];
  }
  if (membership.permissionOverrides?.remove) {
    const removeSet = new Set(membership.permissionOverrides.remove.filter(isPermissionKey));
    permissions = permissions.filter((permission) => !removeSet.has(permission));
  }

  return Array.from(new Set(permissions)).sort();
}

function buildPermissionContext(
  user: Doc<"users">,
  membership: Doc<"organization_members">,
  organization: Doc<"organizations">,
  organizationId: Id<"organizations">,
  permissions: string[],
): AuthContextWithPermissions {
  const isOwner = membership.role === "owner";
  const isAdmin = ["owner", "admin"].includes(membership.role);

  return {
    userId: user._id,
    organizationId,
    email: user.email,
    name: user.name,
    role: membership.role,
    permissions,
    isOwner,
    isAdmin,
    hasPermission: (permission: string) => hasPermission(permissions, permission),
    hasAnyPermission: (perms: string[]) => hasAnyPermission(permissions, perms),
    hasAllPermissions: (perms: string[]) => hasAllPermissions(permissions, perms),
    user,
    member: membership,
    organization,
  };
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
  const user = await requireAuthenticatedUser(ctx);

  if (user.isSuperAdmin) {
    if (!user.activeOrganizationId) {
      throwPermissionAuthError("FORBIDDEN", "Super admin must have an active organization");
    }

    const organizationId = user.activeOrganizationId;
    const organization = await getOrganizationOrThrow(ctx, organizationId);
    const member = await getMembershipOrThrow(
      ctx,
      user._id,
      organizationId,
      "No membership found for super admin",
    );

    if (member.status !== "active") {
      throwPermissionAuthError("FORBIDDEN", `Membership is ${member.status}`);
    }

    return buildSuperAdminContext(user, member, organization, organizationId);
  }

  const { membership, organization, organizationId } = await buildActiveMembershipContext(
    ctx,
    user,
  );
  const permissions = await resolvePermissions(ctx, membership);

  return buildPermissionContext(user, membership, organization, organizationId, permissions);
}
