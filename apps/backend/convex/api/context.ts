/**
 * @fileoverview API Context Bridge - Translates Clerk API key auth to internal context.
 * Enables API endpoints to leverage existing RLS and permission systems.
 *
 * This module bridges the gap between Clerk's API key authentication and
 * Convex's internal user/organization context. HTTP actions don't have
 * access to `ctx.auth`, so we need to manually resolve the API key to
 * internal IDs.
 *
 * @module api/context
 * @see {@link https://clerk.com/docs/guides/development/machine-auth/api-keys} Clerk API Keys
 */

import { createClerkClient, verifyToken } from "@clerk/backend";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { ApiError } from "./errors";

/**
 * Clerk client instance for API key operations.
 * Created lazily on first use.
 */
let clerkClient: ReturnType<typeof createClerkClient> | null = null;

/**
 * Gets or creates the Clerk client instance.
 */
function getClerkClient(): ReturnType<typeof createClerkClient> {
	if (!clerkClient) {
		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!secretKey) {
			throw new ApiError(
				500,
				"Clerk secret key not configured",
				"INTERNAL_ERROR",
			);
		}
		clerkClient = createClerkClient({ secretKey });
	}
	return clerkClient;
}

/**
 * API-specific authentication context.
 * Bridges Clerk API key to internal user/org context.
 *
 * @interface ApiAuthContext
 */
export type ApiAuthType = "api_key" | "jwt";

type ClerkJwtPayload = Record<string, unknown> & {
	sub?: string;
	org_id?: string;
	orgId?: string;
	scope?: string;
	scp?: string[];
};

export interface ApiAuthContext {
	/** Which auth mechanism was used */
	authType: ApiAuthType;

	/** Clerk API key ID (ak_xxx format) */
	apiKeyId?: string;

	/** User-provided key name */
	apiKeyName?: string;

	/** Scopes from the auth token (API key or JWT) */
	scopes: string[];

	/** Internal Convex user ID (resolved from Clerk subject) */
	userId: Id<"users">;

	/** Internal Convex organization ID */
	organizationId: Id<"organizations">;

	/** Clerk user ID (subject) */
	clerkUserId: string;

	/** Whether the key is org-scoped or user-scoped */
	subjectType: "user" | "organization";

	/** User's role in the organization */
	role: string;

	/** User's permissions in the organization */
	permissions: string[];

	/**
	 * Check if the API key has a specific scope.
	 * @param scope - The scope to check (e.g., "seal:documents:read")
	 */
	hasScope: (scope: string) => boolean;

	/**
	 * Check if the API key has any of the given scopes.
	 * @param scopes - Array of scopes to check
	 */
	hasAnyScope: (scopes: string[]) => boolean;

	/**
	 * Check if the API key has all of the given scopes.
	 * @param scopes - Array of scopes to check
	 */
	hasAllScopes: (scopes: string[]) => boolean;

	/**
	 * Check if the user has a specific internal permission.
	 * @param permission - The permission to check (e.g., "documents:view")
	 */
	hasPermission: (permission: string) => boolean;
}

/**
 * Seal API scopes for external integrations.
 * These must be configured in the Clerk Dashboard.
 *
 * @constant
 * @description
 * Scopes follow the pattern: seal:<resource>:<action>
 * - seal:documents:read - Read document metadata and content
 * - seal:documents:write - Create, update, delete documents
 * - seal:templates:read - Read template metadata and fields
 * - seal:templates:write - Create, update, delete templates
 * - seal:recipients:read - Read recipient information
 * - seal:recipients:write - Manage document recipients
 * - seal:signatures:read - Read signature data
 */
export const API_SCOPES = {
	DOCUMENTS_READ: "seal:documents:read",
	DOCUMENTS_WRITE: "seal:documents:write",
	TEMPLATES_READ: "seal:templates:read",
	TEMPLATES_WRITE: "seal:templates:write",
	RECIPIENTS_READ: "seal:recipients:read",
	RECIPIENTS_WRITE: "seal:recipients:write",
	SIGNATURES_READ: "seal:signatures:read",
} as const;

export type ApiScope = (typeof API_SCOPES)[keyof typeof API_SCOPES];

/**
 * Maps API scopes to internal permission requirements.
 * API scopes are coarser-grained than internal permissions.
 *
 * @constant
 */
export const SCOPE_PERMISSION_MAP: Record<ApiScope, string[]> = {
	[API_SCOPES.DOCUMENTS_READ]: ["documents:view"],
	[API_SCOPES.DOCUMENTS_WRITE]: [
		"documents:create",
		"documents:edit",
		"documents:delete",
	],
	[API_SCOPES.TEMPLATES_READ]: ["templates:view", "templates:read"],
	[API_SCOPES.TEMPLATES_WRITE]: [
		"templates:create",
		"templates:edit",
		"templates:delete",
	],
	[API_SCOPES.RECIPIENTS_READ]: ["documents:view"],
	[API_SCOPES.RECIPIENTS_WRITE]: ["documents:edit"],
	[API_SCOPES.SIGNATURES_READ]: ["documents:view", "audit:view"],
};

