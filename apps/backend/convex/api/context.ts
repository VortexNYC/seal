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

// ---------------------------------------------------------------------------
// CIDR / IP allowlist utilities
// ---------------------------------------------------------------------------

/**
 * Parse an IPv4 address into a 32-bit number.
 * Returns null if the address is not valid IPv4.
 */
function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) return null;
    result = (result << 8) | num;
  }
  return result >>> 0; // Unsigned 32-bit
}

/**
 * Check if an IP address matches a CIDR range or exact IP.
 * Supports: "192.168.1.0/24", "10.0.0.1" (treated as /32).
 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  const trimmedCidr = cidr.trim();
  const [network = "", prefixStr] = trimmedCidr.split("/");
  const prefix = prefixStr ? Number(prefixStr) : 32;

  if (!network || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

  const ipNum = parseIpv4(ip);
  const networkNum = parseIpv4(network);
  if (ipNum === null || networkNum === null) return false;

  if (prefix === 0) return true; // /0 matches everything
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Check if an IP address is allowed by an allowlist of CIDR ranges.
 * Empty allowlist means all IPs are allowed.
 */
export function isIpAllowed(ip: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  return allowlist.some((cidr) => ipMatchesCidr(ip, cidr));
}

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
      throw new ApiError(500, "Clerk secret key not configured", "INTERNAL_ERROR");
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

type VerifiedApiKey = {
  id: string;
  name: string;
  subject: string;
  scopes?: string[];
  claims?: Record<string, unknown>;
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
  WEBHOOKS_MANAGE: "seal:webhooks:manage",
  MEMBERS_READ: "seal:members:read",
  SETTINGS_READ: "seal:settings:read",
  SETTINGS_WRITE: "seal:settings:write",
  AUDIT_READ: "seal:audit:read",
  CONTACTS_READ: "seal:contacts:read",
  CONTACTS_WRITE: "seal:contacts:write",
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
  [API_SCOPES.DOCUMENTS_WRITE]: ["documents:create", "documents:edit", "documents:delete"],
  [API_SCOPES.TEMPLATES_READ]: ["templates:view", "templates:read"],
  [API_SCOPES.TEMPLATES_WRITE]: ["templates:create", "templates:edit", "templates:delete"],
  [API_SCOPES.RECIPIENTS_READ]: ["documents:view"],
  [API_SCOPES.RECIPIENTS_WRITE]: ["documents:edit"],
  [API_SCOPES.SIGNATURES_READ]: ["documents:view", "audit:view"],
  [API_SCOPES.WEBHOOKS_MANAGE]: ["settings:integrations"],
  [API_SCOPES.MEMBERS_READ]: ["members:view"],
  [API_SCOPES.SETTINGS_READ]: ["settings:view"],
  [API_SCOPES.SETTINGS_WRITE]: ["settings:edit"],
  [API_SCOPES.AUDIT_READ]: ["audit:view"],
  [API_SCOPES.CONTACTS_READ]: ["contacts:view"],
  [API_SCOPES.CONTACTS_WRITE]: ["contacts:create", "contacts:edit", "contacts:delete"],
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
    throw new ApiError(401, "Missing Authorization header", "MISSING_AUTH_HEADER");
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

function isOAuthAccessToken(token: string): boolean {
  // Clerk OAuth access tokens start with "oat_"
  return token.startsWith("oat_");
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

async function verifyApiKey(token: string): Promise<VerifiedApiKey> {
  const clerk = getClerkClient();

  try {
    return await (
      clerk as unknown as {
        apiKeys: {
          verify: (value: string) => Promise<VerifiedApiKey>;
        };
      }
    ).apiKeys.verify(token);
  } catch (error) {
    console.error("[resolveApiAuth] Clerk verification failed:", error);
    throw new ApiError(401, "Invalid or expired API key", "INVALID_API_KEY");
  }
}

async function resolveOrganizationKeySubject(
  ctx: ActionCtx,
  apiKey: VerifiedApiKey,
): Promise<{
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  clerkUserId: string;
}> {
  const organization = await ctx.runQuery(internal.api.helpers.getOrgByClerkId, {
    clerkOrgId: apiKey.subject,
  });
  if (!organization) {
    throw new ApiError(403, "Organization not found", "ORGANIZATION_NOT_FOUND");
  }

  const creatorClerkId = apiKey.claims?.creator_user_id;
  if (typeof creatorClerkId === "string") {
    const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
      clerkUserId: creatorClerkId,
    });
    if (!user) {
      throw new ApiError(403, "API key creator not found", "USER_NOT_FOUND");
    }

    return {
      organizationId: organization._id,
      userId: user._id,
      clerkUserId: creatorClerkId,
    };
  }

  const owner = await ctx.runQuery(internal.api.helpers.getOrganizationOwner, {
    organizationId: organization._id,
  });
  if (!owner) {
    throw new ApiError(403, "Organization owner not found", "USER_NOT_FOUND");
  }

  return {
    organizationId: organization._id,
    userId: owner._id,
    clerkUserId: owner.clerkId,
  };
}

