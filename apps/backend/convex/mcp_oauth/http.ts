/**
 * HTTP endpoints for MCP OAuth operations.
 * These endpoints are called by the MCP server to store/retrieve OAuth data.
 * Secured by an internal API key (MCP_INTERNAL_SECRET).
 */

import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";

/**
 * Verify the internal API key from the request
 */
function verifyInternalAuth(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);
  const internalSecret = process.env.MCP_INTERNAL_SECRET;

  if (!internalSecret) {
    console.error("MCP_INTERNAL_SECRET not configured");
    return false;
  }

  return token === internalSecret;
}

/**
 * Create a JSON error response
 */
function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a JSON success response
 */
function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// =============================================================================
// Client Operations
// =============================================================================

/**
 * Register a new OAuth client
 * POST /mcp-oauth/clients
 */
export const registerClient = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const body = (await request.json()) as {
      clientId: string;
      clientSecretHash?: string;
      clientName: string;
      redirectUris: string[];
      grantTypes: string[];
      responseTypes: string[];
      tokenEndpointAuthMethod: string;
      clientUri?: string;
      logoUri?: string;
      scope?: string;
    };

    const result = await ctx.runMutation(internal.mcp_oauth.mutations.registerClient, body);

    return jsonResponse(result, 201);
  } catch (error) {
    console.error("Error registering client:", error);
    return errorResponse(500, "Internal error");
  }
});

/**
 * Get a client by client ID
 * GET /mcp-oauth/clients?clientId=xxx
 */
export const getClient = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId");

    if (!clientId) {
      return errorResponse(400, "clientId is required");
    }

    const client = await ctx.runQuery(internal.mcp_oauth.queries.getClientById, { clientId });

    if (!client) {
      return errorResponse(404, "Client not found");
    }

    return jsonResponse(client);
  } catch (error) {
    console.error("Error getting client:", error);
    return errorResponse(500, "Internal error");
  }
});

// =============================================================================
// Authorization Code Operations
// =============================================================================

/**
 * Create an authorization code
 * POST /mcp-oauth/codes
 */
export const createAuthorizationCode = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const body = (await request.json()) as {
      codeHash: string;
      clientId: string;
      userId: string;
      redirectUri: string;
      scope: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
      state?: string;
      expiresAt: number;
    };

    const result = await ctx.runMutation(
      internal.mcp_oauth.mutations.createAuthorizationCode,
      body,
    );

    return jsonResponse(result, 201);
  } catch (error) {
    console.error("Error creating authorization code:", error);
    return errorResponse(500, "Internal error");
  }
});

/**
 * Get an authorization code by hash
 * GET /mcp-oauth/codes?codeHash=xxx
 */
export const getAuthorizationCode = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const url = new URL(request.url);
    const codeHash = url.searchParams.get("codeHash");

    if (!codeHash) {
      return errorResponse(400, "codeHash is required");
    }

    const code = await ctx.runQuery(internal.mcp_oauth.queries.getAuthorizationCode, { codeHash });

    if (!code) {
      return errorResponse(404, "Authorization code not found or expired");
    }

    return jsonResponse(code);
  } catch (error) {
    console.error("Error getting authorization code:", error);
    return errorResponse(500, "Internal error");
  }
});

/**
 * Delete an authorization code
 * DELETE /mcp-oauth/codes?codeHash=xxx
 */
export const deleteAuthorizationCode = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const url = new URL(request.url);
    const codeHash = url.searchParams.get("codeHash");

    if (!codeHash) {
      return errorResponse(400, "codeHash is required");
    }

    const result = await ctx.runMutation(internal.mcp_oauth.mutations.deleteAuthorizationCode, {
      codeHash,
    });

    return jsonResponse(result);
  } catch (error) {
    console.error("Error deleting authorization code:", error);
    return errorResponse(500, "Internal error");
  }
});

// =============================================================================
// Refresh Token Operations
// =============================================================================

/**
 * Create a refresh token
 * POST /mcp-oauth/refresh-tokens
 */
export const createRefreshToken = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const body = (await request.json()) as {
      tokenHash: string;
      clientId: string;
      userId: string;
      scope: string;
      expiresAt?: number;
    };

    const result = await ctx.runMutation(internal.mcp_oauth.mutations.createRefreshToken, body);

    return jsonResponse(result, 201);
  } catch (error) {
    console.error("Error creating refresh token:", error);
    return errorResponse(500, "Internal error");
  }
});

/**
 * Get a refresh token by hash
 * GET /mcp-oauth/refresh-tokens?tokenHash=xxx
 */
export const getRefreshToken = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const url = new URL(request.url);
    const tokenHash = url.searchParams.get("tokenHash");

    if (!tokenHash) {
      return errorResponse(400, "tokenHash is required");
    }

    const token = await ctx.runQuery(internal.mcp_oauth.queries.getRefreshToken, { tokenHash });

    if (!token) {
      return errorResponse(404, "Refresh token not found or expired");
    }

    return jsonResponse(token);
  } catch (error) {
    console.error("Error getting refresh token:", error);
    return errorResponse(500, "Internal error");
  }
});

/**
 * Update refresh token last used timestamp
 * PUT /mcp-oauth/refresh-tokens
 */
export const updateRefreshToken = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const body = (await request.json()) as {
      tokenHash: string;
    };

    const result = await ctx.runMutation(
      internal.mcp_oauth.mutations.updateRefreshTokenLastUsed,
      body,
    );

    return jsonResponse(result);
  } catch (error) {
    console.error("Error updating refresh token:", error);
    return errorResponse(500, "Internal error");
  }
});

/**
 * Delete a refresh token
 * DELETE /mcp-oauth/refresh-tokens?tokenHash=xxx
 */
export const deleteRefreshToken = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const url = new URL(request.url);
    const tokenHash = url.searchParams.get("tokenHash");

    if (!tokenHash) {
      return errorResponse(400, "tokenHash is required");
    }

    const result = await ctx.runMutation(internal.mcp_oauth.mutations.deleteRefreshToken, {
      tokenHash,
    });

    return jsonResponse(result);
  } catch (error) {
    console.error("Error deleting refresh token:", error);
    return errorResponse(500, "Internal error");
  }
});

// =============================================================================
// Validation Operations
// =============================================================================

/**
 * Validate a redirect URI for a client
 * GET /mcp-oauth/validate-redirect?clientId=xxx&redirectUri=xxx
 */
export const validateRedirectUri = httpAction(async (ctx, request) => {
  if (!verifyInternalAuth(request)) {
    return errorResponse(401, "Unauthorized");
  }

  try {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId");
    const redirectUri = url.searchParams.get("redirectUri");

    if (!clientId || !redirectUri) {
      return errorResponse(400, "clientId and redirectUri are required");
    }

    const result = await ctx.runQuery(internal.mcp_oauth.queries.validateRedirectUri, {
      clientId,
      redirectUri,
    });

    return jsonResponse(result);
  } catch (error) {
    console.error("Error validating redirect URI:", error);
    return errorResponse(500, "Internal error");
  }
});
