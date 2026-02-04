import { v } from "convex/values";

import { internalQuery } from "../_generated/server";

/**
 * Get a client by client ID
 */
export const getClientById = internalQuery({
  args: {
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("mcp_oauth_clients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .first();

    return client;
  },
});

/**
 * Get an authorization code by hash
 */
export const getAuthorizationCode = internalQuery({
  args: {
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query("mcp_oauth_codes")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", args.codeHash))
      .first();

    if (!code) {
      return null;
    }

    // Check if expired
    if (code.expiresAt < Date.now()) {
      return null;
    }

    return code;
  },
});

/**
 * Get a refresh token by hash
 */
export const getRefreshToken = internalQuery({
  args: {
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("mcp_oauth_refresh_tokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!token) {
      return null;
    }

    // Check if expired (if expiration is set)
    if (token.expiresAt !== undefined && token.expiresAt < Date.now()) {
      return null;
    }

    return token;
  },
});

/**
 * Get all refresh tokens for a user-client combination
 */
export const getRefreshTokensByUserAndClient = internalQuery({
  args: {
    userId: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("mcp_oauth_refresh_tokens")
      .withIndex("by_user_client", (q) => q.eq("userId", args.userId).eq("clientId", args.clientId))
      .collect();

    // Filter out expired tokens
    const now = Date.now();
    return tokens.filter((token) => token.expiresAt === undefined || token.expiresAt > now);
  },
});

/**
 * Validate that a redirect URI is registered for a client
 */
export const validateRedirectUri = internalQuery({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("mcp_oauth_clients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .first();

    if (!client) {
      return { valid: false, error: "Client not found" };
    }

    const isValid = client.redirectUris.includes(args.redirectUri);

    return {
      valid: isValid,
      error: isValid ? undefined : "Redirect URI not registered for client",
    };
  },
});
