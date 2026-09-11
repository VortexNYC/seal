/**
 * Resolve the user's active organization from Vortex Auth (canonical) with
 * Seal local bridge fallbacks. Returns an `AuthOrganization` shape: the
 * Vortex Auth component fields plus the Seal `_id`.
 */

import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ResolveCtx = QueryCtx | MutationCtx;

type ResolvedAnchor = {
  _id: Id<"organizations">;
  vortexAuthOrganizationId: string;
} | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function resolveActiveOrganizationFromSession(
  ctx: ResolveCtx
): Promise<ResolvedAnchor> {
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

  const vortexAuthOrganizationId = session["activeOrganizationId"];
  if (typeof vortexAuthOrganizationId !== "string") {
    return null;
  }

  const anchor = await ctx.db
    .query("organizations")
    .withIndex("by_vortex_auth_organization", (q) =>
      q.eq("vortexAuthOrganizationId", vortexAuthOrganizationId)
    )
    .unique();

  if (anchor === null) {
    return null;
  }

  return { _id: anchor._id, vortexAuthOrganizationId };
}

async function getComponentOrganization(
  ctx: ResolveCtx,
  organizationId: string
): Promise<{
  name: string;
  status: "active" | "suspended" | "deleted";
} | null> {
  const org = await ctx.runQuery(
    components.vortexAuth.organizations.getOrganization,
    { organizationId }
  );
  if (org === null) {
    return null;
  }
  const status = org.status;
  if (status !== "active" && status !== "suspended" && status !== "deleted") {
    return null;
  }
  return { name: org.name, status };
}

/**
 * Resolve the user's active organization from Vortex Auth.
 *
 * Canonical source is the active organization on the current Better
 * Auth session. Falls back to local bridge columns while the session
 * migration is in progress.
 */
export async function resolveActiveOrganization(
  ctx: ResolveCtx,
  user: Doc<"users">
): Promise<Pick<
  Doc<"organizations">,
  "_id" | "vortexAuthOrganizationId" | "status" | "name"
> | null> {
  const sessionAnchor = await resolveActiveOrganizationFromSession(ctx);
  if (sessionAnchor !== null) {
    const componentOrg = await getComponentOrganization(
      ctx,
      sessionAnchor.vortexAuthOrganizationId
    );
    if (componentOrg !== null) {
      return {
        _id: sessionAnchor._id,
        vortexAuthOrganizationId: sessionAnchor.vortexAuthOrganizationId,
        status: componentOrg.status,
        name: componentOrg.name,
      };
    }
  }

  const vortexAuthOrgId = user.activeVortexAuthOrganizationId;
  if (vortexAuthOrgId !== undefined) {
    const [anchor, componentOrg] = await Promise.all([
      ctx.db
        .query("organizations")
        .withIndex("by_vortex_auth_organization", (q) =>
          q.eq("vortexAuthOrganizationId", vortexAuthOrgId)
        )
        .unique(),
      getComponentOrganization(ctx, vortexAuthOrgId),
    ]);
    if (anchor !== null && componentOrg !== null) {
      return {
        _id: anchor._id,
        vortexAuthOrganizationId: vortexAuthOrgId,
        status: componentOrg.status,
        name: componentOrg.name,
      };
    }
  }

  const legacyId = user.activeOrganizationId;
  if (legacyId !== undefined) {
    const org = await ctx.db.get("organizations", legacyId);
    if (org !== null) {
      const componentOrg =
        org.vortexAuthOrganizationId !== undefined
          ? await getComponentOrganization(ctx, org.vortexAuthOrganizationId)
          : null;
      return {
        _id: org._id,
        vortexAuthOrganizationId:
          org.vortexAuthOrganizationId ?? legacyId.toString(),
        status: componentOrg?.status ?? org.status ?? "active",
        name: componentOrg?.name ?? org.name,
      };
    }
  }

  return null;
}

/**
 * @deprecated Use `resolveActiveOrganization` for the full auth shape.
 */
export async function resolveActiveOrganizationId(
  ctx: ResolveCtx,
  user: Doc<"users">
): Promise<Id<"organizations"> | null> {
  const org = await resolveActiveOrganization(ctx, user);
  return org?._id ?? null;
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
