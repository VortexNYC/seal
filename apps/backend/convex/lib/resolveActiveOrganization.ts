/**
 * Resolve Seal organization id from dual active-org pointers.
 *
 * Canonical: `users.activeVortexAuthOrganizationId` → local org via glue index.
 * Fallback: `users.activeOrganizationId` (legacy bridge until column retirement).
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type ResolveCtx = Pick<QueryCtx, "db">;

/**
 * Resolve the user's active Seal organization id.
 * Prefers the Vortex Auth pointer; falls back to the legacy Seal id.
 */
export async function resolveActiveOrganizationId(
  ctx: ResolveCtx,
  user: Doc<"users">
): Promise<Id<"organizations"> | null> {
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
export function buildActiveOrganizationUserPatch(
  organization: Doc<"organizations">,
  now: number = Date.now()
): {
  activeOrganizationId: Id<"organizations">;
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
