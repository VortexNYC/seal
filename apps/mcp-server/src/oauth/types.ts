/**
 * OAuth 2.0 Types for MCP Server
 */

// ============================================================================
// Client Registration (RFC 7591)
// ============================================================================

export interface ClientRegistrationRequest {
	redirect_uris: string[];
	client_name?: string;
	client_uri?: string;
	logo_uri?: string;
	scope?: string;
	grant_types?: string[];
	response_types?: string[];
	token_endpoint_auth_method?: string;
}

export interface ClientRegistrationResponse {
	client_id: string;
	client_secret?: string;
	client_id_issued_at: number;
	client_secret_expires_at?: number;
	redirect_uris: string[];
	client_name?: string;
	client_uri?: string;
	logo_uri?: string;
	scope?: string;
	grant_types: string[];
	response_types: string[];
	token_endpoint_auth_method: string;
}

// ============================================================================
// Token Request
// ============================================================================

export interface TokenRequest {
	grant_type: "authorization_code" | "refresh_token";
	code?: string;
	redirect_uri?: string;
	client_id?: string;
	client_secret?: string;
	code_verifier?: string;
	refresh_token?: string;
	scope?: string;
}

export interface TokenResponse {
	access_token: string;
	token_type: "Bearer";
	expires_in: number;
	refresh_token?: string;
	scope?: string;
}

// ============================================================================
// OAuth Errors (RFC 6749)
// ============================================================================

export type OAuthErrorCode =
	| "invalid_request"
	| "invalid_client"
	| "invalid_grant"
	| "unauthorized_client"
	| "unsupported_grant_type"
	| "invalid_scope"
	| "access_denied"
	| "unsupported_response_type"
	| "server_error"
	| "temporarily_unavailable";

export interface OAuthError {
	error: OAuthErrorCode;
	error_description?: string;
	error_uri?: string;
	state?: string;
}

// ============================================================================
// JWT Claims
// ============================================================================

export interface AccessTokenPayload {
	iss: string; // Issuer (our server URL)
	sub: string; // Subject (Clerk user ID)
	aud: string; // Audience (our MCP endpoint)
	exp: number; // Expiration time
	iat: number; // Issued at
	scope: string; // Granted scopes
	client_id: string; // OAuth client ID
}

// ============================================================================
// Internal Types
// ============================================================================

export interface StoredClient {
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
	createdAt: number;
}

export interface StoredAuthorizationCode {
	codeHash: string;
	clientId: string;
	userId: string;
	redirectUri: string;
	scope: string;
	codeChallenge?: string;
	codeChallengeMethod?: string;
	state?: string;
	expiresAt: number;
	createdAt: number;
}

export interface StoredRefreshToken {
	tokenHash: string;
	clientId: string;
	userId: string;
	scope: string;
	expiresAt?: number;
	createdAt: number;
	lastUsedAt?: number;
}

// ============================================================================
// Authorization Session (stored in cookie/state during OAuth flow)
// ============================================================================

export interface AuthorizationSession {
	clientId: string;
	redirectUri: string;
	scope: string;
	state?: string;
	codeChallenge?: string;
	codeChallengeMethod?: string;
	createdAt: number;
}
