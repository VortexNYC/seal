import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { AuthUtils, type AuthMember } from "./auth.utils";
import { resolveComponentMembershipForOrganization } from "./lib/componentOrgReads";
import type { OrganizationMemberRole, OrganizationRole, UserType } from "./schema";

export type AuthContext = {
  member: AuthMember;
  user: Doc<"users">;
  organization: Doc<"organizations">;
  subscription?: Doc<"subscriptions">; // Active subscription (if any)

  // User type information
  userType: UserType;

  // Utility methods
  hasPermission: (permission: string) => boolean;
  hasRole: (role: OrganizationRole) => boolean;
  canAccessOrganization: (orgId: Id<"organizations">) => boolean;

  // Type-specific helpers
  isPersonalUser: () => boolean;
  isBusinessUser: () => boolean;
  isOwner: () => boolean;
  isAdmin: () => boolean;

  // Financial-specific helpers
  canManageFinances: () => boolean;
  canManageSubscription: () => boolean;
  canManageMembers: () => boolean;
};

/**
 * Authentication error types
 */
export const AuthErrorType = {
  NO_IDENTITY: "NO_IDENTITY",
  NO_USER_RECORD: "NO_USER_RECORD",
  NO_MEMBER_RECORD: "NO_MEMBER_RECORD",
  NO_ORGANIZATION: "NO_ORGANIZATION",
  NO_SUBSCRIPTION: "NO_SUBSCRIPTION",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  INSUFFICIENT_ROLE: "INSUFFICIENT_ROLE",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ACCOUNT_PENDING: "ACCOUNT_PENDING",
  ACCOUNT_BLOCKED: "ACCOUNT_BLOCKED",
  WRONG_ORGANIZATION: "WRONG_ORGANIZATION",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
};

/**
 * Authentication error class for consistent error handling
 */
export class AuthError extends Error {
  type: keyof typeof AuthErrorType;
  metadata?: Record<string, unknown>;

  constructor(
    type: keyof typeof AuthErrorType,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AuthError";
    this.type = type;
    this.metadata = metadata;
  }
}

/**
 * Helper function to create authentication errors
 */
export function createAuthError(
  type: keyof typeof AuthErrorType,
  message?: string,
  metadata?: Record<string, unknown>,
): AuthError {
  const defaultMessages: Record<keyof typeof AuthErrorType, string> = {
    NO_IDENTITY: "User identity not found",
    NO_USER_RECORD: "User record not found",
    NO_MEMBER_RECORD: "Member record not found",
    NO_ORGANIZATION: "Organization not found",
    NO_SUBSCRIPTION: "Subscription not found",
    INSUFFICIENT_PERMISSIONS: "Insufficient permissions",
    INSUFFICIENT_ROLE: "Insufficient role level",
    ACCOUNT_INACTIVE: "Account is inactive",
    ACCOUNT_SUSPENDED: "Account is suspended",
    ACCOUNT_PENDING: "Account is pending approval",
    ACCOUNT_BLOCKED: "Account is blocked",
    WRONG_ORGANIZATION: "Cannot access resources from different organization",
    SUBSCRIPTION_EXPIRED: "Subscription has expired",
    SUBSCRIPTION_REQUIRED: "Active subscription required",
  };

  return new AuthError(type, message || defaultMessages[type], metadata);
}

function throwAuthError(
  type: keyof typeof AuthErrorType,
  message?: string,
  metadata?: Record<string, unknown>,
): never {
  throw new ConvexError(createAuthError(type, message, metadata).message);
}

async function requireAuthenticatedUser(
  ctx: QueryCtx | MutationCtx,
): Promise<{ user: Doc<"users"> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throwAuthError("NO_IDENTITY");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
    .first();

  if (!user) {
    throwAuthError("NO_USER_RECORD", "User record not found. Please try refreshing the page.", {
      authSubject: identity.subject,
    });
  }

  return { user };
}

function requireActiveOrganizationId(user: Doc<"users">): Id<"organizations"> {
  if (!user.activeOrganizationId) {
    throwAuthError(
      "NO_ORGANIZATION",
      "Organization setup required. This will be handled automatically - please try again.",
      {
        userId: user._id,
        hint: "CALL_ENSURE_MEMBERSHIP",
      },
    );
  }

  return user.activeOrganizationId as Id<"organizations">;
}

