/**
 * Component write-helpers for Seal's vortex-auth migration (P2).
 *
 * These are the SOLE writers for org / role / member / invitation truth
 * once Seal routes through the vortexAuth component (mirrors crm's
 * lib/vortexAuthOrganizations.ts). P2a lands them additively — no call
 * site uses them yet; the org-creation / invitation paths are switched
 * to them in later P2 sub-steps.
 *
 * Seal differences from the crm blueprint:
 *  - Role catalog comes from Seal's ROLE_PERMISSIONS (system/owner/admin/
 *    member/viewer), keyed by OrganizationMemberRole.
 *  - Org anchor uses Seal columns (logo, status, type) — no crm `plan`/
 *    `imageUrl`.
 */

import { ConvexError, type GenericId } from "convex/values";

import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ROLE_PERMISSIONS } from "../auth.utils";
import type { OrganizationMemberRole } from "../schema";

type VortexAuthMutationCtx = Pick<MutationCtx, "db" | "runMutation">;

export async function ensureVortexAuthOrganization(
  ctx: VortexAuthMutationCtx,
  organizationId: Id<"organizations">,
  createdByVortexAuthUserId?: string,
) {
  const organization = await ctx.db.get(organizationId);
  if (organization === null) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
  }

  const result = await ctx.runMutation(components.vortexAuth.organizations.upsertOrganization, {
    organizationId: organization.vortexAuthOrganizationId,
    name: organization.name,
    slug: organization.slug,
    imageUrl: organization.logo ?? null,
    status: organization.status ?? "active",
    createdBy: createdByVortexAuthUserId,
    metadataJson: JSON.stringify({ type: organization.type }),
  });

  if (organization.vortexAuthOrganizationId !== result.organizationId) {
    await ctx.db.patch(organization._id, {
      vortexAuthOrganizationId: result.organizationId,
      updatedAt: Date.now(),
    });
  }

  return result.organizationId;
}

/** Component member status enum (mirrors the component schema). */
type ComponentMemberStatus = "active" | "invited" | "suspended";

/**
 * Ensure ALL Seal system roles exist in the component for an organization.
 * Idempotent: seeds the component with Seal's ROLE_PERMISSIONS catalog. The
 * local org row is anchored first so the component org id is resolvable.
 */
export async function ensureVortexAuthSystemRoles(
  ctx: VortexAuthMutationCtx,
  organizationId: Id<"organizations">,
  createdByVortexAuthUserId?: string,
) {
  const vortexAuthOrganizationId = await ensureVortexAuthOrganization(
    ctx,
    organizationId,
    createdByVortexAuthUserId,
  );
  await ctx.runMutation(components.vortexAuth.organizations.seedDefaultRoles, {
    organizationId: vortexAuthOrganizationId,
    catalog: Object.entries(ROLE_PERMISSIONS).map(([name, permissions]) => ({
      key: name,
      name,
      permissions: [...permissions],
      isSystem: true,
    })),
  });
  return vortexAuthOrganizationId;
}

/**
 * Ensure a single component role exists for `(organizationId, role)`, keeping
 * its permission set in sync with Seal's ROLE_PERMISSIONS definition. The local
 * org row is anchored first. Returns the component role id.
 */
export async function ensureComponentRoleForTemplate(
  ctx: VortexAuthMutationCtx,
  organizationId: Id<"organizations">,
  role: OrganizationMemberRole,
) {
  const vortexAuthOrganizationId = await ensureVortexAuthOrganization(ctx, organizationId);
  const result = await ctx.runMutation(components.vortexAuth.organizations.ensureRole, {
    organizationId: vortexAuthOrganizationId,
    key: role,
    name: role,
    permissions: [...ROLE_PERMISSIONS[role]],
    isSystem: true,
  });
  return result.roleId;
}

/**
 * Create or update a member in the component for `(organizationId, userId)` with
 * the given Seal role + status. The org + role are ensured in the component
 * first. Returns the component member id. SOLE writer for membership once the
 * local `organization_members` table is dropped (P7).
 */
