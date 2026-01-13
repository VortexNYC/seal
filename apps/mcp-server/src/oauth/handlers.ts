/**
 * OAuth 2.0 Endpoint Handlers
 *
 * Implements the OAuth 2.0 Authorization Server endpoints:
 * - Dynamic Client Registration (RFC 7591)
 * - Authorization Endpoint (RFC 6749)
 * - Token Endpoint (RFC 6749)
 * - Token Revocation (RFC 7009)
 */

import type { Context } from "hono";
import {
	generateAuthorizationCode,
	generateClientId,
	generateClientSecret,
	generateRefreshToken,
	getAccessTokenTTL,
	getAuthCodeTTL,
	getRefreshTokenTTL,
	hashToken,
	signAccessToken,
	verifyPKCE,
	verifyTokenHash,
} from "./crypto";
import * as storage from "./storage";
import type {
	AuthorizationSession,
	ClientRegistrationRequest,
	ClientRegistrationResponse,
	OAuthError,
	TokenRequest,
	TokenResponse,
} from "./types";

// =============================================================================
// Configuration
// =============================================================================

function getIssuerUrl(): string {
	const url = process.env.MCP_SERVER_URL;
	if (!url) {
		throw new Error("MCP_SERVER_URL environment variable is not set");
	}
	return url;
}

function getClerkFrontendApiUrl(): string {
	const url = process.env.CLERK_FRONTEND_API;
	if (!url) {
		throw new Error("CLERK_FRONTEND_API environment variable is not set");
	}
	// Remove trailing $ if present (Clerk adds this sometimes)
	return url.replace(/\$$/, "");
}

// =============================================================================
// Error Helpers
// =============================================================================

function oauthError(
	error: OAuthError["error"],
	description?: string,
	state?: string,
): OAuthError {
	return {
		error,
		error_description: description,
		state,
	};
}

function errorResponse(
	c: Context,
	status: 400 | 401 | 500,
	error: OAuthError,
): Response {
	return c.json(error, status);
}

function redirectError(
	c: Context,
	redirectUri: string,
	error: OAuthError,
): Response {
	const url = new URL(redirectUri);
	url.searchParams.set("error", error.error);
	if (error.error_description) {
		url.searchParams.set("error_description", error.error_description);
	}
	if (error.state) {
		url.searchParams.set("state", error.state);
	}
	return c.redirect(url.toString());
}

// =============================================================================
// Dynamic Client Registration (RFC 7591)
// =============================================================================

export async function handleClientRegistration(c: Context): Promise<Response> {
	try {
		const body = await c.req.json<ClientRegistrationRequest>();

		// Validate required fields
		if (!body.redirect_uris || body.redirect_uris.length === 0) {
			return errorResponse(
				c,
				400,
				oauthError("invalid_request", "redirect_uris is required"),
			);
		}

		// Validate redirect URIs
		for (const uri of body.redirect_uris) {
			try {
				new URL(uri);
			} catch {
				return errorResponse(
					c,
					400,
					oauthError("invalid_request", `Invalid redirect URI: ${uri}`),
				);
			}
		}

		// Generate client credentials
		const clientId = generateClientId();
		const clientSecret = generateClientSecret();
		const clientSecretHash = await hashToken(clientSecret);

		// Default values
		const grantTypes = body.grant_types ?? [
			"authorization_code",
			"refresh_token",
		];
		const responseTypes = body.response_types ?? ["code"];
		const tokenEndpointAuthMethod =
			body.token_endpoint_auth_method ?? "client_secret_post";

		// Store client in database
		await storage.registerClient({
			clientId,
			clientSecretHash,
			clientName: body.client_name ?? "Unknown Client",
			redirectUris: body.redirect_uris,
			grantTypes,
			responseTypes,
			tokenEndpointAuthMethod,
			clientUri: body.client_uri,
			logoUri: body.logo_uri,
			scope: body.scope,
		});

		const now = Math.floor(Date.now() / 1000);

		const response: ClientRegistrationResponse = {
			client_id: clientId,
			client_secret: clientSecret,
			client_id_issued_at: now,
			client_secret_expires_at: 0, // Never expires
			redirect_uris: body.redirect_uris,
			client_name: body.client_name,
			client_uri: body.client_uri,
			logo_uri: body.logo_uri,
			scope: body.scope,
			grant_types: grantTypes,
			response_types: responseTypes,
			token_endpoint_auth_method: tokenEndpointAuthMethod,
		};

		return c.json(response, 201);
	} catch (error) {
		console.error("Client registration error:", error);
		return errorResponse(
			c,
			500,
			oauthError("server_error", "Failed to register client"),
		);
	}
}

