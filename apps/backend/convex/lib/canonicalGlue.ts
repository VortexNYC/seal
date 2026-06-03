/**
 * Canonical vortex-auth glue instance for Seal.
 *
 * P0 scaffold pass: builds `createVortexAuthGlue` with Seal-flavored
 * adapters wired against Seal's existing schema. NO call site uses this
 * yet — it lands alongside the existing auth path so we can run
 * behavior-equivalence checks before swapping the auth context to consume
 * the glue under the hood (P2).
 *
 * Seal-specific adapter translations (Seal schema shape → glue contract):
 *  - User resolution is a 2-hop: components.vortexAuth.identity.getByIdentity
 *    → componentUserId → users.by_vortex_auth_user (with lazy provision via
 *    internal.users.upsertFromBetterAuth), matching crm.
 *  - `setActiveOrganization` writes the canonical `activeVortexAuthOrganizationId`
 *    column directly (new column, no legacy bridge needed).
 *  - `insertAnchor` composes Seal's required org columns (slug/type/timezone/
 *    isActive/updatedAt + status) using Seal defaults.
 *  - `expandPermissions` runs Seal's ROLE_PERMISSIONS expansion so the glue
 *    mirrors the legacy auth.utils permission semantics.
 */

import {
  createVortexAuthGlue,
  type B2BModeAdapters,
  type GlueCtx,
} from "@plasmapos/vortex-auth/convex";

import { components, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ROLE_PERMISSIONS } from "../auth.utils";
import type { OrganizationMemberRole } from "../schema";
import { getBetterAuthIdentityIssuer, getBetterAuthIdentityProvider } from "./authIdentities";

type AnyCtx = QueryCtx | MutationCtx;

// The glue's `GlueUserMinimum` requires `activeVortexAuthOrganizationId?:
// string`, which Seal's schema now carries on the user doc.
type GlueUser = Doc<"users"> & {
  activeVortexAuthOrganizationId?: string;
};

// Narrow the anchor type to assert the bridge column is set. Seal's schema
// marks `vortexAuthOrganizationId` optional for backwards compat; the glue
// contract requires a populated value.
type GlueAnchor = Omit<Doc<"organizations">, "vortexAuthOrganizationId"> & {
  vortexAuthOrganizationId: string;
};

function slugifyName(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug.length > 0 ? slug : `org-${Math.random().toString(36).slice(2, 8)}`;
}

async function findOrProvisionUser(ctx: GlueCtx): Promise<Doc<"users"> | null> {
  // Seal's local `users.vortexAuthUserId` stores the COMPONENT'S opaque
  // userId, NOT the raw JWT subject. Resolution is a 2-hop:
  //   1. components.vortexAuth.identity.getByIdentity → componentUserId
  //   2. local users.by_vortex_auth_user where vortexAuthUserId = componentUserId
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  const typed = ctx as unknown as AnyCtx;
  const issuer =
    typeof identity.issuer === "string" && identity.issuer.length > 0
      ? identity.issuer
      : getBetterAuthIdentityIssuer();
  const componentIdentity = (await ctx.runQuery(components.vortexAuth.identity.getByIdentity, {
    provider: getBetterAuthIdentityProvider(),
    issuer,
    subject: identity.subject,
  })) as { userId: string } | null;

  const findByComponentUserId = async (componentUserId: string) =>
    await typed.db
      .query("users")
      .withIndex("by_vortex_auth_user", (q) => q.eq("vortexAuthUserId", componentUserId))
      .unique();

  if (componentIdentity !== null) {
    const existing = await findByComponentUserId(componentIdentity.userId);
    if (existing !== null) return existing;
  }

  // Lazy provisioning. Requires mutation context; query contexts return
  // null (legacy does too).
  if (ctx.runMutation === undefined) return null;
  const email =
    typeof identity.email === "string" && identity.email.length > 0 ? identity.email : undefined;
  if (email === undefined) return null;
  await ctx.runMutation(internal.users.upsertFromBetterAuth, {
    betterAuthUserId: identity.subject,
    email,
    emailVerified: identity.emailVerified === true,
    issuer,
    name: typeof identity.name === "string" ? identity.name : undefined,
    image:
      typeof identity.pictureUrl === "string"
        ? identity.pictureUrl
        : typeof identity.picture === "string"
          ? identity.picture
          : undefined,
  });
  const refreshed = (await ctx.runQuery(components.vortexAuth.identity.getByIdentity, {
    provider: getBetterAuthIdentityProvider(),
    issuer,
    subject: identity.subject,
  })) as { userId: string } | null;
  if (refreshed === null) return null;
  return await findByComponentUserId(refreshed.userId);
}