export async function upsertVortexAuthMember(
  ctx: VortexAuthMutationCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    role: OrganizationMemberRole;
    status: ComponentMemberStatus;
    invitedBy?: Id<"users">;
    assignedBy?: Id<"users">;
    acceptedAt?: number;
  },
) {
  const user = await ctx.db.get(args.userId);
  if (user === null) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Organization member user not found" });
  }
  if (!user.vortexAuthUserId) {
    throw new ConvexError({
      code: "FAILED_PRECONDITION",
      message: "Organization member user is missing vortex auth bridge id",
    });
  }

  const vortexAuthOrganizationId = await ensureVortexAuthOrganization(
    ctx,
    args.organizationId,
    user.vortexAuthUserId,
  );
  const roleId = await ensureComponentRoleForTemplate(ctx, args.organizationId, args.role);

  const result = await ctx.runMutation(components.vortexAuth.organizations.upsertMember, {
    organizationId: vortexAuthOrganizationId,
    userId: user.vortexAuthUserId as Id<"users">,
    roleId,
    status: args.status,
    invitedBy: await getOptionalVortexAuthUserId(ctx, args.invitedBy),
    assignedBy: await getOptionalVortexAuthUserId(ctx, args.assignedBy),
    acceptedAt: args.acceptedAt,
  });
  return result.memberId;
}

/** Component invitation status enum (mirrors the component schema). */
type ComponentInvitationStatus = "pending" | "accepted" | "revoked" | "expired";

/** Component invitation email-delivery status enum (mirrors the component). */
type ComponentInvitationEmailDeliveryStatus =
  | "not_configured"
  | "queued"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "failed";

/**
 * Create (or, by tokenHash, update) an invitation in the vortexAuth COMPONENT —
 * the SOLE source of truth for invitations once the local
 * `organization_invitations` table is dropped (P7). Returns the COMPONENT
 * invitation id (a string).
 */
export async function createVortexAuthInvitation(
  ctx: VortexAuthMutationCtx,
  args: {
    organizationId: Id<"organizations">;
    email: string;
    tokenHash: string;
    role: OrganizationMemberRole;
    status: ComponentInvitationStatus;
    invitedBy: Id<"users">;
    expiresAt: number;
  },
): Promise<string> {
  const invitedBy = await ctx.db.get(args.invitedBy);
  if (invitedBy === null) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Invitation creator not found" });
  }
  if (!invitedBy.vortexAuthUserId) {
    throw new ConvexError({
      code: "FAILED_PRECONDITION",
      message: "Invitation creator is missing vortex auth bridge id",
    });
  }

  const vortexAuthOrganizationId = await ensureVortexAuthOrganization(
    ctx,
    args.organizationId,
    invitedBy.vortexAuthUserId,
  );
  const roleId = await ensureComponentRoleForTemplate(ctx, args.organizationId, args.role);

  const result = await ctx.runMutation(components.vortexAuth.organizations.upsertInvitation, {
    organizationId: vortexAuthOrganizationId,
    roleId,
    email: args.email,
    tokenHash: args.tokenHash,
    status: args.status,
    invitedBy: invitedBy.vortexAuthUserId as Id<"users">,
    expiresAt: args.expiresAt,
  });
  return String(result.invitationId);
}

/**
 * Set the status of a COMPONENT invitation (accepted/revoked/expired).
 * `acceptedByUserId` is mapped to the component user via the Seal bridge id.
 */
export async function setVortexAuthInvitationStatus(
  ctx: VortexAuthMutationCtx,
  args: {
    invitationId: string;
    status: ComponentInvitationStatus;
    acceptedByUserId?: Id<"users">;
    acceptedAt?: number;
  },
): Promise<void> {
  await ctx.runMutation(components.vortexAuth.organizations.setInvitationStatus, {
    invitationId: args.invitationId as GenericId<"organization_invitations">,
    status: args.status,
    acceptedByUserId: await getOptionalVortexAuthUserId(ctx, args.acceptedByUserId),
    acceptedAt: args.acceptedAt,
  });
}