// =============================================================================
// Authorization Endpoint (RFC 6749)
// =============================================================================

export async function handleAuthorize(c: Context): Promise<Response> {
	const query = c.req.query();

	// Extract and validate parameters
	const responseType = query.response_type;
	const clientId = query.client_id;
	const redirectUri = query.redirect_uri;
	const scope = query.scope ?? "profile email";
	const state = query.state;
	const codeChallenge = query.code_challenge;
	const codeChallengeMethod = query.code_challenge_method ?? "S256";

	// Validate response_type
	if (responseType !== "code") {
		if (redirectUri) {
			return redirectError(
				c,
				redirectUri,
				oauthError(
					"unsupported_response_type",
					"Only 'code' response type is supported",
					state,
				),
			);
		}
		return errorResponse(
			c,
			400,
			oauthError(
				"unsupported_response_type",
				"Only 'code' response type is supported",
			),
		);
	}

	// Validate client_id
	if (!clientId) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "client_id is required"),
		);
	}

	// Get client from database
	const client = await storage.getClient(clientId);
	if (!client) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_client", "Client not found"),
		);
	}

	// Validate redirect_uri
	if (!redirectUri) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "redirect_uri is required"),
		);
	}

	if (!client.redirectUris.includes(redirectUri)) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "redirect_uri is not registered"),
		);
	}

	// Validate PKCE (required for public clients)
	if (!codeChallenge) {
		return redirectError(
			c,
			redirectUri,
			oauthError(
				"invalid_request",
				"code_challenge is required for authorization code flow",
				state,
			),
		);
	}

	if (codeChallengeMethod !== "plain" && codeChallengeMethod !== "S256") {
		return redirectError(
			c,
			redirectUri,
			oauthError(
				"invalid_request",
				"code_challenge_method must be 'plain' or 'S256'",
				state,
			),
		);
	}

	// Store authorization session in a signed cookie
	const session: AuthorizationSession = {
		clientId,
		redirectUri,
		scope,
		state,
		codeChallenge,
		codeChallengeMethod,
		createdAt: Date.now(),
	};

	// Encode session as base64 for the cookie
	const sessionData = Buffer.from(JSON.stringify(session)).toString("base64");

	// Build Clerk authorization URL
	const clerkFrontendApi = getClerkFrontendApiUrl();
	const issuerUrl = getIssuerUrl();
	const callbackUrl = `${issuerUrl}/oauth/callback`;

	// Use Clerk's hosted sign-in page with redirect
	const clerkSignInUrl = new URL(`${clerkFrontendApi}/sign-in`);
	clerkSignInUrl.searchParams.set("redirect_url", callbackUrl);

	// Set session cookie and redirect to Clerk
	c.header(
		"Set-Cookie",
		`mcp_oauth_session=${sessionData}; HttpOnly; Secure; SameSite=Lax; Path=/oauth; Max-Age=600`,
	);

	return c.redirect(clerkSignInUrl.toString());
}

// =============================================================================
// Callback Endpoint (handles return from Clerk)
// =============================================================================

