/**
 * Component-SOLE org membership/role/invitation reads (vortexAuth
 * component-truth, P2). Adapted from crm's lib/componentOrgReads.ts.
 *
 * These helpers resolve a user's organization memberships, roles, and
 * invitations from the vortexAuth COMPONENT (the source of truth) and map
 * them into the shapes Seal's existing authz code consumes. They use only
 * the component's EXPOSED queries (never internal indexes):
 *   - components.vortexAuth.organizations.listMembershipsByUser
 *   - components.vortexAuth.organizations.listMembersByOrganization
 *   - components.vortexAuth.organizations.getMemberByUserOrganization
 *   - components.vortexAuth.organizations.getMember
 *   - components.vortexAuth.organizations.getRole / getRoleByKey / listRolesByOrganization
 *   - components.vortexAuth.organizations.getInvitationByTokenHash / getInvitationByEmailId / listInvitationsByOrganization
 *
 * Seal differences from crm: role keys are validated against Seal's
 * OrganizationMemberRole (system/owner/admin/member/viewer); API-key
 * readers are omitted (Seal API keys are migrated in P5). Org/user ids are
 * mapped back to Seal anchors via by_vortex_auth_organization / by_vortex_auth_user.
 *
 * P2b lands these additively — no call site uses them yet; the auth hot
 * path + member/invitation list queries are switched to them in later P2
 * sub-steps. Until then there is NO local fallback removed; the local
 * organization_members/_roles/_invitations tables are dropped only in P7.
 */
import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ROLE_PERMISSIONS } from "../auth.utils";
import type { OrganizationMemberRole } from "../schema";

type ReadCtx = Pick<QueryCtx | MutationCtx, "db" | "runQuery">;

/** Seal membership status as represented by authz (the component's three). */
type SealMembershipStatus = "active" | "pending" | "suspended";

// The vortexAuth component exposes its own table ids as opaque STRINGS over
// the query boundary (Seal's @plasmapos/vortex-auth codegen does not brand
// them). Treat every component-side id as a plain string.
type ComponentOrganizationId = string;
type ComponentUserId = string;
type ComponentMemberId = string;
type ComponentRoleId = string;
type ComponentInvitationId = string;

/** Type guard: is a component role `.key` a valid Seal role? */
const SEAL_ROLES = new Set<string>(Object.keys(ROLE_PERMISSIONS));
function isOrganizationMemberRole(key: string): key is OrganizationMemberRole {
  return SEAL_ROLES.has(key);
}

export type ComponentResolvedMembership = {
  organizationId: Id<"organizations">;
  role: OrganizationMemberRole;
  status: SealMembershipStatus;
  vortexAuthMemberId: string;
};

export type ComponentResolvedOrganizationMember = {
  memberId: string;
  userId: Id<"users"> | null;
  role: OrganizationMemberRole;
  status: SealMembershipStatus;
  createdAt: number;
  updatedAt: number;
};

export type ComponentResolvedMemberById = {
  memberId: string;
  organizationId: Id<"organizations"> | null;
  userId: Id<"users"> | null;
  role: OrganizationMemberRole | null;
  status: SealMembershipStatus;
  roleId: ComponentRoleId;
  createdAt: number;
  updatedAt: number;
};

export type ComponentResolvedRole = {
  roleId: string;
  organizationId: Id<"organizations"> | null;
  name: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
};

function mapComponentStatus(status: "active" | "invited" | "suspended"): SealMembershipStatus {
  switch (status) {
    case "active":
      return "active";
    case "invited":
      return "pending";
    case "suspended":
      return "suspended";
  }
}

/**
 * Resolve and map ALL of a user's component memberships into Seal domain
 * shapes. Returns `[]` when the user has no `vortexAuthUserId` bridge.
 */
export async function resolveComponentMemberships(
  ctx: ReadCtx,
  user: Pick<Doc<"users">, "vortexAuthUserId">,
): Promise<ComponentResolvedMembership[]> {
  const vortexAuthUserId = user.vortexAuthUserId;
  if (!vortexAuthUserId) {
    return [];
  }

  const componentMembers = await ctx.runQuery(
    components.vortexAuth.organizations.listMembershipsByUser,
    { userId: vortexAuthUserId as ComponentUserId },
  );

  const resolved: ComponentResolvedMembership[] = [];
  for (const member of componentMembers) {
    const mapped = await mapComponentMembership(ctx, member);
    if (mapped !== null) {
      resolved.push(mapped);
    }
  }
  return resolved;
}

