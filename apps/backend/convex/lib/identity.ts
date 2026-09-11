/**
 * Identity helpers — component→local user resolution for auth wrappers.
 *
 * Prefer this over importing glue adapters into the hot path so typed
 * QueryCtx/MutationCtx stays lint-clean (GlueCtx.db is `unknown`).
 */

import { ConvexError } from "convex/values";

import { components, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getBetterAuthIdentityIssuer,
  getBetterAuthIdentityProvider,
} from "./authIdentities";
import { canonicalAuth } from "./canonicalGlue";

type IdentityCtx = QueryCtx | MutationCtx;

/**
 * Resolve the local users row for the authenticated identity via the
 * vortex-auth component (2-hop), then fall back to by_auth_subject.
 */
export async function findCurrentUserRow(
  ctx: IdentityCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }

  const issuer =
    typeof identity.issuer === "string" && identity.issuer.length > 0
      ? identity.issuer
      : getBetterAuthIdentityIssuer();

  const componentIdentity = await ctx.runQuery(
    components.betterAuthConsumer.identity.getByIdentity,
    {
      provider: getBetterAuthIdentityProvider(),
      issuer,
      subject: identity.subject,
    }
  );

  const findByComponentUserId = async (componentUserId: string) =>
    await ctx.db
      .query("users")
      .withIndex("by_better_auth_user", (q) =>
        q.eq("betterAuthUserId", componentUserId)
      )
      .unique();

  if (componentIdentity !== null) {
    const existing = await findByComponentUserId(componentIdentity.userId);
    if (existing !== null) {
      return existing;
    }
  }

  // Lazy provisioning only works in mutation context.
  if (!("runMutation" in ctx) || typeof ctx.runMutation !== "function") {
    const bySubject = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject)
      )
      .first();
    return bySubject;
  }

  const email =
    typeof identity.email === "string" && identity.email.length > 0
      ? identity.email
      : undefined;
  if (email === undefined) {
    return null;
  }

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

  const refreshed = await ctx.runQuery(
    components.betterAuthConsumer.identity.getByIdentity,
    {
      provider: getBetterAuthIdentityProvider(),
      issuer,
      subject: identity.subject,
    }
  );
  if (refreshed === null) {
    return null;
  }
  return await findByComponentUserId(refreshed.userId);
}

export async function getCurrentUser(
  ctx: IdentityCtx
): Promise<Doc<"users"> | null> {
  return await findCurrentUserRow(ctx);
}

export async function requireUser(ctx: IdentityCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    throw new ConvexError("Authentication required");
  }
  return user;
}

/**
 * Resolve the authenticated viewer via createBetterAuthGlue.
 * Prefer getAuthContextWithPermissions for product handlers that need
 * Seal's permission catalog + subscription.
 */
export async function requireViewer(ctx: IdentityCtx) {
  return await canonicalAuth.resolveViewer(ctx);
}