const adapters: B2BModeAdapters<GlueUser, GlueAnchor> = {
  findUserByVortexAuthUserId: async (ctx: GlueCtx): Promise<GlueUser | null> => {
    const user = await findOrProvisionUser(ctx);
    if (user === null) return null;
    return user as GlueUser;
  },
  findAnchorByVortexAuthOrganizationId: async (
    ctx: GlueCtx,
    id: string,
  ): Promise<GlueAnchor | null> => {
    const row = await (ctx as unknown as AnyCtx).db
      .query("organizations")
      .withIndex("by_vortex_auth_organization", (q) => q.eq("vortexAuthOrganizationId", id))
      .unique();
    if (row === null || row.vortexAuthOrganizationId === undefined) return null;
    return row as GlueAnchor;
  },
  insertAnchor: async (
    ctx: GlueCtx,
    args: { vortexAuthOrganizationId: string; name: string; createdByVortexAuthUserId: string },
  ): Promise<GlueAnchor> => {
    const dbMaybe = (ctx as { db?: unknown }).db as { insert?: unknown } | undefined;
    if (dbMaybe === undefined || typeof dbMaybe.insert !== "function") {
      throw new Error(
        "insertAnchor: cannot create anchor from a read-only context; retry via mutation",
      );
    }
    const now = Date.now();
    const _id = await (ctx as unknown as MutationCtx).db.insert("organizations", {
      name: args.name,
      slug: slugifyName(args.name),
      type: "company",
      timezone: "UTC",
      isActive: true,
      status: "active",
      vortexAuthOrganizationId: args.vortexAuthOrganizationId,
      updatedAt: now,
    });
    const row = await (ctx as unknown as MutationCtx).db.get(_id);
    if (row === null || row.vortexAuthOrganizationId === undefined) {
      throw new Error("insertAnchor: row vanished or bridge column missing");
    }
    return row as GlueAnchor;
  },
  setActiveOrganization: async (
    ctx: GlueCtx,
    user: GlueUser,
    vortexAuthOrganizationId: string,
  ): Promise<void> => {
    const dbMaybe = (ctx as { db?: unknown }).db as { patch?: unknown } | undefined;
    if (dbMaybe === undefined || typeof dbMaybe.patch !== "function") {
      return;
    }
    await (ctx as unknown as MutationCtx).db.patch(user._id, {
      activeVortexAuthOrganizationId: vortexAuthOrganizationId,
    });
  },
  expandPermissions: (roleKey: string, permissions: readonly string[]): readonly string[] => {
    // Seal's auth.utils owns the canonical role→permission expansion.
    // Fall back to the glue-supplied permissions for any unknown role key.
    const expanded = ROLE_PERMISSIONS[roleKey as OrganizationMemberRole];
    return expanded ?? permissions;
  },
};

export const canonicalAuth = createVortexAuthGlue<GlueUser, GlueAnchor>({
  orgs: "enabled",
  // Seal is B2B SaaS: users land via invite-driven onboarding. Direct
  // signups without an invite do NOT get an auto-personal-org — they
  // surface a "no organization" UX state and create one explicitly.
  invitedUsersGetPersonalOrg: false,
  identityProvider: getBetterAuthIdentityProvider(),
  component: components.vortexAuth,
  adapters,
});