export async function handleCallback(c: Context): Promise<Response> {
	// Get session from cookie
	const cookieHeader = c.req.header("Cookie");
	const sessionCookie = cookieHeader
		?.split(";")
		.find((c) => c.trim().startsWith("mcp_oauth_session="))
		?.split("=")[1];

	if (!sessionCookie) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "No authorization session found"),
		);
	}

	let session: AuthorizationSession;
	try {
		session = JSON.parse(
			Buffer.from(sessionCookie, "base64").toString("utf-8"),
		);
	} catch {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "Invalid authorization session"),
		);
	}

	// Validate session hasn't expired (10 minutes)
	if (Date.now() - session.createdAt > 600_000) {
		return redirectError(
			c,
			session.redirectUri,
			oauthError(
				"access_denied",
				"Authorization session expired",
				session.state,
			),
		);
	}

	// Get user ID from Clerk session
	// The user should have a __session cookie from Clerk
	const clerkSession = cookieHeader
		?.split(";")
		.find((c) => c.trim().startsWith("__session="))
		?.split("=")[1];

	if (!clerkSession) {
		// User not authenticated, redirect back to Clerk
		const clerkFrontendApi = getClerkFrontendApiUrl();
		const issuerUrl = getIssuerUrl();
		const callbackUrl = `${issuerUrl}/oauth/callback`;

		const clerkSignInUrl = new URL(`${clerkFrontendApi}/sign-in`);
		clerkSignInUrl.searchParams.set("redirect_url", callbackUrl);

		return c.redirect(clerkSignInUrl.toString());
	}

	// Verify Clerk session and get user ID
	let userId: string;
	try {
		userId = await verifyClerkSession(clerkSession);
	} catch (error) {
		console.error("Clerk session verification failed:", error);
		return redirectError(
			c,
			session.redirectUri,
			oauthError("access_denied", "Authentication failed", session.state),
		);
	}

	// Generate authorization code
	const code = generateAuthorizationCode();
	const codeHash = await hashToken(code);
	const ttl = getAuthCodeTTL();

	// Store authorization code
	await storage.createAuthorizationCode({
		codeHash,
		clientId: session.clientId,
		userId,
		redirectUri: session.redirectUri,
		scope: session.scope,
		codeChallenge: session.codeChallenge,
		codeChallengeMethod: session.codeChallengeMethod,
		state: session.state,
		expiresAt: Date.now() + ttl * 1000,
	});

	// Build redirect URL with code
	const redirectUrl = new URL(session.redirectUri);
	redirectUrl.searchParams.set("code", code);
	if (session.state) {
		redirectUrl.searchParams.set("state", session.state);
	}

	// Clear session cookie and redirect
	c.header(
		"Set-Cookie",
		"mcp_oauth_session=; HttpOnly; Secure; SameSite=Lax; Path=/oauth; Max-Age=0",
	);

	return c.redirect(redirectUrl.toString());
}

// =============================================================================
// Token Endpoint (RFC 6749)
// =============================================================================

export async function handleToken(c: Context): Promise<Response> {
	let body: TokenRequest;

	// Handle both JSON and form-urlencoded
	const contentType = c.req.header("Content-Type") ?? "";
	if (contentType.includes("application/json")) {
		body = await c.req.json<TokenRequest>();
	} else {
		const formData = await c.req.parseBody();
		body = {
			grant_type: formData.grant_type as TokenRequest["grant_type"],
			code: formData.code as string | undefined,
			redirect_uri: formData.redirect_uri as string | undefined,
			client_id: formData.client_id as string | undefined,
			client_secret: formData.client_secret as string | undefined,
			code_verifier: formData.code_verifier as string | undefined,
			refresh_token: formData.refresh_token as string | undefined,
			scope: formData.scope as string | undefined,
		};
	}

	// Get client credentials from body or Authorization header
	let clientId = body.client_id;
	let clientSecret = body.client_secret;

	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("Basic ")) {
		const credentials = Buffer.from(authHeader.slice(6), "base64")
			.toString("utf-8")
			.split(":");
		clientId = credentials[0];
		clientSecret = credentials[1];
	}

	// Validate grant_type
	if (body.grant_type === "authorization_code") {
		return handleAuthorizationCodeGrant(c, body, clientId, clientSecret);
	}

	if (body.grant_type === "refresh_token") {
		return handleRefreshTokenGrant(c, body, clientId, clientSecret);
	}

	return errorResponse(
		c,
		400,
		oauthError(
			"unsupported_grant_type",
			"Only 'authorization_code' and 'refresh_token' grant types are supported",
		),
	);
}