/**
 * Resolves API key authentication to internal context.
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Verify API key with Clerk
 * 3. Resolve Clerk subject to internal user/org IDs
 * 4. Validate user has active membership in target organization
 * 5. Return context with scope helpers
 *
 * @param ctx - Convex action context
 * @param authHeader - Authorization header value (e.g., "Bearer sk_xxx")
 * @returns ApiAuthContext - Resolved authentication context
 * @throws {ApiError} 401 - Invalid/missing API key
 * @throws {ApiError} 403 - User not found or no active organization
 *
 * @example
 * ```typescript
 * export const listDocuments = httpAction(async (ctx, request) => {
 *   const auth = await resolveApiAuth(ctx, request.headers.get("Authorization"));
 *
 *   if (!auth.hasScope("seal:documents:read")) {
 *     return apiErrorResponse(403, "Missing required scope", "INSUFFICIENT_SCOPE");
 *   }
 *
 *   // Use auth.userId and auth.organizationId for queries
 *   const documents = await ctx.runQuery(internal.api.v1.documents.list, {
 *     organizationId: auth.organizationId,
 *     userId: auth.userId,
 *   });
 * });
 * ```
 */
function parseBearerToken(authHeader: string | null): string {
	if (!authHeader) {
		throw new ApiError(
			401,
			"Missing Authorization header",
			"MISSING_AUTH_HEADER",
		);
	}

	const [scheme, token] = authHeader.split(" ");
	if (token && scheme?.toLowerCase() === "bearer") {
		return token;
	}

	if (!authHeader.includes(" ")) {
		return authHeader;
	}

	throw new ApiError(
		401,
		"Invalid Authorization format. Use: Bearer <token>",
		"INVALID_AUTH_FORMAT",
	);
}

function isJwtToken(token: string): boolean {
	return token.split(".").length === 3;
}

function extractScopesFromJwt(payload: ClerkJwtPayload): string[] {
	const scope = payload.scope;
	if (typeof scope === "string") {
		return scope.split(" ").filter(Boolean);
	}

	const scp = payload.scp;
	if (Array.isArray(scp) && scp.every((value) => typeof value === "string")) {
		return scp;
	}

	return [];
}

async function buildAuthContext(
	ctx: ActionCtx,
	params: {
		authType: ApiAuthType;
		apiKeyId?: string;
		apiKeyName?: string;
		scopes: string[];
		userId: Id<"users">;
		organizationId: Id<"organizations">;
		clerkUserId: string;
		subjectType: "user" | "organization";
	},
): Promise<ApiAuthContext> {
	// Step 4: Validate user has active membership in the organization
	const membership = await ctx.runQuery(internal.api.helpers.getMembership, {
		userId: params.userId,
		organizationId: params.organizationId,
	});

	if (!membership || membership.status !== "active") {
		throw new ApiError(
			403,
			"User is not an active member of the organization",
			"ORGANIZATION_ACCESS_DENIED",
		);
	}

	// Get user permissions
	const permissionInfo = await ctx.runQuery(
		internal.api.helpers.getUserPermissions,
		{ userId: params.userId, organizationId: params.organizationId },
	);

	const role = permissionInfo?.role ?? "member";
	const permissions = permissionInfo?.permissions ?? [];

	return {
		authType: params.authType,
		apiKeyId: params.apiKeyId,
		apiKeyName: params.apiKeyName,
		scopes: params.scopes,
		userId: params.userId,
		organizationId: params.organizationId,
		clerkUserId: params.clerkUserId,
		subjectType: params.subjectType,
		role,
		permissions,
		hasScope: (scope: string) => params.scopes.includes(scope),
		hasAnyScope: (checkScopes: string[]) =>
			checkScopes.some((scope) => params.scopes.includes(scope)),
		hasAllScopes: (checkScopes: string[]) =>
			checkScopes.every((scope) => params.scopes.includes(scope)),
		hasPermission: (permission: string) => permissions.includes(permission),
	};
}