/**
 * Resolve a single component membership for a (user, Seal org) pair. Returns
 * `null` when the user has no bridge id, the org has no component anchor, or no
 * component membership exists.
 */
export async function resolveComponentMembershipForOrganization(
  ctx: ReadCtx,
  user: Pick<Doc<"users">, "vortexAuthUserId">,
  organization: Pick<Doc<"organizations">, "_id" | "vortexAuthOrganizationId">,
): Promise<ComponentResolvedMembership | null> {
  const vortexAuthUserId = user.vortexAuthUserId;
  const vortexAuthOrganizationId = organization.vortexAuthOrganizationId;
  if (!vortexAuthUserId || !vortexAuthOrganizationId) {
    return null;
  }

  const member = await ctx.runQuery(
    components.vortexAuth.organizations.getMemberByUserOrganization,
    {
      userId: vortexAuthUserId as ComponentUserId,
      organizationId: vortexAuthOrganizationId as ComponentOrganizationId,
    },
  );
  if (member === null) {
    return null;
  }
  return await mapComponentMembership(ctx, member, organization._id);
}

/**
 * List the members of a Seal organization from the component. Members whose
 * role key is not a valid Seal role are dropped (never invent access).
 */
export async function listComponentMembersByOrganization(
  ctx: ReadCtx,
  organization: Pick<Doc<"organizations">, "vortexAuthOrganizationId">,
  options?: { status?: "active" | "invited" | "suspended"; limit?: number },
): Promise<ComponentResolvedOrganizationMember[]> {
  const vortexAuthOrganizationId = organization.vortexAuthOrganizationId;
  if (!vortexAuthOrganizationId) {
    return [];
  }

  const members = await ctx.runQuery(
    components.vortexAuth.organizations.listMembersByOrganization,
    {
      organizationId: vortexAuthOrganizationId as ComponentOrganizationId,
      status: options?.status,
      limit: options?.limit,
    },
  );

  const resolved: ComponentResolvedOrganizationMember[] = [];
  for (const member of members) {
    const role = await resolveRole(ctx, member.roleId);
    if (role === null) {
      continue;
    }
    const userId = await resolveSealUserId(ctx, member.userId ?? null);
    resolved.push({
      memberId: String(member._id),
      userId,
      role,
      status: mapComponentStatus(member.status),
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    });
  }
  return resolved;
}

/**
 * Resolve a single component member by its component member id. `role` is
 * `null` when the role key is not a Seal role (callers must treat as "no role").
 */