async function getOrganizationOrThrow(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  organizationId: Id<"organizations">,
): Promise<Doc<"organizations">> {
  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    throwAuthError("NO_ORGANIZATION", undefined, {
      userId: user._id,
      organizationId,
    });
  }
  return organization;
}

/**
 * Synthesize an `organization_members` doc from a component membership for the
 * post-teardown (P7) path where the local row no longer exists. AuthUtils reads
 * only role/status/permissions/organizationId, so the synthetic id/timestamps
 * are inert. Not reached during the transition (local rows still exist).
 */
function synthesizeMemberFromComponent(
  user: Doc<"users">,
  organization: Doc<"organizations">,
  membership: {
    role: OrganizationMemberRole;
    status: "active" | "pending" | "suspended";
    roleId: string;
  },
): AuthMember {
  return {
    userId: user._id,
    organizationId: organization._id,
    role: membership.role,
    status: membership.status,
    permissions: [],
    roleId: membership.roleId,
  };
}

/**
 * Resolve the active-org membership from the vortexAuth component only.
 * Local organization_members rows are no longer a fallback because component
 * truth must fail loud when a consumer is not anchored.
 */
async function resolveOrganizationMemberFromComponent(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  organization: Doc<"organizations">,
): Promise<AuthMember> {
  const componentMembership = await resolveComponentMembershipForOrganization(
    ctx,
    user,
    organization,
  );

  if (componentMembership !== null) {
    return synthesizeMemberFromComponent(user, organization, componentMembership);
  }

  throwAuthError("NO_MEMBER_RECORD", undefined, {
    userId: user._id,
    organizationId: organization._id,
    source: "vortexAuthComponent",
  });
}

function validateMemberStatus(user: Doc<"users">, member: AuthMember): void {
  if (!AuthUtils.isAccountValid(member)) {
    throwAuthError(getStatusErrorType(member.status), undefined, {
      userId: user._id,
      status: member.status,
    });
  }
}

async function getActiveSubscription(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<Doc<"subscriptions"> | undefined> {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active"),
    )
    .order("desc")
    .first();

  return subscription ?? undefined;
}

function buildAuthContext(
  member: AuthMember,
  user: Doc<"users">,
  organization: Doc<"organizations">,
  subscription?: Doc<"subscriptions">,
): AuthContext {
  return {
    member,
    user,
    organization,
    subscription,
    userType: "personal" as UserType,
    hasPermission: (permission) => AuthUtils.hasPermission(member, permission),
    hasRole: (role) => AuthUtils.hasRole(member, role),
    canAccessOrganization: (orgId) => AuthUtils.canAccessOrganization(member, orgId),
    isPersonalUser: () => true,
    isBusinessUser: () => false,
    isOwner: () => AuthUtils.isOwner(member),
    isAdmin: () => AuthUtils.isAdmin(member),
    canManageFinances: () => AuthUtils.canManageSubscription(member),
    canManageSubscription: () => AuthUtils.canManageSubscription(member),
    canManageMembers: () => AuthUtils.canManageMembers(member),
  };
}

/**
 * Get authenticated user context from Convex with optimized queries
 */
export async function getAuthContext(ctx: QueryCtx | MutationCtx): Promise<AuthContext> {
  const { user } = await requireAuthenticatedUser(ctx);
  const organizationId = requireActiveOrganizationId(user);
  // Org resolved first: the dual-read membership resolver needs the org's
  // vortexAuthOrganizationId anchor to query the component.
  const organization = await getOrganizationOrThrow(ctx, user, organizationId);
  const member = await resolveOrganizationMemberFromComponent(ctx, user, organization);

  validateMemberStatus(user, member);

  const subscription = await getActiveSubscription(ctx, organizationId);
  return buildAuthContext(member, user, organization, subscription);
}

/**
 * Map user status to error type
 */
function getStatusErrorType(status: string): keyof typeof AuthErrorType {
  switch (status) {
    case "inactive":
      return "ACCOUNT_INACTIVE";
    case "suspended":
      return "ACCOUNT_SUSPENDED";
    case "pending":
      return "ACCOUNT_PENDING";
    case "blocked":
      return "ACCOUNT_BLOCKED";
    default:
      return "ACCOUNT_INACTIVE";
  }
}

