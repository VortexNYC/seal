/**
 * API/MCP auth lookup helpers for the Better-Auth-backed path.
 *
 * ADDITIVE: these internal queries feed the package's API-auth resolver
 * (`resolveLinkedBetterAuthMcpSession` / `resolveVerifiedUserBearerAuthContext`)
 * via the lookup adapter in `api/context.ts`. They resolve a Better-Auth user
 * (linked through the vortexAuth identity component) to a Seal `users._id`,
 * the user's component-sourced memberships, and the selected organization.
 *
 * Mirrors crm's `convex/apiAuth.ts`, adapted to Seal's schema:
 *   - memberships come from `lib/componentOrgReads.resolveComponentMemberships`
 *     (vortexAuth component is the SOLE source of truth)
 *   - role → permissions expansion uses Seal's `ROLE_PERMISSIONS`
 *   - active org bridges `users.activeVortexAuthOrganizationId` → local org id
 */
import {
  buildApiAuthOrganizationAccessResult,
  buildApiAuthUserIdentityResult,
} from "@plasmapos/vortex-auth/convex";
import { v } from "convex/values";

import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, type QueryCtx } from "./_generated/server";
import { ROLE_PERMISSIONS } from "./auth.utils";
import { getBetterAuthIdentityIssuer, getBetterAuthIdentityProvider } from "./lib/authIdentities";
import {
  resolveComponentMemberships,
  type ComponentResolvedMembership,
} from "./lib/componentOrgReads";
import type { OrganizationMemberRole } from "./schema";

/**
 * Membership shape consumed by the package builders. Component-derived
 * memberships are projected onto this shape (role → roleTemplate) before the
 * builders consume them.
 */
type ApiAuthMembershipLike = {
  _id: string;
  organizationId: Id<"organizations">;
  roleTemplate: OrganizationMemberRole;
  status: string;
  permissions?: readonly string[] | null;
};

function componentMembershipToApiAuth(
  membership: ComponentResolvedMembership,
): ApiAuthMembershipLike {
  return {
    _id: membership.vortexAuthMemberId,
    organizationId: membership.organizationId,
    roleTemplate: membership.role,
    status: membership.status,
    // Seal has no per-member permission overrides; null = role-derived only.
    permissions: null,
  };
}

function expandRolePermissions(role: OrganizationMemberRole): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Resolve the user's memberships for API auth from the vortexAuth component
 * (the SOLE source of truth), projected onto the shared membership shape.
 */
async function resolveApiAuthMemberships(
  ctx: Pick<QueryCtx, "db" | "runQuery">,
  args: {
    user: Doc<"users">;
  },
): Promise<ApiAuthMembershipLike[]> {
  const componentMemberships = await resolveComponentMemberships(ctx, args.user);
  return componentMemberships.map(componentMembershipToApiAuth);
}

/**
 * Resolve the user's current active org as a local `Id<"organizations">` from
 * the canonical `users.activeVortexAuthOrganizationId` column.
 */
async function resolveLocalActiveOrgId(
  ctx: Pick<QueryCtx, "db">,
  user: Doc<"users">,
): Promise<Id<"organizations"> | null> {
  if (user.activeVortexAuthOrganizationId === undefined) return null;
  const anchor = await ctx.db
    .query("organizations")
    .withIndex("by_vortex_auth_organization", (q) =>
      q.eq("vortexAuthOrganizationId", user.activeVortexAuthOrganizationId as string),
    )
    .unique();
  return anchor?._id ?? null;
}

type OrganizationAccessResult = {
  organizationId: string | null;
  membershipIds: string[];
  roleKeys: string[];
  permissions: string[];
};

