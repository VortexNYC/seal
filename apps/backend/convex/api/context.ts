/**
 * @fileoverview API Context Bridge — resolves an inbound `/api/v1` bearer token
 * to an internal user/organization auth context. HTTP actions don't have
 * access to `ctx.auth`, so we resolve credentials manually.
 *
 * Two credential types are accepted, both fully on `@plasmapos/vortex-auth`:
 *  - **API keys** (non-JWT bearer) → the vortexAuth component (`resolveApiAuth`).
 *  - **MCP OAuth access tokens** (ES256 JWT issued by this deployment's
 *    Better-Auth MCP OAuth server) → the package MCP resolver
 *    (`resolveMcpApiAuth` → `resolveMcpAuth`). MCP clients ride the same
 *    `/api/v1` resource server; there is no separate tool surface to maintain.
 *
 * No Clerk. The legacy Clerk session-JWT / OAuth (`oat_`) verification path was
 * removed once the web app moved to Better-Auth and MCP moved to the package
 * OAuth server — nothing sends Clerk tokens to `/api/v1` anymore.
 *
 * @module api/context
 */

import {
  createBetterAuthApiTokenVerifierFromConvexAuthConfig,
  createConvexAuthConfig,
} from "@plasmapos/vortex-auth/better-auth";
import {
  ApiAuthError,
  createConvexApiAuthLookupAdapter,
  type McpSessionLike,
  resolveAuthorizedApiAuthContext,
  resolveLinkedBetterAuthMcpSession,
  resolveStoredApiKeyCredential,
} from "@plasmapos/vortex-auth/convex";
import {
  buildBetterAuthTokenIdentifier,
  getBetterAuthIdentityProvider,
} from "../lib/authIdentities";

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
  const [network, prefixStr] = trimmedCidr.split("/");
  const prefix = prefixStr ? Number(prefixStr) : 32;

  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

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
 * API-specific authentication context.
 *
 * @interface ApiAuthContext
 */
export type ApiAuthType = "api_key" | "mcp_oauth";

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
 * MCP OAuth audience + resource identifiers for this deployment's Better-Auth
 * MCP OAuth server. Defined here (next to `API_SCOPES`, the leaf the MCP modules
 * already import from) so `mcpOAuth.ts` can re-export them without a cycle back
 * into this module.
 */
export const MCP_OAUTH_AUDIENCE = "seal-mcp";
export const MCP_OAUTH_RESOURCE_ID = "seal:mcp";

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

  // Verify against the vortexAuth COMPONENT (prefix lookup + secret hash +
  // status/expiry), replacing Clerk's apiKeys.verify. The component key maps
  // back to Seal org/user anchors via the internal query.
  const result = await resolveStoredApiKeyCredential({
    token,
    findByKeyPrefix: async (keyPrefix) =>
      await ctx.runQuery(internal.api_keys.keys.getApiKeyByPrefix, { keyPrefix }),
  });
  if (!result.ok) {
    throw new ApiError(401, "Invalid or expired API key", "INVALID_API_KEY");
  }
  const apiKey = result.apiKey;

  // Tier check: Free-tier organizations cannot use the API
  const { plan } = await ctx.runQuery(internal.auth.subscription_helpers.checkProFeature, {
    organizationId: apiKey.organizationId,
  });
  if (plan === "free") {
    throw new ApiError(403, "API access requires a Professional plan", "API_ACCESS_DISABLED");
  }

  return buildAuthContext(ctx, {
    authType: "api_key",
    apiKeyId: apiKey._id,
    apiKeyName: apiKey.name,
    scopes: apiKey.scopes,
    userId: apiKey.userId,
    organizationId: apiKey.organizationId,
    clerkUserId: apiKey.clerkUserId,
    subjectType: "user",
    clientIp,
  });
}

/**
 * Resolves an MCP OAuth access token (ES256 JWT issued by this deployment's
 * Better-Auth MCP OAuth server) to an internal `ApiAuthContext`.
 *
 * Flow (all `@plasmapos/vortex-auth`, no Clerk):
 * 1. Verify the token signature/claims via the deployment's stored JWKS
 *    (`mcpOAuthNode.verifyAccessToken`), bound to the MCP audience.
 * 2. Link the Better-Auth subject → Seal user + active org and authorize org
 *    access via the package MCP resolver (`resolveMcpAuth`).
 * 3. Re-run the shared org-security gating (active membership, `allowApiAccess`,
 *    IP allowlist) via `buildAuthContext`, so MCP access obeys the exact same
 *    org controls as API keys.
 */