export async function resolveApiAuth(
	ctx: ActionCtx,
	authHeader: string | null,
): Promise<ApiAuthContext> {
	// Step 1: Extract Bearer token
	const token = parseBearerToken(authHeader);

	// Step 2: Verify API key with Clerk
	const clerk = getClerkClient();
	let apiKey: {
		id: string;
		name: string;
		subject: string;
		scopes?: string[];
		claims?: Record<string, unknown>;
	};

	try {
		// Note: Clerk API Keys is in beta, so the types may not be complete
		// We use the verify method which returns the API key details
		const verifyResult = await (
			clerk as unknown as {
				apiKeys: {
					verify: (token: string) => Promise<{
						id: string;
						name: string;
						subject: string;
						scopes?: string[];
						claims?: Record<string, unknown>;
					}>;
				};
			}
		).apiKeys.verify(token);
		apiKey = verifyResult;
	} catch (error) {
		console.error("[resolveApiAuth] Clerk verification failed:", error);
		throw new ApiError(401, "Invalid or expired API key", "INVALID_API_KEY");
	}

	const clerkSubject = apiKey.subject;
	const isOrgKey = clerkSubject.startsWith("org_");

	// Step 3: Resolve to internal user and organization
	let userId: Id<"users">;
	let organizationId: Id<"organizations">;
	let clerkUserId: string;

	if (isOrgKey) {
		// Organization-scoped API key
		const org = await ctx.runQuery(internal.api.helpers.getOrgByClerkId, {
			clerkOrgId: clerkSubject,
		});

		if (!org) {
			throw new ApiError(
				403,
				"Organization not found",
				"ORGANIZATION_NOT_FOUND",
			);
		}

		organizationId = org._id;

		// For org keys, get the creator user from claims or use org owner
		const creatorClerkId = apiKey.claims?.creator_user_id as string | undefined;

		if (creatorClerkId) {
			// Use the specific creator user
			const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
				clerkUserId: creatorClerkId,
			});

			if (!user) {
				throw new ApiError(403, "API key creator not found", "USER_NOT_FOUND");
			}

			userId = user._id;
			clerkUserId = creatorClerkId;
		} else {
			// Fall back to organization owner
			const owner = await ctx.runQuery(
				internal.api.helpers.getOrganizationOwner,
				{ organizationId },
			);

			if (!owner) {
				throw new ApiError(
					403,
					"Organization owner not found",
					"USER_NOT_FOUND",
				);
			}

			userId = owner._id;
			clerkUserId = owner.clerkId;
		}
	} else {
		// User-scoped API key
		clerkUserId = clerkSubject;

		const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
			clerkUserId: clerkSubject,
		});

		if (!user) {
			throw new ApiError(403, "User not found", "USER_NOT_FOUND");
		}

		userId = user._id;

		// Use user's active organization
		if (!user.activeOrganizationId) {
			throw new ApiError(
				403,
				"User has no active organization. Set an active organization before using the API.",
				"ORGANIZATION_ACCESS_DENIED",
			);
		}

		organizationId = user.activeOrganizationId;
	}

	// Step 4: Build context with scope helpers
	const scopes = apiKey.scopes ?? [];

	return buildAuthContext(ctx, {
		authType: "api_key",
		apiKeyId: apiKey.id,
		apiKeyName: apiKey.name,
		scopes,
		userId,
		organizationId,
		clerkUserId,
		subjectType: isOrgKey ? "organization" : "user",
	});
}

/**
 * Verifies an OAuth access token using Clerk's REST API.
 * OAuth tokens from MCP clients need different verification than session JWTs.
 */
async function verifyOAuthAccessToken(token: string): Promise<{
	sub: string;
	scopes: string[];
} | null> {
	const secretKey = process.env.CLERK_SECRET_KEY;
	if (!secretKey) {
		return null;
	}

	try {
		const response = await fetch(
			"https://api.clerk.com/oauth_applications/access_tokens/verify",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${secretKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ access_token: token }),
			},
		);

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as {
			sub?: string;
			scopes?: string[];
		};

		if (!data.sub) {
			return null;
		}

		return {
			sub: data.sub,
			scopes: data.scopes ?? [],
		};
	} catch (error) {
		console.error("[verifyOAuthAccessToken] Verification failed:", error);
		return null;
	}
}