function selectOrganizationId(args: {
  memberships: ReadonlyArray<{
    organizationId: Id<"organizations">;
    status: string;
  }>;
  userActiveOrganizationId: Id<"organizations"> | null;
  requestedOrganizationId: Id<"organizations"> | null;
  organizationHintId: Id<"organizations"> | null;
}): Id<"organizations"> | null {
  const activeMemberships = args.memberships.filter((membership) => membership.status === "active");
  const activeOrganizationIds = new Set(
    activeMemberships.map((membership) => membership.organizationId),
  );

  if (
    args.requestedOrganizationId !== null &&
    activeOrganizationIds.has(args.requestedOrganizationId)
  ) {
    return args.requestedOrganizationId;
  }

  if (args.organizationHintId !== null && activeOrganizationIds.has(args.organizationHintId)) {
    return args.organizationHintId;
  }

  if (
    args.userActiveOrganizationId !== null &&
    activeOrganizationIds.has(args.userActiveOrganizationId)
  ) {
    return args.userActiveOrganizationId;
  }

  return activeMemberships[0]?.organizationId ?? null;
}

export const getUserByIdentityForApiAuth = internalQuery({
  args: {
    provider: v.string(),
    issuer: v.string(),
    subject: v.string(),
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const provider = getBetterAuthIdentityProvider();
    const issuer = getBetterAuthIdentityIssuer();

    if (args.provider !== provider || args.issuer !== issuer) {
      return null;
    }

    const linkedIdentity = await ctx.runQuery(components.vortexAuth.identity.getByTokenIdentifier, {
      tokenIdentifier: args.tokenIdentifier,
    });
    if (linkedIdentity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_vortex_auth_user", (q) => q.eq("vortexAuthUserId", linkedIdentity.userId))
      .first();
    if (user === null) {
      return null;
    }

    const memberships = await resolveApiAuthMemberships(ctx, { user });

    return buildApiAuthUserIdentityResult({
      userId: user._id,
      linkedIdentityId: linkedIdentity.identityId,
      activeOrganizationId: await resolveLocalActiveOrgId(ctx, user),
      memberships,
    });
  },
});

export const getAccessibleOrganizationsForApiAuth = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<{ organizationIds: string[] }> => {
    const user = await ctx.db.get(args.userId as Id<"users">);
    if (user === null) {
      return { organizationIds: [] };
    }

    const memberships = await resolveApiAuthMemberships(ctx, { user });

    return {
      organizationIds: Array.from(
        new Set(
          memberships
            .filter((membership) => membership.status === "active")
            .map((membership) => String(membership.organizationId)),
        ),
      ),
    };
  },
});

/**
 * Resolve a single (user, org) membership's role + permissions for API/MCP
 * authorization, component-primary. Returns `null` when there is no active
 * membership in the org.
 */
export const getOrganizationMembershipAccessForApiAuth = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (
    ctx,
    { userId, organizationId },
  ): Promise<{ role: OrganizationMemberRole; permissions: string[] } | null> => {
    const user = await ctx.db.get(userId);
    if (user === null) {
      return null;
    }

    const memberships = await resolveApiAuthMemberships(ctx, { user });

    const membership = memberships.find(
      (candidate) => candidate.organizationId === organizationId && candidate.status === "active",
    );
    if (membership === undefined) {
      return null;
    }

    const role = membership.roleTemplate;
    const permissions = membership.permissions
      ? [...membership.permissions]
      : expandRolePermissions(role);

    return { role, permissions };
  },
});

export const getOrganizationAccessForApiAuth = internalQuery({
  args: {
    userId: v.string(),
    requestedOrganizationId: v.union(v.string(), v.null()),
    organizationHintId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args): Promise<OrganizationAccessResult> => {
    const user = await ctx.db.get(args.userId as Id<"users">);
    if (user === null) {
      return {
        organizationId: null,
        membershipIds: [],
        roleKeys: [],
        permissions: [],
      };
    }

    const memberships = await resolveApiAuthMemberships(ctx, { user });

    const organizationId = selectOrganizationId({
      memberships,
      userActiveOrganizationId: await resolveLocalActiveOrgId(ctx, user),
      requestedOrganizationId: args.requestedOrganizationId as Id<"organizations"> | null,
      organizationHintId: args.organizationHintId as Id<"organizations"> | null,
    });

    return buildApiAuthOrganizationAccessResult({
      organizationId,
      memberships,
      expandPermissions: (role) => expandRolePermissions(role as OrganizationMemberRole),
    });
  },
});