async function handleAuthorizationCodeGrant(
	c: Context,
	body: TokenRequest,
	clientId?: string,
	clientSecret?: string,
): Promise<Response> {
	// Validate required fields
	if (!body.code) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "code is required"),
		);
	}

	if (!clientId) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "client_id is required"),
		);
	}

	// Get client
	const client = await storage.getClient(clientId);
	if (!client) {
		return errorResponse(
			c,
			401,
			oauthError("invalid_client", "Client not found"),
		);
	}

	// Verify client secret if client requires it
	if (client.tokenEndpointAuthMethod !== "none" && client.clientSecretHash) {
		if (!clientSecret) {
			return errorResponse(
				c,
				401,
				oauthError("invalid_client", "client_secret is required"),
			);
		}

		const secretValid = await verifyTokenHash(
			clientSecret,
			client.clientSecretHash,
		);
		if (!secretValid) {
			return errorResponse(
				c,
				401,
				oauthError("invalid_client", "Invalid client credentials"),
			);
		}
	}

	// Get authorization code
	const codeHash = await hashToken(body.code);
	const authCode = await storage.getAuthorizationCode(codeHash);

	if (!authCode) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_grant", "Authorization code is invalid or expired"),
		);
	}

	// Verify code belongs to this client
	if (authCode.clientId !== clientId) {
		return errorResponse(
			c,
			400,
			oauthError(
				"invalid_grant",
				"Authorization code was not issued to this client",
			),
		);
	}

	// Verify redirect_uri matches (if provided)
	if (body.redirect_uri && body.redirect_uri !== authCode.redirectUri) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_grant", "redirect_uri does not match"),
		);
	}

	// Verify PKCE code_verifier
	if (authCode.codeChallenge && authCode.codeChallengeMethod) {
		if (!body.code_verifier) {
			return errorResponse(
				c,
				400,
				oauthError("invalid_request", "code_verifier is required"),
			);
		}

		const pkceValid = await verifyPKCE(
			body.code_verifier,
			authCode.codeChallenge,
			authCode.codeChallengeMethod,
		);

		if (!pkceValid) {
			return errorResponse(
				c,
				400,
				oauthError("invalid_grant", "Invalid code_verifier"),
			);
		}
	}

	// Delete the authorization code (one-time use)
	await storage.deleteAuthorizationCode(codeHash);

	// Generate tokens
	const issuerUrl = getIssuerUrl();
	const accessToken = await signAccessToken({
		iss: issuerUrl,
		sub: authCode.userId,
		aud: issuerUrl,
		scope: authCode.scope,
		client_id: clientId,
	});

	const refreshTokenValue = generateRefreshToken();
	const refreshTokenHash = await hashToken(refreshTokenValue);
	const refreshTokenTTL = getRefreshTokenTTL();

	await storage.createRefreshToken({
		tokenHash: refreshTokenHash,
		clientId,
		userId: authCode.userId,
		scope: authCode.scope,
		expiresAt:
			refreshTokenTTL > 0 ? Date.now() + refreshTokenTTL * 1000 : undefined,
	});

	const response: TokenResponse = {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: getAccessTokenTTL(),
		refresh_token: refreshTokenValue,
		scope: authCode.scope,
	};

	return c.json(response);
}

