import { createBetterAuthIdentityProvisionPayload } from "@plasmapos/vortex-auth/better-auth";
import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx, query } from "./_generated/server";
import { getBetterAuthIdentityIssuer, getBetterAuthIdentityProvider } from "./lib/authIdentities";

type BetterAuthIdentity = Record<string, unknown> & {
  subject: string;
  issuer?: string;
};

type UpsertBetterAuthUserArgs = {
  betterAuthUserId: string;
  email: string;
  emailVerified: boolean;
  issuer: string;
  name?: string;
  image?: string;
  sessionId?: string | null;
};

/**
 * Return the currently-authenticated user's Seal `users` row, or null when
 * unauthenticated / not yet provisioned. Resolution is by identity subject
 * (stored on the `authSubject` column). Used by the vortex-auth React
 * identity provisioner to detect whether the local user exists yet.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<Doc<"users"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }
    return await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
      .first();
  },
});

/**
 * Provision the currently-authenticated Better-Auth user into Seal's
 * `users` table (and the vortexAuth component identity). Public mutation
 * the web client can call on first authenticated load.
 */
export const provisionCurrentBetterAuthUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = (await ctx.auth.getUserIdentity()) as BetterAuthIdentity | null;
    if (identity === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }

    return await upsertBetterAuthUser(ctx, {
      betterAuthUserId: identity.subject,
      email: readRequiredIdentityEmail(identity),
      emailVerified: readIdentityEmailVerified(identity),
      issuer: typeof identity.issuer === "string" ? identity.issuer : getBetterAuthIdentityIssuer(),
      name: readOptionalIdentityString(identity, "name"),
      image: readIdentityImage(identity),
    });
  },
});

/**
 * Internal sync trigger target — fired by the Better-Auth user-sync
 * triggers (betterAuthClient.ts) on create/update.
 */
export const upsertFromBetterAuth = internalMutation({
  args: {
    betterAuthUserId: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    issuer: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await upsertBetterAuthUser(ctx, args);
  },
});

/**
 * Internal sync trigger target — fired when a Better-Auth user is deleted.
 * Resolves the component identity → local user and cascades the delete.
 */
export const deleteFromBetterAuth = internalMutation({
  args: {
    betterAuthUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.runQuery(components.vortexAuth.identity.getByIdentity, {
      issuer: getBetterAuthIdentityIssuer(),
      provider: getBetterAuthIdentityProvider(),
      subject: args.betterAuthUserId,
    });
    if (identity === null) {
      return { deleted: false };
    }

    const localUser = await ctx.db
      .query("users")
      .withIndex("by_vortex_auth_user", (q) => q.eq("vortexAuthUserId", identity.userId))
      .first();
    if (localUser === null) {
      return { deleted: false };
    }

    await ctx.db.delete(localUser._id);
    return { deleted: true, userId: localUser._id };
  },
});

async function upsertBetterAuthUser(ctx: MutationCtx, args: UpsertBetterAuthUserArgs) {
  const provisionPayload = createBetterAuthIdentityProvisionPayload(args);
  const normalizedEmail = requireProvisionedEmail(provisionPayload.user.email);
  const vortexProvision = await ctx.runMutation(
    components.vortexAuth.identity.provisionFromIdentity,
    provisionPayload,
  );

  const existingByVortexAuth = await ctx.db
    .query("users")
    .withIndex("by_vortex_auth_user", (q) => q.eq("vortexAuthUserId", vortexProvision.userId))
    .first();
  const existingByEmail = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .first();

  const now = Date.now();
  // Seal stores the avatar under `avatar` (Better-Auth surfaces it as
  // `image`); timezone/locale are required columns with sane defaults.
  const patch = {
    email: normalizedEmail,
    name: provisionPayload.user.name,
    avatar: provisionPayload.user.image,
    isEmailVerified: args.emailVerified,
    vortexAuthUserId: vortexProvision.userId,
    lastLoginAt: now,
    updatedAt: now,
  };

  const existingUser = existingByVortexAuth ?? existingByEmail;

  if (existingUser) {
    await ctx.db.patch(existingUser._id, patch);
    return { created: false, userId: existingUser._id };
  }

  const userId = await ctx.db.insert("users", {
    ...patch,
    // The Better-Auth subject is the user's canonical auth-subject key.
    authSubject: args.betterAuthUserId,
    timezone: "UTC",
    locale: "en-US",
    isSuperAdmin: false,
  });

  return { created: true, userId };
}

function requireProvisionedEmail(email: string | undefined): string {
  if (email !== undefined && email.length > 0) {
    return email;
  }
  throw new ConvexError({
    code: "INVALID_IDENTITY",
    message: "Better-Auth identity is missing a usable email address",
  });
}

function readRequiredIdentityEmail(identity: BetterAuthIdentity): string {
  const email = readOptionalIdentityString(identity, "email");
  if (email === undefined) {
    throw new ConvexError({
      code: "INVALID_IDENTITY",
      message: "Authenticated identity has no email",
    });
  }
  return email;
}

function readIdentityEmailVerified(identity: BetterAuthIdentity): boolean {
  return identity.emailVerified === true;
}

function readOptionalIdentityString(identity: BetterAuthIdentity, key: string): string | undefined {
  const value = identity[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readIdentityImage(identity: BetterAuthIdentity): string | undefined {
  return (
    readOptionalIdentityString(identity, "pictureUrl") ??
    readOptionalIdentityString(identity, "picture") ??
    readOptionalIdentityString(identity, "image")
  );
}
