/**
 * OAuth Storage Client
 *
 * Provides access to OAuth data stored in Convex via HTTP endpoints.
 * All operations are secured by MCP_INTERNAL_SECRET.
 */

import type {
	StoredAuthorizationCode,
	StoredClient,
	StoredRefreshToken,
} from "./types";

// =============================================================================
// Configuration
// =============================================================================

function getConvexUrl(): string {
	const url = process.env.CONVEX_SITE_URL;
	if (!url) {
		throw new Error("CONVEX_SITE_URL environment variable is not set");
	}
	return url;
}

function getInternalSecret(): string {
	const secret = process.env.MCP_INTERNAL_SECRET;
	if (!secret) {
		throw new Error("MCP_INTERNAL_SECRET environment variable is not set");
	}
	return secret;
}

// =============================================================================
// HTTP Client
// =============================================================================

interface StorageError {
	error: string;
}

async function request<T>(
	method: string,
	path: string,
	options?: {
		query?: Record<string, string>;
		body?: unknown;
	},
): Promise<T> {
	const baseUrl = getConvexUrl();
	const secret = getInternalSecret();

	const url = new URL(`${baseUrl}${path}`);
	if (options?.query) {
		for (const [key, value] of Object.entries(options.query)) {
			url.searchParams.set(key, value);
		}
	}

	const response = await fetch(url.toString(), {
		method,
		headers: {
			Authorization: `Bearer ${secret}`,
			"Content-Type": "application/json",
		},
		body: options?.body ? JSON.stringify(options.body) : undefined,
	});

	if (!response.ok) {
		const error = (await response.json()) as StorageError;
		throw new Error(error.error || `HTTP ${response.status}`);
	}

	return (await response.json()) as T;
}

// =============================================================================
// Client Operations
// =============================================================================

interface RegisterClientInput {
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
}

interface RegisterClientResult {
	clientDocId: string;
}

export async function registerClient(
	input: RegisterClientInput,
): Promise<RegisterClientResult> {
	return request<RegisterClientResult>("POST", "/mcp-oauth/clients", {
		body: input,
	});
}

interface ConvexStoredClient {
	_id: string;
	_creationTime: number;
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

export async function getClient(
	clientId: string,
): Promise<StoredClient | null> {
	try {
		const result = await request<ConvexStoredClient>(
			"GET",
			"/mcp-oauth/clients",
			{
				query: { clientId },
			},
		);

		// Convert Convex format to our format
		return {
			clientId: result.clientId,
			clientSecretHash: result.clientSecretHash,
			clientName: result.clientName,
			redirectUris: result.redirectUris,
			grantTypes: result.grantTypes,
			responseTypes: result.responseTypes,
			tokenEndpointAuthMethod: result.tokenEndpointAuthMethod,
			clientUri: result.clientUri,
			logoUri: result.logoUri,
			scope: result.scope,
			createdAt: result.createdAt,
		};
	} catch (error) {
		if (error instanceof Error && error.message.includes("not found")) {
			return null;
		}
		throw error;
	}
}

// =============================================================================
// Authorization Code Operations
// =============================================================================

interface CreateAuthCodeInput {
	codeHash: string;
	clientId: string;
	userId: string;
	redirectUri: string;
	scope: string;
	codeChallenge?: string;
	codeChallengeMethod?: string;
	state?: string;
	expiresAt: number;
}

interface CreateAuthCodeResult {
	codeDocId: string;
}

export async function createAuthorizationCode(
	input: CreateAuthCodeInput,
): Promise<CreateAuthCodeResult> {
	return request<CreateAuthCodeResult>("POST", "/mcp-oauth/codes", {
		body: input,
	});
}

interface ConvexStoredAuthCode {
	_id: string;
	_creationTime: number;
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

export async function getAuthorizationCode(
	codeHash: string,
): Promise<StoredAuthorizationCode | null> {
	try {
		const result = await request<ConvexStoredAuthCode>(
			"GET",
			"/mcp-oauth/codes",
			{
				query: { codeHash },
			},
		);

		return {
			codeHash: result.codeHash,
			clientId: result.clientId,
			userId: result.userId,
			redirectUri: result.redirectUri,
			scope: result.scope,
			codeChallenge: result.codeChallenge,
			codeChallengeMethod: result.codeChallengeMethod,
			state: result.state,
			expiresAt: result.expiresAt,
			createdAt: result.createdAt,
		};
	} catch (error) {
		if (
			error instanceof Error &&
			(error.message.includes("not found") || error.message.includes("expired"))
		) {
			return null;
		}
		throw error;
	}
}

interface DeleteAuthCodeResult {
	deleted: boolean;
}

export async function deleteAuthorizationCode(
	codeHash: string,
): Promise<boolean> {
	const result = await request<DeleteAuthCodeResult>(
		"DELETE",
		"/mcp-oauth/codes",
		{
			query: { codeHash },
		},
	);
	return result.deleted;
}

// =============================================================================
// Refresh Token Operations
// =============================================================================

interface CreateRefreshTokenInput {
	tokenHash: string;
	clientId: string;
	userId: string;
	scope: string;
	expiresAt?: number;
}

interface CreateRefreshTokenResult {
	tokenDocId: string;
}

export async function createRefreshToken(
	input: CreateRefreshTokenInput,
): Promise<CreateRefreshTokenResult> {
	return request<CreateRefreshTokenResult>(
		"POST",
		"/mcp-oauth/refresh-tokens",
		{
			body: input,
		},
	);
}

interface ConvexStoredRefreshToken {
	_id: string;
	_creationTime: number;
	tokenHash: string;
	clientId: string;
	userId: string;
	scope: string;
	expiresAt?: number;
	createdAt: number;
	lastUsedAt?: number;
}

export async function getRefreshToken(
	tokenHash: string,
): Promise<StoredRefreshToken | null> {
	try {
		const result = await request<ConvexStoredRefreshToken>(
			"GET",
			"/mcp-oauth/refresh-tokens",
			{
				query: { tokenHash },
			},
		);

		return {
			tokenHash: result.tokenHash,
			clientId: result.clientId,
			userId: result.userId,
			scope: result.scope,
			expiresAt: result.expiresAt,
			createdAt: result.createdAt,
			lastUsedAt: result.lastUsedAt,
		};
	} catch (error) {
		if (
			error instanceof Error &&
			(error.message.includes("not found") || error.message.includes("expired"))
		) {
			return null;
		}
		throw error;
	}
}

interface UpdateRefreshTokenResult {
	updated: boolean;
}

export async function updateRefreshTokenLastUsed(
	tokenHash: string,
): Promise<boolean> {
	const result = await request<UpdateRefreshTokenResult>(
		"PUT",
		"/mcp-oauth/refresh-tokens",
		{
			body: { tokenHash },
		},
	);
	return result.updated;
}

interface DeleteRefreshTokenResult {
	deleted: boolean;
}

export async function deleteRefreshToken(tokenHash: string): Promise<boolean> {
	const result = await request<DeleteRefreshTokenResult>(
		"DELETE",
		"/mcp-oauth/refresh-tokens",
		{
			query: { tokenHash },
		},
	);
	return result.deleted;
}
