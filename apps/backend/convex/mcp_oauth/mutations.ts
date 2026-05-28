import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

/**
 * Register a new OAuth client (Dynamic Client Registration - RFC 7591)
 */
export const registerClient = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    clientId: v.string(),
    clientSecretHash: v.optional(v.string()),
    clientName: v.string(),
    redirectUris: v.array(v.string()),
    grantTypes: v.array(v.string()),
    responseTypes: v.array(v.string()),
    tokenEndpointAuthMethod: v.string(),
    clientUri: v.optional(v.string()),
    logoUri: v.optional(v.string()),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const clientDocId = await ctx.db.insert("mcp_oauth_clients", {
      organizationId: args.organizationId,
      clientId: args.clientId,
      clientSecretHash: args.clientSecretHash,
      clientName: args.clientName,
      redirectUris: args.redirectUris,
      grantTypes: args.grantTypes,
      responseTypes: args.responseTypes,
      tokenEndpointAuthMethod: args.tokenEndpointAuthMethod,
      clientUri: args.clientUri,
      logoUri: args.logoUri,
      scope: args.scope,
      createdAt: now,
    });

    return { clientDocId };
  },
});

/**
 * Create an authorization code
 */
export const createAuthorizationCode = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    codeHash: v.string(),
    clientId: v.string(),
    userId: v.string(),
    redirectUri: v.string(),
    scope: v.string(),
    codeChallenge: v.optional(v.string()),
    codeChallengeMethod: v.optional(v.string()),
    state: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const codeDocId = await ctx.db.insert("mcp_oauth_codes", {
      organizationId: args.organizationId,
      codeHash: args.codeHash,
      clientId: args.clientId,
      userId: args.userId,
      redirectUri: args.redirectUri,
      scope: args.scope,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallengeMethod,
      state: args.state,
      expiresAt: args.expiresAt,
      createdAt: now,
    });

    return { codeDocId };
  },
});

/**
 * Delete an authorization code (after use or expiration)
 */
export const deleteAuthorizationCode = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query("mcp_oauth_codes")
      .withIndex("by_organization_code_hash", (q) =>
        q.eq("organizationId", args.organizationId).eq("codeHash", args.codeHash))
      .first();

    if (code) {
      await ctx.db.delete(code._id);
      return { deleted: true };
    }

    return { deleted: false };
  },
});

/**
 * Create a refresh token
 */
export const createRefreshToken = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    tokenHash: v.string(),
    clientId: v.string(),
    userId: v.string(),
    scope: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const tokenDocId = await ctx.db.insert("mcp_oauth_refresh_tokens", {
      organizationId: args.organizationId,
      tokenHash: args.tokenHash,
      clientId: args.clientId,
      userId: args.userId,
      scope: args.scope,
      expiresAt: args.expiresAt,
      createdAt: now,
      lastUsedAt: undefined,
    });

    return { tokenDocId };
  },
});

/**
 * Update refresh token last used timestamp
 */
export const updateRefreshTokenLastUsed = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("mcp_oauth_refresh_tokens")
      .withIndex("by_organization_token_hash", (q) =>
        q.eq("organizationId", args.organizationId).eq("tokenHash", args.tokenHash))
      .first();

    if (token) {
      await ctx.db.patch(token._id, {
        lastUsedAt: Date.now(),
      });
      return { updated: true };
    }

    return { updated: false };
  },
});

/**
 * Delete a refresh token (revocation)
 */
export const deleteRefreshToken = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("mcp_oauth_refresh_tokens")
      .withIndex("by_organization_token_hash", (q) =>
        q.eq("organizationId", args.organizationId).eq("tokenHash", args.tokenHash))
      .first();

    if (token) {
      await ctx.db.delete(token._id);
      return { deleted: true };
    }

    return { deleted: false };
  },
});

/**
 * Delete all refresh tokens for a user (e.g., when user logs out everywhere)
 */
export const deleteAllUserRefreshTokens = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("mcp_oauth_refresh_tokens")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId))
      .collect();

    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }

    return { deletedCount: tokens.length };
  },
});

/**
 * Cleanup expired authorization codes (to be called by cron)
 */
export const cleanupExpiredCodes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get expired codes
    const expiredCodes = await ctx.db
      .query("mcp_oauth_codes")
      .withIndex("by_expires_at")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    // Delete them
    for (const code of expiredCodes) {
      await ctx.db.delete(code._id);
    }

    return { deletedCount: expiredCodes.length };
  },
});

/**
 * Cleanup expired refresh tokens (to be called by cron)
 */
export const cleanupExpiredRefreshTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get expired tokens (only those with an expiration set)
    const expiredTokens = await ctx.db
      .query("mcp_oauth_refresh_tokens")
      .withIndex("by_expires_at")
      .filter((q) => q.and(q.neq(q.field("expiresAt"), undefined), q.lt(q.field("expiresAt"), now)))
      .collect();

    // Delete them
    for (const token of expiredTokens) {
      await ctx.db.delete(token._id);
    }

    return { deletedCount: expiredTokens.length };
  },
});