async function resolveUserKeySubject(
  ctx: ActionCtx,
  clerkUserId: string,
): Promise<{
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  clerkUserId: string;
}> {
  const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
    clerkUserId,
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

  return {
    organizationId: user.activeOrganizationId,
    userId: user._id,
    clerkUserId,
  };
}

function getOrgIdClaim(payload: ClerkJwtPayload): string | undefined {
  return typeof payload.org_id === "string"
    ? payload.org_id
    : typeof payload.orgId === "string"
      ? payload.orgId
      : undefined;
}

async function getOrganizationIdForJwt(
  ctx: ActionCtx,
  user: { activeOrganizationId?: Id<"organizations"> | null },
  orgIdClaim: string | undefined,
): Promise<Id<"organizations">> {
  if (orgIdClaim) {
    const organization = await ctx.runQuery(internal.api.helpers.getOrgByClerkId, {
      clerkOrgId: orgIdClaim,
    });
    if (!organization) {
      throw new ApiError(403, "Organization not found", "ORGANIZATION_NOT_FOUND");
    }
    return organization._id;
  }

  if (user.activeOrganizationId) {
    return user.activeOrganizationId;
  }

  throw new ApiError(
    403,
    "User has no active organization. Set an active organization before using the API.",
    "ORGANIZATION_ACCESS_DENIED",
  );
}

