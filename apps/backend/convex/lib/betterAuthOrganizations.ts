/**
 * Component write-helpers for Seal's vortex-auth migration (P2).
 *
 * These are the SOLE writers for org / role / member / invitation truth
 * once Seal routes through the betterAuth component (mirrors crm's
 * lib/betterAuthOrganizations.ts). P2a lands them additively — no call
 * site uses them yet; the org-creation / invitation paths are switched
 * to them in later P2 sub-steps.
 *
 * Seal differences from the crm blueprint:
 *  - Role catalog comes from Seal's ROLE_PERMISSIONS (system/owner/admin/
 *    member/viewer), keyed by OrganizationMemberRole.
 *  - Org anchor uses Seal columns (logo, status, type) — no crm `plan`/
 *    `imageUrl`.
 */

import { ConvexError } from "convex/values";

import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ROLE_PERMISSIONS } from "../auth.utils";
import type { OrganizationMemberRole } from "../schema";
import { buildUpsertMetadataJsonPreservingSuitePolicy } from "./suiteOrgPolicy";

type BetterAuthMutationCtx = Pick<
  MutationCtx,
  "db" | "runMutation" | "runQuery"
>;

export async function ensureBetterAuthOrganization(
  ctx: BetterAuthMutationCtx,
  organizationId: Id<"organizations">,
  createdByBetterAuthUserId?: string
) {
  const organization = await ctx.db.get("organizations", organizationId);
  if (organization === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
  }

  const metadataJson = await buildUpsertMetadataJsonPreservingSuitePolicy(
    ctx,
    organization
  );

  const result = await ctx.runMutation(
    components.betterAuthConsumer.organizations.upsertOrganization,
    {
      organizationId: organization.betterAuthOrganizationId,
      name: organization.name,
      slug: organization.slug,
      imageUrl: organization.logo ?? null,
      status: organization.status ?? "active",
      createdBy: createdByBetterAuthUserId,
      metadataJson,
    }
  );

  if (organization.betterAuthOrganizationId !== result.organizationId) {
    await ctx.db.patch("organizations", organization._id, {
      betterAuthOrganizationId: result.organizationId,
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
export async function ensureBetterAuthSystemRoles(
  ctx: BetterAuthMutationCtx,
  betterAuthOrganizationId: string
) {
  await ctx.runMutation(
    components.betterAuthConsumer.organizations.seedDefaultRoles,
    {
      organizationId: betterAuthOrganizationId,
      catalog: Object.entries(ROLE_PERMISSIONS).map(([name, permissions]) => ({
        key: name,
        name,
        permissions: [...permissions],
        isSystem: true,
      })),
    }
  );
  return betterAuthOrganizationId;
}

/**
 * Ensure a single component role exists for `(betterAuthOrganizationId, role)`,
 * keeping its permission set in sync with Seal's ROLE_PERMISSIONS definition.
 * Takes the Vortex Auth organization id directly. Returns the component role id.
 */
export async function ensureComponentRoleForTemplate(
  ctx: BetterAuthMutationCtx,
  betterAuthOrganizationId: string,
  role: OrganizationMemberRole
) {
  const result = await ctx.runMutation(
    components.betterAuthConsumer.organizations.ensureRole,
    {
      organizationId: betterAuthOrganizationId,
      key: role,
      name: role,
      permissions: [...ROLE_PERMISSIONS[role]],
      isSystem: true,
    }
  );
  return result.roleId;
}

/**
 * Create or update a member in the component for `(betterAuthOrganizationId,
 * betterAuthUserId)` with the given Seal role + status. The role is ensured in
 * the component first. Returns the component member id. SOLE writer for
 * membership once the local `organization_members` table is dropped (P7).
 */
export async function upsertBetterAuthMember(
  ctx: BetterAuthMutationCtx,
  args: {
    betterAuthOrganizationId: string;
    betterAuthUserId: string;
    role: OrganizationMemberRole;
    status: ComponentMemberStatus;
    betterAuthInvitedBy?: string;
    betterAuthAssignedBy?: string;
    acceptedAt?: number;
  }
) {
  const roleId = await ensureComponentRoleForTemplate(
    ctx,
    args.betterAuthOrganizationId,
    args.role
  );

  const result = await ctx.runMutation(
    components.betterAuthConsumer.organizations.upsertMember,
    {
      organizationId: args.betterAuthOrganizationId,
      userId: args.betterAuthUserId,
      roleId,
      status: args.status,
      invitedBy: args.betterAuthInvitedBy,
      assignedBy: args.betterAuthAssignedBy,
      acceptedAt: args.acceptedAt,
    }
  );
  return result.memberId;
}

/**
 * Anchor a newly-created organization and its owner into the betterAuth
 * component AT CREATION TIME. Without this, an app-side org-create (onboarding /
 * `createWorkspace`) only writes the LOCAL org + membership, leaving the
 * component empty — so component-truth consumers (MCP OAuth, `/api/v1`) can't
 * see the org and deny all access until the one-shot backfill migration or a
 * later org-scoped mutation happens to fire the lazy mirror.
 *
 * Idempotent. The org anchor + role catalog are identity-independent and always
 * run; the owner membership is mirrored only once the owner is bridged to a
 * component identity (`betterAuthUserId`) — which it always is post-signup, but
 * we skip defensively otherwise and let the lazy mirror in `auth.ts` catch up.
 */
export async function anchorNewOrganizationOwner(
  ctx: BetterAuthMutationCtx,
  args: {
    organizationId: Id<"organizations">;
    ownerBetterAuthUserId?: string;
  }
): Promise<void> {
  const betterAuthOrganizationId = await ensureBetterAuthOrganization(
    ctx,
    args.organizationId,
    args.ownerBetterAuthUserId
  );
  await ensureBetterAuthSystemRoles(ctx, betterAuthOrganizationId);
  if (args.ownerBetterAuthUserId) {
    await upsertBetterAuthMember(ctx, {
      betterAuthOrganizationId,
      betterAuthUserId: args.ownerBetterAuthUserId,
      role: "owner",
      status: "active",
    });
  }
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
 * Create (or, by tokenHash, update) an invitation in the betterAuth COMPONENT —
 * the SOLE source of truth for invitations once the local
 * `organization_invitations` table is dropped (P7). Takes Vortex Auth ids
 * directly. Returns the COMPONENT invitation id (a string).
 */
export async function createBetterAuthInvitation(
  ctx: BetterAuthMutationCtx,
  args: {
    betterAuthOrganizationId: string;
    email: string;
    tokenHash: string;
    role: OrganizationMemberRole;
    status: ComponentInvitationStatus;
    invitedBy: string;
    expiresAt: number;
  }
): Promise<string> {
  const roleId = await ensureComponentRoleForTemplate(
    ctx,
    args.betterAuthOrganizationId,
    args.role
  );

  const result = await ctx.runMutation(
    components.betterAuthConsumer.organizations.upsertInvitation,
    {
      organizationId: args.betterAuthOrganizationId,
      roleId,
      email: args.email,
      tokenHash: args.tokenHash,
      status: args.status,
      invitedBy: args.invitedBy,
      expiresAt: args.expiresAt,
    }
  );
  return result.invitationId;
}

/**
 * Set the status of a COMPONENT invitation (accepted/revoked/expired).
 * Takes Vortex Auth ids directly.
 */
export async function setBetterAuthInvitationStatus(
  ctx: BetterAuthMutationCtx,
  args: {
    betterAuthOrganizationId: string;
    invitationId: string;
    status: ComponentInvitationStatus;
    acceptedByBetterAuthUserId?: string;
    acceptedAt?: number;
  }
): Promise<void> {
  await ctx.runMutation(
    components.betterAuthConsumer.organizations.setInvitationStatus,
    {
      invitationId: args.invitationId,
      organizationId: args.betterAuthOrganizationId,
      status: args.status,
      acceptedByUserId: args.acceptedByBetterAuthUserId,
      acceptedAt: args.acceptedAt,
    }
  );
}

/**
 * Record the email-delivery state of a COMPONENT invitation so the component is
 * the sole writer + reader of invitation email delivery.
 */
export async function recordBetterAuthInvitationEmailDelivery(
  ctx: BetterAuthMutationCtx,
  args: {
    betterAuthOrganizationId: string;
    invitationId: string;
    emailId?: string | null;
    emailDeliveryStatus: ComponentInvitationEmailDeliveryStatus;
    emailDeliveryEvent?: string | null;
    emailDeliveryError?: string | null;
  }
): Promise<void> {
  await ctx.runMutation(
    components.betterAuthConsumer.organizations.recordInvitationEmailDelivery,
    {
      invitationId: args.invitationId,
      organizationId: args.betterAuthOrganizationId,
      emailId: args.emailId ?? null,
      emailDeliveryStatus: args.emailDeliveryStatus,
      emailDeliveryEvent: args.emailDeliveryEvent ?? null,
      emailDeliveryError: args.emailDeliveryError ?? null,
    }
  );
}

/** Component apiKey status enum (mirrors the component schema). */
type ComponentApiKeyStatus = "active" | "revoked";

/**
 * Create an API key in the betterAuth COMPONENT — the source of truth for API
 * keys (P5; Seal has no local api_keys table). Takes Vortex Auth ids directly;
 * the caller must already have a resolved auth context. Returns the COMPONENT
 * apiKey id (a string).
 */
export async function createBetterAuthApiKey(
  ctx: BetterAuthMutationCtx,
  args: {
    betterAuthOrganizationId: string;
    betterAuthUserId: string;
    name: string;
    keyPrefix: string;
    keyHash: string;
    scopes: readonly string[];
    allowedIpRanges?: readonly string[];
    expiresAt?: number;
    status?: ComponentApiKeyStatus;
  }
): Promise<string> {
  const result = await ctx.runMutation(
    components.betterAuthConsumer.apiKeys.upsertApiKey,
    {
      organizationId: args.betterAuthOrganizationId,
      userId: args.betterAuthUserId,
      name: args.name,
      keyPrefix: args.keyPrefix,
      keyHash: args.keyHash,
      requestId: null,
      requestIdExpiresAt: null,
      scopes: [...args.scopes],
      allowedIpRanges: args.allowedIpRanges ? [...args.allowedIpRanges] : null,
      expiresAt: args.expiresAt ?? null,
      status: args.status ?? "active",
    }
  );

  return result.apiKeyId;
}

/** Revoke a COMPONENT apiKey (idempotent). `apiKeyId` is the COMPONENT id. */
export async function revokeBetterAuthApiKey(
  ctx: BetterAuthMutationCtx,
  args: { apiKeyId: string; betterAuthOrganizationId: string }
): Promise<void> {
  await ctx.runMutation(components.betterAuthConsumer.apiKeys.revokeApiKey, {
    apiKeyId: args.apiKeyId,
    organizationId: args.betterAuthOrganizationId,
  });
}

/** Record lastUsed timestamp/ip on a COMPONENT apiKey (hot auth path). */
export async function touchBetterAuthApiKeyLastUsed(
  ctx: BetterAuthMutationCtx,
  args: {
    apiKeyId: string;
    betterAuthOrganizationId: string;
    ip?: string | null;
  }
): Promise<void> {
  await ctx.runMutation(
    components.betterAuthConsumer.apiKeys.touchApiKeyLastUsed,
    {
      apiKeyId: args.apiKeyId,
      organizationId: args.betterAuthOrganizationId,
      ip: args.ip ?? null,
    }
  );
}