export async function getComponentMemberById(
  ctx: ReadCtx,
  componentMemberId: string,
): Promise<ComponentResolvedMemberById | null> {
  const member = await ctx.runQuery(components.vortexAuth.organizations.getMember, {
    memberId: componentMemberId as ComponentMemberId,
  });
  if (member === null) {
    return null;
  }
  const organizationId = await resolveSealOrganizationId(ctx, member.organizationId);
  const userId = await resolveSealUserId(ctx, member.userId ?? null);
  const role = await resolveRole(ctx, member.roleId);
  return {
    memberId: String(member._id),
    organizationId,
    userId,
    role,
    status: mapComponentStatus(member.status),
    roleId: member.roleId,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

/**
 * Resolve the component member id + role id for a (user, Seal org) pair. Thin
 * wrapper for writers that need the component member id. Returns `null` when no
 * component membership exists or bridge ids are missing.
 */
export async function getComponentMemberRefForUserOrganization(
  ctx: ReadCtx,
  user: Pick<Doc<"users">, "vortexAuthUserId">,
  organization: Pick<Doc<"organizations">, "vortexAuthOrganizationId">,
): Promise<{ memberId: ComponentMemberId; roleId: ComponentRoleId } | null> {
  const vortexAuthUserId = user.vortexAuthUserId;
  const vortexAuthOrganizationId = organization.vortexAuthOrganizationId;
  if (!vortexAuthUserId || !vortexAuthOrganizationId) {
    return null;
  }
  const member = await ctx.runQuery(
    components.vortexAuth.organizations.getMemberByUserOrganization,
    {
      userId: vortexAuthUserId as ComponentUserId,
      organizationId: vortexAuthOrganizationId as ComponentOrganizationId,
    },
  );
  if (member === null) {
    return null;
  }
  return { memberId: member._id, roleId: member.roleId };
}

/** List the roles of a Seal organization from the component. */
export async function listComponentRolesByOrganization(
  ctx: ReadCtx,
  organization: Pick<Doc<"organizations">, "_id" | "vortexAuthOrganizationId">,
): Promise<ComponentResolvedRole[]> {
  const vortexAuthOrganizationId = organization.vortexAuthOrganizationId;
  if (!vortexAuthOrganizationId) {
    return [];
  }
  const roles = (await ctx.runQuery(components.vortexAuth.organizations.listRolesByOrganization, {
    organizationId: vortexAuthOrganizationId as ComponentOrganizationId,
  })) as Array<{
    _id: ComponentRoleId;
    key: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: number;
    updatedAt: number;
  }>;
  return roles.map((role) => ({
    roleId: String(role._id),
    organizationId: organization._id,
    name: role.key,
    permissions: role.permissions,
    isSystem: role.isSystem,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }));
}

/** Resolve a single component role by its key within a Seal organization. */
export async function getComponentRoleByKey(
  ctx: ReadCtx,
  organization: Pick<Doc<"organizations">, "_id" | "vortexAuthOrganizationId">,
  key: string,
): Promise<ComponentResolvedRole | null> {
  const vortexAuthOrganizationId = organization.vortexAuthOrganizationId;
  if (!vortexAuthOrganizationId) {
    return null;
  }
  const role = await ctx.runQuery(components.vortexAuth.organizations.getRoleByKey, {
    organizationId: vortexAuthOrganizationId as ComponentOrganizationId,
    key,
  });
  if (role === null) {
    return null;
  }
  return {
    roleId: String(role._id),
    organizationId: organization._id,
    name: role.key,
    permissions: role.permissions,
    isSystem: role.isSystem,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Internal mapping helpers
// ---------------------------------------------------------------------------

type ComponentMemberDoc = {
  _id: ComponentMemberId;
  organizationId: ComponentOrganizationId;
  roleId: ComponentRoleId;
  status: "active" | "invited" | "suspended";
};

async function mapComponentMembership(
  ctx: ReadCtx,
  member: ComponentMemberDoc,
  knownSealOrganizationId?: Id<"organizations">,
): Promise<ComponentResolvedMembership | null> {
  const sealOrganizationId =
    knownSealOrganizationId ?? (await resolveSealOrganizationId(ctx, member.organizationId));
  if (sealOrganizationId === null) {
    return null;
  }

  const role = await resolveRole(ctx, member.roleId);
  if (role === null) {
    return null;
  }

  return {
    organizationId: sealOrganizationId,
    role,
    status: mapComponentStatus(member.status),
    vortexAuthMemberId: String(member._id),
  };
}

async function resolveRole(
  ctx: ReadCtx,
  roleId: ComponentRoleId,
): Promise<OrganizationMemberRole | null> {
  const role = await ctx.runQuery(components.vortexAuth.organizations.getRole, { roleId });
  if (role === null || !isOrganizationMemberRole(role.key)) {
    return null;
  }
  return role.key;
}

async function resolveSealOrganizationId(
  ctx: ReadCtx,
  componentOrganizationId: ComponentOrganizationId,
): Promise<Id<"organizations"> | null> {
  const organization = await ctx.db
    .query("organizations")
    .withIndex("by_vortex_auth_organization", (q) =>
      q.eq("vortexAuthOrganizationId", componentOrganizationId),
    )
    .first();
  return organization?._id ?? null;
}

async function resolveSealUserId(
  ctx: ReadCtx,
  componentUserId: ComponentUserId | null,
): Promise<Id<"users"> | null> {
  if (componentUserId === null) {
    return null;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_vortex_auth_user", (q) => q.eq("vortexAuthUserId", componentUserId))
    .first();
  return user?._id ?? null;
}

/** Sorted membership ids (as strings) used for stable comparison/logging. */
export function membershipIdSetKey(ids: readonly string[]): string {
  return [...ids].map(String).sort().join(",");
}

// ---------------------------------------------------------------------------
// Component API key reads (P5 — component is the source of truth for API keys)
// ---------------------------------------------------------------------------

type RawComponentApiKey = {
  _id: string;
  organizationId?: string;
  userId?: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  allowedIpRanges?: string[];
  expiresAt?: number;
  status: "active" | "revoked";
  lastUsedAt?: number;
  lastUsedIp?: string;
  createdAt: number;
  updatedAt: number;
};

export type ComponentResolvedApiKey = {
  _id: string;
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  allowedIpRanges?: string[];
  expiresAt?: number;
  status: "active" | "revoked";
  lastUsedAt?: number;
  lastUsedIp?: string;
  createdAt: number;
  updatedAt: number;
};

async function mapComponentApiKey(
  ctx: ReadCtx,
  apiKey: RawComponentApiKey,
): Promise<ComponentResolvedApiKey | null> {
  if (apiKey.organizationId === undefined || apiKey.userId === undefined) {
    return null;
  }
  const organizationId = await resolveSealOrganizationId(ctx, apiKey.organizationId);
  if (organizationId === null) {
    return null;
  }
  const userId = await resolveSealUserId(ctx, apiKey.userId);
  if (userId === null) {
    return null;
  }
  return {
    _id: apiKey._id,
    organizationId,
    userId,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    keyHash: apiKey.keyHash,
    scopes: apiKey.scopes,
    allowedIpRanges: apiKey.allowedIpRanges,
    expiresAt: apiKey.expiresAt,
    status: apiKey.status,
    lastUsedAt: apiKey.lastUsedAt,
    lastUsedIp: apiKey.lastUsedIp,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt,
  };
}

/** HOT AUTH PATH. Resolve a component apiKey by key prefix, mapped to Seal anchors. */
export async function getComponentApiKeyByPrefix(
  ctx: ReadCtx,
  keyPrefix: string,
): Promise<ComponentResolvedApiKey | null> {
  const apiKey = await ctx.runQuery(components.vortexAuth.apiKeys.getApiKeyByPrefix, { keyPrefix });
  if (apiKey === null) {
    return null;
  }
  return await mapComponentApiKey(ctx, apiKey as RawComponentApiKey);
}

/** List a Seal organization's component apiKeys, mapped to Seal anchors. */
export async function listComponentApiKeysByOrganization(
  ctx: ReadCtx,
  organization: Pick<Doc<"organizations">, "vortexAuthOrganizationId">,
  options?: { status?: "active" | "revoked"; limit?: number },
): Promise<ComponentResolvedApiKey[]> {
  const vortexAuthOrganizationId = organization.vortexAuthOrganizationId;
  if (!vortexAuthOrganizationId) {
    return [];
  }
  const apiKeys = await ctx.runQuery(components.vortexAuth.apiKeys.listApiKeysByOrganization, {
    organizationId: vortexAuthOrganizationId,
    status: options?.status,
    limit: options?.limit,
  });
  const resolved: ComponentResolvedApiKey[] = [];
  for (const apiKey of apiKeys) {
    const mapped = await mapComponentApiKey(ctx, apiKey as RawComponentApiKey);
    if (mapped !== null) {
      resolved.push(mapped);
    }
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Component invitation reads
// ---------------------------------------------------------------------------

export type ComponentResolvedInvitation = {
  _id: string;
  organizationId: Id<"organizations">;
  email: string;
  tokenHash: string;
  role: OrganizationMemberRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  invitedBy: Id<"users">;
  expiresAt: number;
  acceptedByUserId?: Id<"users">;
  acceptedAt?: number;
  emailId?: string;
  emailDeliveryStatus?:
    | "not_configured"
    | "queued"
    | "sent"
    | "delivered"
    | "delivery_delayed"
    | "bounced"
    | "failed";
  createdAt: number;
  updatedAt: number;
};

type RawComponentInvitation = {
  _id: ComponentInvitationId;
  organizationId: ComponentOrganizationId;
  roleId: ComponentRoleId;
  email: string;
  tokenHash: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invitedBy: ComponentUserId;
  expiresAt: number;
  acceptedByUserId?: ComponentUserId;
  acceptedAt?: number;
  emailId?: string;
  emailDeliveryStatus?: ComponentResolvedInvitation["emailDeliveryStatus"];
  createdAt: number;
  updatedAt: number;
};

async function mapComponentInvitation(
  ctx: ReadCtx,
  invitation: RawComponentInvitation,
): Promise<ComponentResolvedInvitation | null> {
  const organizationId = await resolveSealOrganizationId(ctx, invitation.organizationId);
  if (organizationId === null) {
    return null;
  }
  const role = await resolveRole(ctx, invitation.roleId);
  if (role === null) {
    return null;
  }
  const invitedBy = await resolveSealUserId(ctx, invitation.invitedBy);
  if (invitedBy === null) {
    return null;
  }
  const acceptedByUserId =
    invitation.acceptedByUserId === undefined
      ? undefined
      : ((await resolveSealUserId(ctx, invitation.acceptedByUserId)) ?? undefined);

  return {
    _id: String(invitation._id),
    organizationId,
    email: invitation.email,
    tokenHash: invitation.tokenHash,
    role,
    status: invitation.status,
    invitedBy,
    expiresAt: invitation.expiresAt,
    acceptedByUserId,
    acceptedAt: invitation.acceptedAt,
    emailId: invitation.emailId,
    emailDeliveryStatus: invitation.emailDeliveryStatus,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

/**
 * Resolve a component invitation by its token hash (redemption + lookup entry
 * point). Returns `null` when no invitation matches or it cannot be mapped.
 */
export async function getComponentInvitationByTokenHash(
  ctx: ReadCtx,
  tokenHash: string,
): Promise<ComponentResolvedInvitation | null> {
  const invitation = await ctx.runQuery(
    components.vortexAuth.organizations.getInvitationByTokenHash,
    { tokenHash },
  );
  if (invitation === null) {
    return null;
  }
  return await mapComponentInvitation(ctx, invitation as RawComponentInvitation);
}

/**
 * Resolve a component invitation by the Resend email id (email-delivery webhook
 * handler). Returns `null` when no invitation matches or it cannot be mapped.
 */
export async function getComponentInvitationByEmailId(
  ctx: ReadCtx,
  emailId: string,
): Promise<ComponentResolvedInvitation | null> {
  const invitation = await ctx.runQuery(
    components.vortexAuth.organizations.getInvitationByEmailId,
    { emailId },
  );
  if (invitation === null) {
    return null;
  }
  return await mapComponentInvitation(ctx, invitation as RawComponentInvitation);
}

/**
 * List a Seal organization's component invitations (optionally filtered by
 * status). Invitations whose anchors cannot be resolved are dropped.
 */
export async function listComponentInvitationsByOrganization(
  ctx: ReadCtx,
  organization: Pick<Doc<"organizations">, "vortexAuthOrganizationId">,
  status?: "pending" | "accepted" | "revoked" | "expired",
  options?: { limit?: number },
): Promise<ComponentResolvedInvitation[]> {
  const vortexAuthOrganizationId = organization.vortexAuthOrganizationId;
  if (!vortexAuthOrganizationId) {
    return [];
  }
  const invitations = await ctx.runQuery(
    components.vortexAuth.organizations.listInvitationsByOrganization,
    {
      organizationId: vortexAuthOrganizationId as ComponentOrganizationId,
      limit: options?.limit ?? 500,
      status,
    },
  );
  const mapped: ComponentResolvedInvitation[] = [];
  for (const invitation of invitations) {
    const resolved = await mapComponentInvitation(ctx, invitation as RawComponentInvitation);
    if (resolved !== null) {
      mapped.push(resolved);
    }
  }
  return mapped.sort((a, b) => b.createdAt - a.createdAt);
}