/**
 * Record the email-delivery state of a COMPONENT invitation so the component is
 * the sole writer + reader of invitation email delivery.
 */
export async function recordVortexAuthInvitationEmailDelivery(
  ctx: VortexAuthMutationCtx,
  args: {
    invitationId: string;
    emailId?: string | null;
    emailDeliveryStatus: ComponentInvitationEmailDeliveryStatus;
    emailDeliveryEvent?: string | null;
    emailDeliveryError?: string | null;
  },
): Promise<void> {
  await ctx.runMutation(components.vortexAuth.organizations.recordInvitationEmailDelivery, {
    invitationId: args.invitationId as GenericId<"organization_invitations">,
    emailId: args.emailId ?? null,
    emailDeliveryStatus: args.emailDeliveryStatus,
    emailDeliveryEvent: args.emailDeliveryEvent ?? null,
    emailDeliveryError: args.emailDeliveryError ?? null,
  });
}

/** Component apiKey status enum (mirrors the component schema). */
type ComponentApiKeyStatus = "active" | "revoked";

/**
 * Create an API key in the vortexAuth COMPONENT — the source of truth for API
 * keys (P5; Seal has no local api_keys table). The org is ensured in the
 * component first; the owner `userId` is mapped to the component user via the
 * bridge id. Returns the COMPONENT apiKey id (a string).
 */
export async function createVortexAuthApiKey(
  ctx: VortexAuthMutationCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    name: string;
    keyPrefix: string;
    keyHash: string;
    scopes: readonly string[];
    allowedIpRanges?: readonly string[];
    expiresAt?: number;
    status?: ComponentApiKeyStatus;
  },
): Promise<string> {
  const user = await ctx.db.get(args.userId);
  if (user === null) {
    throw new ConvexError({ code: "NOT_FOUND", message: "API key user not found" });
  }
  if (!user.vortexAuthUserId) {
    throw new ConvexError({
      code: "FAILED_PRECONDITION",
      message: "API key user is missing vortex auth bridge id",
    });
  }

  const result = await ctx.runMutation(components.vortexAuth.apiKeys.upsertApiKey, {
    organizationId: await ensureVortexAuthOrganization(
      ctx,
      args.organizationId,
      user.vortexAuthUserId,
    ),
    userId: user.vortexAuthUserId,
    name: args.name,
    keyPrefix: args.keyPrefix,
    keyHash: args.keyHash,
    requestId: null,
    requestIdExpiresAt: null,
    scopes: [...args.scopes],
    allowedIpRanges: args.allowedIpRanges ? [...args.allowedIpRanges] : null,
    expiresAt: args.expiresAt ?? null,
    status: args.status ?? "active",
  });

  return String(result.apiKeyId);
}

/** Revoke a COMPONENT apiKey (idempotent). `apiKeyId` is the COMPONENT id. */
export async function revokeVortexAuthApiKey(
  ctx: VortexAuthMutationCtx,
  apiKeyId: string,
): Promise<void> {
  await ctx.runMutation(components.vortexAuth.apiKeys.revokeApiKey, { apiKeyId });
}

/** Record lastUsed timestamp/ip on a COMPONENT apiKey (hot auth path). */
export async function touchVortexAuthApiKeyLastUsed(
  ctx: VortexAuthMutationCtx,
  args: { apiKeyId: string; ip?: string | null },
): Promise<void> {
  await ctx.runMutation(components.vortexAuth.apiKeys.touchApiKeyLastUsed, {
    apiKeyId: args.apiKeyId,
    ip: args.ip ?? null,
  });
}

async function getOptionalVortexAuthUserId(
  ctx: VortexAuthMutationCtx,
  userId: Id<"users"> | undefined,
): Promise<Id<"users"> | undefined> {
  if (userId === undefined) {
    return undefined;
  }
  const user = await ctx.db.get(userId);
  // The component's `users` id space is distinct from Seal's; the bridge id is
  // stored as a string on the Seal user row and cast to the component id type.
  return (user?.vortexAuthUserId as Id<"users"> | undefined) ?? undefined;
}