async function resolveOAuthAuthContext(
  ctx: ActionCtx,
  token: string,
  clientIp?: string,
): Promise<ApiAuthContext | null> {
  const oauthResult = await verifyOAuthAccessToken(token);
  if (!oauthResult) {
    return null;
  }

  const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
    clerkUserId: oauthResult.sub,
  });
  if (!user) {
    throw new ApiError(403, "User not found", "USER_NOT_FOUND");
  }

  let organizationId = user.activeOrganizationId;
  if (!organizationId) {
    const memberships = await ctx.runQuery(internal.api.helpers.getUserOrganizationMemberships, {
      userId: user._id,
    });

    if (memberships.length === 0) {
      throw new ApiError(
        403,
        "User has no organization memberships. Join or create an organization first.",
        "NO_ORGANIZATION",
      );
    }

    organizationId = memberships[0]!.organizationId;  // Length > 0 checked above
  }

  return buildAuthContext(ctx, {
    authType: "jwt",
    scopes: oauthResult.scopes,
    userId: user._id,
    organizationId,
    clerkUserId: oauthResult.sub,
    subjectType: "user",
    clientIp,
  });
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
    clientIp?: string;
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

  // Check if organization allows API access
  const securitySettings = await ctx.runQuery(
    internal.organizations.queries.getSecuritySettingsInternal,
    { organizationId: params.organizationId },
  );

  if (securitySettings.allowApiAccess === false) {
    throw new ApiError(
      403,
      "API access is disabled for this organization. An organization owner can enable it in Settings > Security.",
      "API_ACCESS_DISABLED",
    );
  }

  // Check IP allowlist
  const ipAllowlist = securitySettings.ipAllowlist;
  if (params.clientIp && Array.isArray(ipAllowlist) && ipAllowlist.length > 0) {
    if (!isIpAllowed(params.clientIp, ipAllowlist)) {
      throw new ApiError(
        403,
        "Your IP address is not in the organization's allowlist.",
        "IP_NOT_ALLOWED",
      );
    }
  }

  // Get user permissions
  const permissionInfo = await ctx.runQuery(internal.api.helpers.getUserPermissions, {
    userId: params.userId,
    organizationId: params.organizationId,
  });

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
  clientIp?: string,
): Promise<ApiAuthContext> {
  const token = parseBearerToken(authHeader);
  const apiKey = await verifyApiKey(token);
  const isOrgKey = apiKey.subject.startsWith("org_");
  const resolvedIdentity = isOrgKey
    ? await resolveOrganizationKeySubject(ctx, apiKey)
    : await resolveUserKeySubject(ctx, apiKey.subject);

  // Tier check: Free-tier organizations cannot use the API
  const { plan } = await ctx.runQuery(internal.auth.subscription_helpers.checkProFeature, {
    organizationId: resolvedIdentity.organizationId,
  });
  if (plan === "free") {
    throw new ApiError(403, "API access requires a Professional plan", "API_ACCESS_DISABLED");
  }

  return buildAuthContext(ctx, {
    authType: "api_key",
    apiKeyId: apiKey.id,
    apiKeyName: apiKey.name,
    scopes: apiKey.scopes ?? [],
    userId: resolvedIdentity.userId,
    organizationId: resolvedIdentity.organizationId,
    clerkUserId: resolvedIdentity.clerkUserId,
    subjectType: isOrgKey ? "organization" : "user",
    clientIp,
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
    console.error("[verifyOAuthAccessToken] No CLERK_SECRET_KEY configured");
    return null;
  }

  try {
    const response = await fetch("https://api.clerk.com/oauth_applications/access_tokens/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: token }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      subject?: string;
      scopes?: string[];
    };

    if (!data.subject) {
      return null;
    }

    return {
      sub: data.subject,
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
  clientIp?: string,
): Promise<ApiAuthContext> {
  const token = parseBearerToken(authHeader);

  const secretKey = process.env.CLERK_SECRET_KEY;
  const jwtKey = process.env.CLERK_JWT_KEY;
  if (!secretKey && !jwtKey) {
    throw new ApiError(500, "Clerk secret key or JWT key not configured", "INTERNAL_ERROR");
  }

  // First try session token verification (verifyToken throws on invalid tokens)
  // Skip for OAuth access tokens (oat_) which need direct OAuth verification
  let payload: ClerkJwtPayload | null = null;
  let sessionTokenError: unknown = null;

  if (!isOAuthAccessToken(token)) {
    try {
      payload = (await verifyToken(token, {
        secretKey,
        jwtKey,
      })) as ClerkJwtPayload;
    } catch (error) {
      sessionTokenError = error;
      // Session token verification failed - this is expected for OAuth tokens
    }
  }

  if (!payload) {
    const oauthAuthContext = await resolveOAuthAuthContext(ctx, token, clientIp);
    if (oauthAuthContext) {
      return oauthAuthContext;
    }

    console.error(
      "[resolveJwtAuth] Both session and OAuth verification failed:",
      sessionTokenError instanceof Error ? sessionTokenError.message : sessionTokenError,
    );
    throw new ApiError(401, "Invalid or expired token", "INVALID_JWT");
  }

  // Session token was valid
  const clerkUserId = typeof payload.sub === "string" ? payload.sub : undefined;
  if (!clerkUserId) {
    throw new ApiError(401, "Invalid session token subject", "INVALID_JWT");
  }

  const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
    clerkUserId,
  });

  if (!user) {
    throw new ApiError(403, "User not found", "USER_NOT_FOUND");
  }

  const organizationId = await getOrganizationIdForJwt(ctx, user, getOrgIdClaim(payload));

  return buildAuthContext(ctx, {
    authType: "jwt",
    scopes: extractScopesFromJwt(payload),
    userId: user._id,
    organizationId,
    clerkUserId,
    subjectType: "user",
    clientIp,
  });
}

export async function resolveAuthContext(
  ctx: ActionCtx,
  authHeader: string | null,
  clientIp?: string,
): Promise<ApiAuthContext> {
  const token = parseBearerToken(authHeader);

  // Route JWTs and OAuth access tokens (oat_) to JWT/OAuth auth handler
  if (isJwtToken(token) || isOAuthAccessToken(token)) {
    return resolveJwtAuth(ctx, token, clientIp);
  }

  // API keys go through API key verification
  return resolveApiAuth(ctx, token, clientIp);
}

/**
 * Checks if user's internal permissions satisfy the API scope.
 * Used for additional validation when needed beyond scope checking.
 *
 * @param userPermissions - Array of user's internal permissions
 * @param scope - The API scope to check
 * @returns Whether the user has permissions that satisfy the scope
 */
export function canUserUseScope(userPermissions: string[], scope: ApiScope): boolean {
  const requiredPerms = SCOPE_PERMISSION_MAP[scope];
  if (!requiredPerms) {
    return false;
  }
  return requiredPerms.some((perm) => userPermissions.includes(perm));
}

/**
 * Checks if a role has full access (owner or admin).
 * These roles should have all permissions regardless of explicit permission list.
 */
function isFullAccessRole(role: string): boolean {
  return role === "owner" || role === "admin";
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
    // Owners and admins have full access via OAuth
    if (isFullAccessRole(auth.role)) {
      return;
    }
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
    throw new ApiError(403, `Missing required scope: ${scope}`, "INSUFFICIENT_SCOPE");
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
export function requireAnyScope(auth: ApiAuthContext, scopes: ApiScope[]): void {
  if (auth.authType === "jwt") {
    // Owners and admins have full access via OAuth
    if (isFullAccessRole(auth.role)) {
      return;
    }
    const hasPermission = scopes.some((scope) => canUserUseScope(auth.permissions, scope));
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