export async function resolveJwtAuth(
	ctx: ActionCtx,
	authHeader: string | null,
): Promise<ApiAuthContext> {
	const token = parseBearerToken(authHeader);

	const secretKey = process.env.CLERK_SECRET_KEY;
	const jwtKey = process.env.CLERK_JWT_KEY;
	if (!secretKey && !jwtKey) {
		throw new ApiError(
			500,
			"Clerk secret key or JWT key not configured",
			"INTERNAL_ERROR",
		);
	}

	// First try session token verification
	const verification = (await verifyToken(token, {
		secretKey,
		jwtKey,
	})) as { data?: ClerkJwtPayload; errors?: unknown[] };

	// If session token verification fails, try OAuth access token
	if (!verification.data) {
		const oauthResult = await verifyOAuthAccessToken(token);
		if (oauthResult) {
			// OAuth token verified - resolve user and build context
			const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
				clerkUserId: oauthResult.sub,
			});

			if (!user) {
				throw new ApiError(403, "User not found", "USER_NOT_FOUND");
			}

			if (!user.activeOrganizationId) {
				throw new ApiError(
					403,
					"User has no active organization. Set an active organization before using the API.",
					"ORGANIZATION_ACCESS_DENIED",
				);
			}

			return buildAuthContext(ctx, {
				authType: "jwt",
				scopes: oauthResult.scopes,
				userId: user._id,
				organizationId: user.activeOrganizationId,
				clerkUserId: oauthResult.sub,
				subjectType: "user",
			});
		}

		const [error] = verification.errors ?? [];
		console.error("[resolveJwtAuth] Clerk verification failed:", error);
		throw new ApiError(401, "Invalid or expired token", "INVALID_JWT");
	}

	const payload = verification.data;
	const clerkUserId = typeof payload.sub === "string" ? payload.sub : undefined;
	if (!clerkUserId) {
		throw new ApiError(401, "Invalid session token subject", "INVALID_JWT");
	}

	const orgIdClaim =
		typeof payload.org_id === "string"
			? payload.org_id
			: typeof payload.orgId === "string"
				? payload.orgId
				: undefined;

	const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
		clerkUserId,
	});

	if (!user) {
		throw new ApiError(403, "User not found", "USER_NOT_FOUND");
	}

	let organizationId: Id<"organizations"> | null = null;
	if (orgIdClaim) {
		const org = await ctx.runQuery(internal.api.helpers.getOrgByClerkId, {
			clerkOrgId: orgIdClaim,
		});

		if (!org) {
			throw new ApiError(
				403,
				"Organization not found",
				"ORGANIZATION_NOT_FOUND",
			);
		}

		organizationId = org._id;
	} else if (user.activeOrganizationId) {
		organizationId = user.activeOrganizationId;
	}

	if (!organizationId) {
		throw new ApiError(
			403,
			"User has no active organization. Set an active organization before using the API.",
			"ORGANIZATION_ACCESS_DENIED",
		);
	}

	const scopes = extractScopesFromJwt(payload);

	return buildAuthContext(ctx, {
		authType: "jwt",
		scopes,
		userId: user._id,
		organizationId,
		clerkUserId,
		subjectType: "user",
	});
}

export async function resolveAuthContext(
	ctx: ActionCtx,
	authHeader: string | null,
): Promise<ApiAuthContext> {
	const token = parseBearerToken(authHeader);
	if (isJwtToken(token)) {
		return resolveJwtAuth(ctx, token);
	}

	return resolveApiAuth(ctx, token);
}

/**
 * Checks if user's internal permissions satisfy the API scope.
 * Used for additional validation when needed beyond scope checking.
 *
 * @param userPermissions - Array of user's internal permissions
 * @param scope - The API scope to check
 * @returns Whether the user has permissions that satisfy the scope
 */
export function canUserUseScope(
	userPermissions: string[],
	scope: ApiScope,
): boolean {
	const requiredPerms = SCOPE_PERMISSION_MAP[scope];
	if (!requiredPerms) {
		return false;
	}
	return requiredPerms.some((perm) => userPermissions.includes(perm));
}

/**
 * Validates that the API context has the required scope.
 * Throws an ApiError if the scope is missing.
 *
 * @param auth - The API auth context
 * @param scope - The required scope
 * @throws {ApiError} 403 - If scope is missing
 */
export function requireScope(auth: ApiAuthContext, scope: ApiScope): void {
	if (auth.authType === "jwt") {
		if (!canUserUseScope(auth.permissions, scope)) {
			throw new ApiError(
				403,
				`Missing required permission for scope: ${scope}`,
				"INSUFFICIENT_SCOPE",
			);
		}
		return;
	}

	if (!auth.hasScope(scope)) {
		throw new ApiError(
			403,
			`Missing required scope: ${scope}`,
			"INSUFFICIENT_SCOPE",
		);
	}
}

/**
 * Validates that the API context has at least one of the required scopes.
 * Throws an ApiError if none of the scopes are present.
 *
 * @param auth - The API auth context
 * @param scopes - Array of acceptable scopes
 * @throws {ApiError} 403 - If no scope matches
 */
export function requireAnyScope(
	auth: ApiAuthContext,
	scopes: ApiScope[],
): void {
	if (auth.authType === "jwt") {
		const hasPermission = scopes.some((scope) =>
			canUserUseScope(auth.permissions, scope),
		);
		if (!hasPermission) {
			throw new ApiError(
				403,
				`Missing required permission. Need one of: ${scopes.join(", ")}`,
				"INSUFFICIENT_SCOPE",
			);
		}
		return;
	}

	if (!auth.hasAnyScope(scopes)) {
		throw new ApiError(
			403,
			`Missing required scope. Need one of: ${scopes.join(", ")}`,
			"INSUFFICIENT_SCOPE",
		);
	}
}
