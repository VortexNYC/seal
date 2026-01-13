/**
 * OAuth 2.0 Routes
 *
 * Provides OAuth endpoints for the MCP server acting as its own Authorization Server.
 * This allows MCP clients to authenticate without needing to directly talk to Clerk.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import {
	handleAuthorize,
	handleCallback,
	handleClientRegistration,
	handleRevoke,
	handleToken,
} from "./handlers";

export const oauthRoutes = new Hono();

// CORS for OAuth endpoints
oauthRoutes.use(
	"*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	}),
);

/**
 * Dynamic Client Registration (RFC 7591)
 * POST /oauth/register
 *
 * Allows MCP clients to register themselves dynamically.
 */
oauthRoutes.post("/register", handleClientRegistration);

/**
 * Authorization Endpoint (RFC 6749)
 * GET /oauth/authorize
 *
 * Initiates the authorization flow. Redirects to Clerk for authentication.
 */
oauthRoutes.get("/authorize", handleAuthorize);

/**
 * Callback Endpoint
 * GET /oauth/callback
 *
 * Handles the return from Clerk authentication.
 * Issues authorization code and redirects back to the MCP client.
 */
oauthRoutes.get("/callback", handleCallback);

/**
 * Token Endpoint (RFC 6749)
 * POST /oauth/token
 *
 * Exchanges authorization codes for access tokens.
 * Also handles refresh token grants.
 */
oauthRoutes.post("/token", handleToken);

/**
 * Token Revocation (RFC 7009)
 * POST /oauth/revoke
 *
 * Revokes refresh tokens.
 */
oauthRoutes.post("/revoke", handleRevoke);
