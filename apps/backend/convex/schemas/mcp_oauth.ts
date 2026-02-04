import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * MCP OAuth Clients Schema
 *
 * Stores dynamic client registrations for MCP OAuth.
 * Clients are registered via RFC 7591 Dynamic Client Registration.
 */
export const mcpOauthClientsTable = defineTable({
  // Generated client ID (UUID)
  clientId: v.string(),

  // Hashed client secret (for confidential clients, optional for public clients)
  clientSecretHash: v.optional(v.string()),

  // Client metadata
  clientName: v.string(),
  redirectUris: v.array(v.string()),
  grantTypes: v.array(v.string()),
  responseTypes: v.array(v.string()),
  tokenEndpointAuthMethod: v.string(),

  // Optional metadata
  clientUri: v.optional(v.string()),
  logoUri: v.optional(v.string()),
  scope: v.optional(v.string()),

  // Timestamps
  createdAt: v.number(),
})
  .index("by_client_id", ["clientId"])
  .index("by_created_at", ["createdAt"]);

/**
 * MCP OAuth Authorization Codes Schema
 *
 * Stores short-lived authorization codes for the OAuth flow.
 * Codes are one-time use and expire after 10 minutes.
 */
export const mcpOauthCodesTable = defineTable({
  // Hashed authorization code
  codeHash: v.string(),

  // Client that requested the code
  clientId: v.string(),

  // User who authorized (Clerk user ID)
  userId: v.string(),

  // Redirect URI used in the authorization request
  redirectUri: v.string(),

  // Granted scope
  scope: v.string(),

  // PKCE challenge (required for public clients)
  codeChallenge: v.optional(v.string()),
  codeChallengeMethod: v.optional(v.string()),

  // State parameter (for validation)
  state: v.optional(v.string()),

  // Expiration timestamp (10 minutes from creation)
  expiresAt: v.number(),

  // Creation timestamp
  createdAt: v.number(),
})
  .index("by_code_hash", ["codeHash"])
  .index("by_expires_at", ["expiresAt"]);

/**
 * MCP OAuth Refresh Tokens Schema
 *
 * Stores refresh tokens for long-lived access.
 * Refresh tokens can be used to obtain new access tokens.
 */
export const mcpOauthRefreshTokensTable = defineTable({
  // Hashed refresh token
  tokenHash: v.string(),

  // Client that owns the token
  clientId: v.string(),

  // User who authorized (Clerk user ID)
  userId: v.string(),

  // Granted scope
  scope: v.string(),

  // Optional expiration (null = never expires)
  expiresAt: v.optional(v.number()),

  // Creation timestamp
  createdAt: v.number(),

  // Last used timestamp
  lastUsedAt: v.optional(v.number()),
})
  .index("by_token_hash", ["tokenHash"])
  .index("by_user_client", ["userId", "clientId"])
  .index("by_user_id", ["userId"])
  .index("by_expires_at", ["expiresAt"]);