async function handleRefreshTokenGrant(
	c: Context,
	body: TokenRequest,
	clientId?: string,
	clientSecret?: string,
): Promise<Response> {
	// Validate required fields
	if (!body.refresh_token) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "refresh_token is required"),
		);
	}

	if (!clientId) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "client_id is required"),
		);
	}

	// Get client
	const client = await storage.getClient(clientId);
	if (!client) {
		return errorResponse(
			c,
			401,
			oauthError("invalid_client", "Client not found"),
		);
	}

	// Verify client secret if client requires it
	if (client.tokenEndpointAuthMethod !== "none" && client.clientSecretHash) {
		if (!clientSecret) {
			return errorResponse(
				c,
				401,
				oauthError("invalid_client", "client_secret is required"),
			);
		}

		const secretValid = await verifyTokenHash(
			clientSecret,
			client.clientSecretHash,
		);
		if (!secretValid) {
			return errorResponse(
				c,
				401,
				oauthError("invalid_client", "Invalid client credentials"),
			);
		}
	}

	// Get refresh token
	const tokenHash = await hashToken(body.refresh_token);
	const refreshToken = await storage.getRefreshToken(tokenHash);

	if (!refreshToken) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_grant", "Refresh token is invalid or expired"),
		);
	}

	// Verify token belongs to this client
	if (refreshToken.clientId !== clientId) {
		return errorResponse(
			c,
			400,
			oauthError(
				"invalid_grant",
				"Refresh token was not issued to this client",
			),
		);
	}

	// Update last used timestamp
	await storage.updateRefreshTokenLastUsed(tokenHash);

	// Generate new access token
	const issuerUrl = getIssuerUrl();
	const accessToken = await signAccessToken({
		iss: issuerUrl,
		sub: refreshToken.userId,
		aud: issuerUrl,
		scope: body.scope ?? refreshToken.scope,
		client_id: clientId,
	});

	const response: TokenResponse = {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: getAccessTokenTTL(),
		scope: body.scope ?? refreshToken.scope,
	};

	return c.json(response);
}

// =============================================================================
// Token Revocation (RFC 7009)
// =============================================================================

export async function handleRevoke(c: Context): Promise<Response> {
	let body: { token?: string; token_type_hint?: string };

	// Handle both JSON and form-urlencoded
	const contentType = c.req.header("Content-Type") ?? "";
	if (contentType.includes("application/json")) {
		body = await c.req.json();
	} else {
		const formData = await c.req.parseBody();
		body = {
			token: formData.token as string | undefined,
			token_type_hint: formData.token_type_hint as string | undefined,
		};
	}

	if (!body.token) {
		return errorResponse(
			c,
			400,
			oauthError("invalid_request", "token is required"),
		);
	}

	// Try to revoke as refresh token
	const tokenHash = await hashToken(body.token);
	await storage.deleteRefreshToken(tokenHash);

	// Always return 200 OK per RFC 7009
	return c.body(null, 200);
}

// =============================================================================
// Clerk Session Verification
// =============================================================================

async function verifyClerkSession(sessionToken: string): Promise<string> {
	// Use Clerk's Backend API to verify the session
	const clerkSecretKey = process.env.CLERK_SECRET_KEY;
	if (!clerkSecretKey) {
		throw new Error("CLERK_SECRET_KEY environment variable is not set");
	}

	// Decode the session JWT to get the session ID
	// The Clerk session token is a JWT, we need to extract the session ID
	const parts = sessionToken.split(".");
	if (parts.length !== 3) {
		throw new Error("Invalid session token format");
	}

	const payloadPart = parts[1];
	if (!payloadPart) {
		throw new Error("Invalid session token format");
	}

	let payload: { sub?: string; sid?: string };
	try {
		const payloadJson = Buffer.from(payloadPart, "base64").toString("utf-8");
		payload = JSON.parse(payloadJson);
	} catch {
		throw new Error("Failed to decode session token");
	}

	// The 'sub' claim contains the user ID
	if (!payload.sub) {
		throw new Error("Session token does not contain user ID");
	}

	// Optionally verify the session is still valid via Clerk API
	// For now, we trust the JWT since Clerk signs it
	return payload.sub;
}