/**
 * Basic authenticated query
 */
export const authQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);
    return { auth };
  }),
);

export type AuthQueryCtx = Awaited<ReturnType<typeof authQuery>>;

/**
 * Basic authenticated mutation
 *
 * Automatically calls ensureMyMembership if user has no organization
 */
export const authMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);
    return { auth };
  }),
);

export type AuthMutationCtx = Awaited<ReturnType<typeof authMutation>>;

export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);

    if (!auth.hasRole("admin")) {
      throw new ConvexError(
        createAuthError("INSUFFICIENT_ROLE", undefined, {
          userId: auth.user._id,
          userRole: auth.member.role,
          requiredRole: "admin",
        }).message,
      );
    }

    return {
      auth,
      db: ctx.db,
      runQuery: ctx.runQuery,
    };
  }),
);

export type AdminQueryCtx = Awaited<ReturnType<typeof adminQuery>>;

export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);

    if (!auth.hasRole("admin")) {
      throw new ConvexError(
        createAuthError("INSUFFICIENT_ROLE", undefined, {
          userId: auth.user._id,
          userRole: auth.member.role,
          requiredRole: "admin",
        }).message,
      );
    }

    return {
      auth,
      db: ctx.db,
      runQuery: ctx.runQuery,
      runMutation: ctx.runMutation,
    };
  }),
);

export type AdminMutationCtx = Awaited<ReturnType<typeof adminMutation>>;

/**
 * Member-level authenticated query
 * Requires at least "member" role (member, admin, or owner)
 */
export const memberQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);

    if (!auth.hasRole("member")) {
      throw new ConvexError(
        createAuthError("INSUFFICIENT_ROLE", undefined, {
          userId: auth.user._id,
          userRole: auth.member.role,
          requiredRole: "member",
        }).message,
      );
    }

    return {
      auth,
      db: ctx.db,
      runQuery: ctx.runQuery,
    };
  }),
);

export type MemberQueryCtx = Awaited<ReturnType<typeof memberQuery>>;

/**
 * Member-level authenticated mutation
 * Requires at least "member" role (member, admin, or owner)
 */
export const memberMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);

    if (!auth.hasRole("member")) {
      throw new ConvexError(
        createAuthError("INSUFFICIENT_ROLE", undefined, {
          userId: auth.user._id,
          userRole: auth.member.role,
          requiredRole: "member",
        }).message,
      );
    }

    return {
      auth,
      db: ctx.db,
      runQuery: ctx.runQuery,
      runMutation: ctx.runMutation,
    };
  }),
);

export type MemberMutationCtx = Awaited<ReturnType<typeof memberMutation>>;

/**
 * Permission-based mutation wrapper
 * Requires a specific permission to execute
 *
 * @param requiredPermission - The permission to check for
 * @returns A custom mutation that checks the permission before executing
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
      const auth = await getAuthContext(ctx);

      if (!auth.hasPermission(requiredPermission)) {
        throw new ConvexError(
          createAuthError("INSUFFICIENT_PERMISSIONS", undefined, {
            userId: auth.user._id,
            requiredPermission,
          }).message,
        );
      }

      return { auth };
    }),
  );

export type PermissionMutationCtx = Awaited<ReturnType<ReturnType<typeof permissionMutation>>>;

/**
 * Permission-based query wrapper
 * Requires a specific permission to execute
 *
 * @param requiredPermission - The permission to check for
 * @returns A custom query that checks the permission before executing
 */
export const permissionQuery = (requiredPermission: string) =>
  customQuery(
    query,
    customCtx(async (ctx) => {
      const auth = await getAuthContext(ctx);

      if (!auth.hasPermission(requiredPermission)) {
        throw new ConvexError(
          createAuthError("INSUFFICIENT_PERMISSIONS", undefined, {
            userId: auth.user._id,
            requiredPermission,
          }).message,
        );
      }

      return { auth };
    }),
  );

export type PermissionQueryCtx = Awaited<ReturnType<ReturnType<typeof permissionQuery>>>;