async function resolveMcpApiAuth(
  ctx: ActionCtx,
  token: string,
  clientIp?: string,
): Promise<ApiAuthContext> {
  // verifyAccessToken throws on malformed / bad-signature / wrong-audience
  // tokens. Any such failure is an auth failure (401), not a server error (500).
  let verified: {
    azp: string | null;
    betterAuthUserId: string | null;
    orgId: string | null;
    scope: string;
  };
  try {
    verified = await ctx.runAction(internal.mcpOAuthNode.verifyAccessToken, {
      accessToken: token,
      audience: MCP_OAUTH_AUDIENCE,
    });
  } catch {
    throw new ApiError(401, "Invalid or expired token", "INVALID_JWT");
  }
  if (!verified.betterAuthUserId || !verified.azp || !verified.orgId) {
    throw new ApiError(401, "Invalid or expired token", "INVALID_JWT");
  }

  const mcp = await resolveMcpAuth(ctx, {
    session: {
      accessToken: token,
      clientId: verified.azp,
      scopes: verified.scope,
      userId: verified.betterAuthUserId,
    },
    requestedOrganizationId: verified.orgId as Id<"organizations">,
    audience: MCP_OAUTH_AUDIENCE,
    resourceId: MCP_OAUTH_RESOURCE_ID,
    resourceType: "mcp.tool",
  });

  return buildAuthContext(ctx, {
    authType: "mcp_oauth",
    scopes: mcp.scopes,
    userId: mcp.userId,
    organizationId: mcp.organizationId,
    clerkUserId: mcp.betterAuthUserId,
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

  // ES256 JWTs are MCP OAuth access tokens from this deployment's Better-Auth
  // MCP OAuth server. Everything else is an API key.
  if (isJwtToken(token)) {
    return resolveMcpApiAuth(ctx, token, clientIp);
  }

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
  if (auth.authType === "mcp_oauth") {
    // MCP OAuth: the token's granted scopes are authoritative; fall back to
    // owner/admin full access or permission-derived access.
    if (auth.hasScope(scope) || isFullAccessRole(auth.role) || canUserUseScope(auth.permissions, scope)) {
      return;
    }
    throw new ApiError(403, `Missing required scope: ${scope}`, "INSUFFICIENT_SCOPE");
  }

  // API keys: scope grant is strict — no role/permission fallback.
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
  if (auth.authType === "mcp_oauth") {
    // MCP OAuth: any granted scope, owner/admin, or any permission-derived match.
    if (
      auth.hasAnyScope(scopes) ||
      isFullAccessRole(auth.role) ||
      scopes.some((scope) => canUserUseScope(auth.permissions, scope))
    ) {
      return;
    }
    throw new ApiError(
      403,
      `Missing required scope. Need one of: ${scopes.join(", ")}`,
      "INSUFFICIENT_SCOPE",
    );
  }

  // API keys: scope grant is strict — no role/permission fallback.
  if (!auth.hasAnyScope(scopes)) {
    throw new ApiError(
      403,
      `Missing required scope. Need one of: ${scopes.join(", ")}`,
      "INSUFFICIENT_SCOPE",
    );
  }
}

// ===========================================================================
// MCP OAuth (Better-Auth) session resolver
//
// A signed MCP access token carries the better-auth user id, client id, org id,
// and scopes. `resolveMcpAuth` links that better-auth user back to a Seal user +
// active org via the vortexAuth identity component (apiAuth.ts), then authorizes
// org access via the package resolver. It returns a `McpAuthContext`; the
// `/api/v1` entrypoint adapts that into an `ApiAuthContext` via
// `resolveMcpApiAuth` (above) so MCP clients reuse the same resource server.
// ===========================================================================

export interface McpAuthContext {
  authType: "mcp_oauth";
  scopes: string[];
  userId: Id<"users">;
  organizationId: Id<"organizations">;
  betterAuthUserId: string;
  role: string;
  permissions: string[];
  hasScope: (scope: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

export interface ResolveMcpAuthArgs {
  session: McpSessionLike | null | undefined;
  requestedOrganizationId?: Id<"organizations"> | null;
  resourceType?: string;
  resourceId?: string;
  audience?: string | null;
}

type BetterAuthRuntime = {
  issuer: string;
  verifier: ReturnType<typeof createBetterAuthApiTokenVerifierFromConvexAuthConfig>;
};

let betterAuthRuntime: BetterAuthRuntime | null = null;

function getBetterAuthRuntime(): BetterAuthRuntime {
  if (betterAuthRuntime !== null) {
    return betterAuthRuntime;
  }

  // Single-origin: this deployment signs AND validates its own tokens, issuer
  // derived from CONVEX_SITE_URL. No process.env in the factory (matches
  // auth.config.ts) so deploy-time auth-config analysis stays clean.
  const provider = createConvexAuthConfig();

  betterAuthRuntime = {
    issuer: provider.issuer,
    verifier: createBetterAuthApiTokenVerifierFromConvexAuthConfig(provider),
  };

  return betterAuthRuntime;
}

function createApiAuthLookupAdapter(ctx: ActionCtx) {
  return createConvexApiAuthLookupAdapter({
    runQuery: async (reference, args) => {
      return await ctx.runQuery(
        reference as
          | typeof internal.apiAuth.getUserByIdentityForApiAuth
          | typeof internal.apiAuth.getOrganizationAccessForApiAuth,
        args as
          | {
              provider: string;
              issuer: string;
              subject: string;
              tokenIdentifier: string;
            }
          | {
              userId: string;
              requestedOrganizationId: string | null;
              organizationHintId: string | null;
            },
      );
    },
    refs: {
      getUserByIdentity: internal.apiAuth.getUserByIdentityForApiAuth,
      getOrganizationAccess: internal.apiAuth.getOrganizationAccessForApiAuth,
    },
  });
}

async function authorizeMcpOrganizationAccess(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    organizationId: Id<"organizations">;
  },
): Promise<{ role: string; permissions: string[] } | null> {
  const membershipAccess = await ctx.runQuery(
    internal.apiAuth.getOrganizationMembershipAccessForApiAuth,
    {
      userId: args.userId,
      organizationId: args.organizationId,
    },
  );
  if (!membershipAccess) {
    return null;
  }
  return { role: membershipAccess.role, permissions: membershipAccess.permissions };
}

/**
 * Resolve a signed MCP OAuth session (better-auth user + org + scopes) to a
 * fully-authorized Seal MCP auth context. Backs `resolveMcpApiAuth`, which
 * adapts the result into the `ApiAuthContext` used by the `/api/v1` resource
 * server.
 */
export async function resolveMcpAuth(
  ctx: ActionCtx,
  args: ResolveMcpAuthArgs,
): Promise<McpAuthContext> {
  try {
    const { issuer } = getBetterAuthRuntime();
    const resolved = await resolveLinkedBetterAuthMcpSession({
      session: args.session,
      provider: getBetterAuthIdentityProvider(),
      issuer,
      buildTokenIdentifier: buildBetterAuthTokenIdentifier,
      adapter: createApiAuthLookupAdapter(ctx),
      requestedOrganizationId: args.requestedOrganizationId ?? null,
      audience: args.audience ?? "seal-mcp",
      resourceType: args.resourceType ?? "mcp.tool",
      resourceId: args.resourceId ?? "seal:mcp",
    });

    const authorized = await resolveAuthorizedApiAuthContext({
      auth: resolved.provisionalContext,
      authType: "oauth",
      authSubject: resolved.betterAuthUserId,
      userId: resolved.userId,
      organizationId: resolved.organizationId,
      authorizeOrganizationAccess: async ({ userId, organizationId }) =>
        await authorizeMcpOrganizationAccess(ctx, {
          userId: userId as Id<"users">,
          organizationId: organizationId as Id<"organizations">,
        }),
    });

    if (authorized === null) {
      throw new ApiError(403, "No active organization available", "ORGANIZATION_ACCESS_DENIED");
    }

    return {
      authType: "mcp_oauth",
      scopes: authorized.scopes,
      userId: authorized.userId as Id<"users">,
      organizationId: authorized.organizationId as Id<"organizations">,
      betterAuthUserId: resolved.betterAuthUserId,
      role: authorized.role,
      permissions: authorized.permissions,
      hasScope: (scope: string) => authorized.scopes.includes(scope),
      hasPermission: (permission: string) => authorized.permissions.includes(permission),
    };
  } catch (error) {
    if (error instanceof ApiAuthError) {
      throw new ApiError(401, error.message, "INVALID_JWT");
    }
    throw error;
  }
}
