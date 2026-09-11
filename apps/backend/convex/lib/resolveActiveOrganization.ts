/**
 * Resolve the user's active Seal organization id.
 *
 * Canonical source is the active organization stored on the current Better
 * Auth session. Falls back to local bridge columns while the session
 * migration is in progress.
 */

import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ResolveCtx = QueryCtx | MutationCtx;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function resolveActiveOrganizationFromSession(
  ctx: ResolveCtx
): Promise<Id<"organizations"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }

  const sessionId =
    typeof identity.sessionId === "string" && identity.sessionId.length > 0
      ? identity.sessionId
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

  if (!isRecord(session)) {
    return null;
  }

  const activeOrganizationId = session["activeOrganizationId"];
  if (typeof activeOrganizationId !== "string") {
    return null;
  }

  const anchor = await ctx.db
    .query("organizations")
    .withIndex("by_vortex_auth_organization", (q) =>
      q.eq("vortexAuthOrganizationId", activeOrganizationId)
    )
    .unique();

  return anchor?._id ?? null;
}

/**
 * Resolve the user's active Seal organization id.
 *
 * Canonical source is the active organization on the current Better Auth
 * session. Falls back to the local Vortex Auth pointer and then the legacy
 * Seal id while the session migration is in progress.
 */
export async function resolveActiveOrganizationId(
  ctx: ResolveCtx,
  user: Doc<"users">
): Promise<Id<"organizations"> | null> {
  const sessionOrganizationId = await resolveActiveOrganizationFromSession(ctx);
  if (sessionOrganizationId !== null) {
    return sessionOrganizationId;
  }

  const vortexAuthOrgId = user.activeVortexAuthOrganizationId;
  if (vortexAuthOrgId !== undefined) {
    const anchor = await ctx.db
      .query("organizations")
      .withIndex("by_vortex_auth_organization", (q) =>
        q.eq("vortexAuthOrganizationId", vortexAuthOrgId)
      )
      .unique();
    if (anchor !== null) {
      return anchor._id;
    }
  }

  const legacyId = user.activeOrganizationId;
  if (legacyId !== undefined) {
    const org = await ctx.db.get("organizations", legacyId);
    if (org !== null) {
      return org._id;
    }
  }

  return null;
}

/**
 * Dual-write patch for set-active-org mutations.
 * Always writes Seal id; writes Vortex Auth id when the org is anchored.
 */
export function buildActiveOrganizationUserPatch<
  OrganizationId extends Id<"organizations"> | string,
>(
  organization: {
    readonly _id: OrganizationId;
    readonly vortexAuthOrganizationId?: string;
  },
  now: number = Date.now()
): {
  activeOrganizationId: OrganizationId;
  activeVortexAuthOrganizationId?: string;
  updatedAt: number;
} {
  return {
    activeOrganizationId: organization._id,
    ...(organization.vortexAuthOrganizationId !== undefined
      ? {
          activeVortexAuthOrganizationId: organization.vortexAuthOrganizationId,
        }
      : {}),
    updatedAt: now,
  };
}
