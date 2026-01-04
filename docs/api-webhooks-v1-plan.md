# Seal Public API & Webhooks V1 Implementation Plan

## Executive Summary

This plan outlines the implementation of a public API and outbound webhook system for Seal, enabling external developers to integrate document signing workflows into their applications. The implementation builds on existing infrastructure (API keys, audit logs, access control) and follows RESTful conventions with comprehensive documentation.

---

## Current State Analysis

### Existing Infrastructure (Ready to Leverage)

| Component | Status | Location |
|-----------|--------|----------|
| Clerk Backend SDK | ✅ Implemented | `organizations/actions.ts` |
| Integration activity logging | ✅ Implemented | `schemas/api_keys.ts` |
| Audit logs | ✅ Implemented | `schemas/audit_logs.ts`, `audit_logs/` |
| Permission system | ✅ Implemented | `auth/permissions.ts`, `auth/wrappers.ts` |
| Document access control | ✅ Implemented | `auth/access_control.ts` |
| HTTP routing | ✅ Basic | `http.ts` |
| Inbound webhooks (Clerk/Stripe) | ✅ Implemented | `http.ts`, `webhooks.ts` |
| Custom API Keys schema | ⚠️ Legacy | `schemas/api_keys.ts` (to be deprecated) |

### Missing Components (To Build)

| Component | Priority | Effort |
|-----------|----------|--------|
| Clerk API Keys integration | High | Small |
| Outbound webhook system | High | Large |
| Public REST API endpoints | High | Large |
| Rate limiting | Medium | Medium |
| API versioning infrastructure | Medium | Small |
| Webhook signature verification | High | Small |
| Developer documentation | High | Medium |

---

## Clerk API Keys Integration (New Feature)

> **Note:** Clerk API Keys is currently in **public beta** (released December 2025). The API may change before general availability. This feature will be a paid feature after the beta period.

### Overview

Instead of building a custom API key system, we will leverage [Clerk's API Keys feature](https://clerk.com/docs/guides/development/machine-auth/api-keys) which provides:

- **User & Organization scoped keys** - Keys maintain identity context
- **Instant revocation** - Opaque tokens (not JWTs) enable immediate invalidation
- **Scopes** - Fine-grained access control with custom scope names
- **Custom claims** - Additional metadata on keys
- **Optional expiration** - Set TTL on keys
- **Built-in UI** - `<UserProfile />` and `<OrganizationProfile />` components include API key management

### Benefits Over Custom Implementation

| Feature | Custom Implementation | Clerk API Keys |
|---------|----------------------|----------------|
| Key storage | Must build & maintain | Managed by Clerk |
| Key management UI | Must build | Built into Clerk components |
| Revocation | Database update | Instant, managed by Clerk |
| Secret rotation | Must implement | Built-in |
| Audit trail | Must implement | Clerk Dashboard |
| Verification | Hash comparison | `clerkClient.apiKeys.verify()` |

### Scopes to Configure in Clerk Dashboard

Configure these scopes in the Clerk Dashboard under **API Keys** settings:

```
seal:documents:read     - Read document metadata and content
seal:documents:write    - Create, update, delete documents
seal:templates:read     - Read template metadata and fields
seal:templates:write    - Create, update, delete templates
seal:recipients:read    - Read recipient information
seal:recipients:write   - Manage document recipients
seal:signatures:read    - Read signature and verification data
seal:webhooks:manage    - Configure webhook endpoints
```

### Migration Plan

The existing `schemas/api_keys.ts` custom implementation will be:
1. **Phase 1:** Deprecated - new keys created via Clerk only
2. **Phase 2:** Migration script to notify users of legacy keys
3. **Phase 3:** Legacy keys disabled, full Clerk adoption

---

## RLS Integration Strategy

### The Challenge

The existing RLS system relies on Convex's `ctx.auth.getUserIdentity()` which is populated by Clerk's session tokens. However, HTTP actions (used for REST API endpoints) don't have `ctx.auth` - they receive raw HTTP requests.

**Current RLS Flow:**
```
ctx.auth.getUserIdentity() → clerkId → users table → activeOrganizationId → membership → permissions → RLS
```

**API Key Flow:**
```
Authorization: Bearer <api_key> → clerkClient.apiKeys.verify() → { subject: "user_xxx", scopes: [...] }
```

The API key verification returns:
- `subject`: Clerk user ID (`user_xxx`) or org ID (`org_xxx`)
- `scopes`: Custom scopes (e.g., `seal:documents:read`)
- `claims`: Custom metadata

But we need:
- Internal `Id<"users">` and `Id<"organizations">`
- Organization membership and permissions

### Solution: API Context Bridge

Create an **API Context Bridge** that translates Clerk API key authentication into the internal auth context that RLS expects.

**File:** `apps/backend/convex/api/context.ts`

```typescript
/**
 * @fileoverview API Context Bridge - Translates Clerk API key auth to internal context.
 * Enables API endpoints to leverage existing RLS and permission systems.
 *
 * @module api/context
 */

import { createClerkClient } from "@clerk/backend";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * API-specific authentication context.
 * Bridges Clerk API key to internal user/org context.
 *
 * @interface ApiAuthContext
 */
export interface ApiAuthContext {
  /** Clerk API key ID */
  apiKeyId: string;
  /** Clerk API key name */
  apiKeyName: string;
  /** API key scopes from Clerk */
  scopes: string[];

  /** Internal Convex user ID (resolved from Clerk subject) */
  userId: Id<"users">;
  /** Internal Convex organization ID */
  organizationId: Id<"organizations">;

  /** Clerk user ID (subject) */
  clerkUserId: string;
  /** Whether the key is org-scoped or user-scoped */
  subjectType: "user" | "organization";

  /** Scope checking helpers */
  hasScope: (scope: string) => boolean;
  hasAnyScope: (scopes: string[]) => boolean;
  hasAllScopes: (scopes: string[]) => boolean;
}

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
 * @param authHeader - Authorization header value
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
 *     return new Response("Forbidden", { status: 403 });
 *   }
 *
 *   // Use auth.userId and auth.organizationId for queries
 *   const documents = await ctx.runQuery(internal.documents.queries.listByOrg, {
 *     organizationId: auth.organizationId,
 *     userId: auth.userId,
 *   });
 * });
 * ```
 */
export async function resolveApiAuth(
  ctx: ActionCtx,
  authHeader: string | null
): Promise<ApiAuthContext> {
  if (!authHeader) {
    throw new ApiError(401, "Missing Authorization header");
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new ApiError(401, "Invalid Authorization format. Use: Bearer <api_key>");
  }

  // Step 1: Verify API key with Clerk
  let apiKey;
  try {
    apiKey = await clerkClient.apiKeys.verify(token);
  } catch {
    throw new ApiError(401, "Invalid or expired API key");
  }

  const clerkSubject = apiKey.subject; // user_xxx or org_xxx
  const isOrgKey = clerkSubject.startsWith("org_");

  // Step 2: Resolve to internal user
  // For user keys: look up user by Clerk ID
  // For org keys: look up org by Clerk ID, then get a user with access

  let userId: Id<"users">;
  let organizationId: Id<"organizations">;
  let clerkUserId: string;

  if (isOrgKey) {
    // Organization-scoped API key
    // Resolve org by Clerk ID
    const org = await ctx.runQuery(internal.api.helpers.getOrgByClerkId, {
      clerkOrgId: clerkSubject,
    });

    if (!org) {
      throw new ApiError(403, "Organization not found");
    }

    organizationId = org._id;

    // For org keys, we need to determine which user context to use
    // Option 1: Use the org owner as the acting user
    // Option 2: Store the creating user in API key claims
    // Using claims approach:
    const creatorClerkId = apiKey.claims?.creator_user_id as string | undefined;
    if (!creatorClerkId) {
      throw new ApiError(403, "Organization API key missing creator context");
    }

    const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
      clerkUserId: creatorClerkId,
    });

    if (!user) {
      throw new ApiError(403, "API key creator not found");
    }

    userId = user._id;
    clerkUserId = creatorClerkId;
  } else {
    // User-scoped API key
    clerkUserId = clerkSubject;

    const user = await ctx.runQuery(internal.api.helpers.getUserByClerkId, {
      clerkUserId: clerkSubject,
    });

    if (!user) {
      throw new ApiError(403, "User not found");
    }

    userId = user._id;

    // Use user's active organization
    if (!user.activeOrganizationId) {
      throw new ApiError(403, "User has no active organization");
    }

    organizationId = user.activeOrganizationId;
  }

  // Step 3: Validate user has active membership in the organization
  const membership = await ctx.runQuery(internal.api.helpers.getMembership, {
    userId,
    organizationId,
  });

  if (!membership || membership.status !== "active") {
    throw new ApiError(403, "User is not an active member of the organization");
  }

  // Build context with scope helpers
  const scopes = apiKey.scopes || [];

  return {
    apiKeyId: apiKey.id,
    apiKeyName: apiKey.name,
    scopes,
    userId,
    organizationId,
    clerkUserId,
    subjectType: isOrgKey ? "organization" : "user",
    hasScope: (scope: string) => scopes.includes(scope),
    hasAnyScope: (checkScopes: string[]) => checkScopes.some(s => scopes.includes(s)),
    hasAllScopes: (checkScopes: string[]) => checkScopes.every(s => scopes.includes(s)),
  };
}
```

### Internal Helper Queries

**File:** `apps/backend/convex/api/helpers.ts`

```typescript
/**
 * @fileoverview Internal helper queries for API context resolution.
 * These are internal queries not exposed to clients.
 *
 * @module api/helpers
 * @internal
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Look up user by Clerk user ID.
 * @internal
 */
export const getUserByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkUserId))
      .first();
  },
});

/**
 * Look up organization by Clerk org ID.
 * @internal
 */
export const getOrgByClerkId = internalQuery({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkOrgId))
      .first();
  },
});

/**
 * Get membership for user in organization.
 * @internal
 */
export const getMembership = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId)
      )
      .first();
  },
});
```

### API Endpoint Pattern

**File:** `apps/backend/convex/api/v1/documents.ts` (example)

```typescript
/**
 * @fileoverview Documents REST API endpoints.
 * Uses API Context Bridge to integrate with existing data layer.
 *
 * @module api/v1/documents
 */

import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { resolveApiAuth, API_SCOPES } from "../middleware";
import { apiResponse, apiError } from "../errors";

/**
 * GET /api/v1/documents
 * Lists documents accessible to the API key owner.
 *
 * @scope seal:documents:read
 */
export const listDocuments = httpAction(async (ctx, request) => {
  // Resolve API key to internal context
  const auth = await resolveApiAuth(ctx, request.headers.get("Authorization"));

  // Check required scope
  if (!auth.hasScope(API_SCOPES.DOCUMENTS_READ)) {
    return apiError(403, "Missing required scope: seal:documents:read");
  }

  // Call internal query with resolved user/org context
  // This query can apply the same filtering logic as the RLS-wrapped queries
  const documents = await ctx.runQuery(internal.api.v1.documents.list, {
    userId: auth.userId,
    organizationId: auth.organizationId,
    // Pass pagination params from request...
  });

  // Log API activity
  await ctx.runMutation(internal.api.activity.logApiCall, {
    apiKeyId: auth.apiKeyId,
    userId: auth.userId,
    action: "documents.list",
    resourceCount: documents.length,
  });

  return apiResponse(200, { data: documents });
});
```

### Scope-to-Permission Mapping

API scopes are **separate** from internal permissions but can be mapped:

```typescript
/**
 * Maps API scopes to internal permission requirements.
 * API scopes are coarser-grained than internal permissions.
 *
 * @constant
 */
export const SCOPE_PERMISSION_MAP = {
  "seal:documents:read": ["documents:view"],
  "seal:documents:write": ["documents:create", "documents:edit", "documents:delete"],
  "seal:templates:read": ["templates:view", "templates:read"],
  "seal:templates:write": ["templates:create", "templates:edit", "templates:delete"],
  "seal:recipients:read": ["documents:view"], // Recipients are part of documents
  "seal:recipients:write": ["documents:edit"],
  "seal:signatures:read": ["documents:view", "audit:view"],
  "seal:webhooks:manage": ["settings:integrations"],
} as const;

/**
 * Checks if user's internal permissions satisfy the API scope.
 * Used for additional validation when needed.
 */
export function canUserUseScope(
  userPermissions: string[],
  scope: keyof typeof SCOPE_PERMISSION_MAP
): boolean {
  const requiredPerms = SCOPE_PERMISSION_MAP[scope];
  return requiredPerms.some(perm => userPermissions.includes(perm));
}
```

### Key Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Auth Resolution** | Resolve API key to internal IDs | Enables reuse of existing queries |
| **RLS Bypass** | Use internal queries | HTTP actions can't use RLS wrappers |
| **Scope Model** | Separate from internal perms | API has coarser access patterns |
| **Org Keys** | Store creator in claims | Org keys need a user context |
| **Activity Logging** | Per-request logging | Audit trail for API usage |

### When to Check Scopes vs Internal Permissions

1. **API Scope Check** (always first): Does the API key have the right scope?
2. **Internal Permission Check** (optional): Does the user have the internal permission?

For most API operations, scope check is sufficient. Internal permission checks are useful for:
- Multi-tenant admin operations
- Operations that affect other users
- Sensitive operations beyond standard CRUD

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL DEVELOPERS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐   │
│   │  REST API    │         │   Webhooks   │         │   SDKs       │   │
│   │  Requests    │         │   Delivery   │         │  (Future)    │   │
│   └──────┬───────┘         └──────▲───────┘         └──────────────┘   │
│          │                        │                                      │
└──────────┼────────────────────────┼──────────────────────────────────────┘
           │                        │
           ▼                        │
┌──────────────────────────────────────────────────────────────────────────┐
│                         SEAL API LAYER                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │
│   │  API Gateway    │    │  Webhook        │    │  Rate Limiter   │    │
│   │  (http.ts)      │    │  Dispatcher     │    │                 │    │
│   └────────┬────────┘    └────────▲────────┘    └────────┬────────┘    │
│            │                      │                      │              │
│   ┌────────▼────────┐    ┌────────┴────────┐    ┌────────▼────────┐    │
│   │  Auth           │    │  Event          │    │  Quota          │    │
│   │  Middleware     │    │  Publisher      │    │  Manager        │    │
│   └────────┬────────┘    └─────────────────┘    └─────────────────┘    │
│            │                                                            │
└────────────┼────────────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      CONVEX BACKEND                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │  Documents  │  │  Templates  │  │  Recipients │  │  Signatures │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Clerk API Key Authentication Middleware

**File:** `apps/backend/convex/api/middleware.ts`

```typescript
/**
 * @fileoverview API authentication middleware using Clerk API Keys.
 * Provides API key validation via Clerk's backend SDK, scope checking,
 * and rate limiting integration.
 *
 * @module api/middleware
 * @see {@link https://clerk.com/docs/guides/development/machine-auth/api-keys} Clerk API Keys docs
 * @see {@link ../auth/permissions.ts} for internal permission system
 */

import { createClerkClient } from "@clerk/backend";
import { isClerkAPIResponseError } from "@clerk/shared/error";

/**
 * Clerk client instance for API key operations.
 * Reused across requests for connection pooling.
 */
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

/**
 * API key context returned after successful validation.
 * Contains the verified key metadata and helper methods.
 *
 * @interface ApiKeyContext
 * @property {string} id - Clerk API key ID (ak_xxx)
 * @property {string} name - User-provided key name
 * @property {string} subject - Owner ID (user_xxx or org_xxx)
 * @property {string[]} scopes - Granted scopes
 * @property {Record<string, unknown>} claims - Custom claims metadata
 * @property {Date | null} expiresAt - Expiration date or null if never expires
 */
export interface ApiKeyContext {
  id: string;
  name: string;
  subject: string;
  subjectType: "user" | "organization";
  scopes: string[];
  claims: Record<string, unknown>;
  expiresAt: Date | null;
  hasScope: (scope: string) => boolean;
  hasAnyScope: (scopes: string[]) => boolean;
  hasAllScopes: (scopes: string[]) => boolean;
}

/**
 * Validates an API key using Clerk's verification endpoint.
 * Extracts the Bearer token from Authorization header and verifies it.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer sk_xxx")
 * @returns Promise<ApiKeyContext> - The validated API key context with scopes
 * @throws {ApiError} 401 if key is missing, invalid, expired, or revoked
 * @throws {ApiError} 500 if Clerk API is unavailable
 *
 * @example
 * ```typescript
 * const authHeader = request.headers.get("Authorization");
 * const apiKey = await validateApiKey(authHeader);
 *
 * if (!apiKey.hasScope('seal:documents:read')) {
 *   throw new ApiError(403, 'Insufficient permissions');
 * }
 *
 * // Access the owner (user or organization)
 * console.log(`Request from: ${apiKey.subject}`);
 * ```
 */
export async function validateApiKey(
  authHeader: string | null
): Promise<ApiKeyContext> {
  if (!authHeader) {
    throw new ApiError(401, "Missing Authorization header");
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new ApiError(401, "Invalid Authorization header format. Use: Bearer <api_key>");
  }

  try {
    // Verify the API key with Clerk
    const apiKey = await clerkClient.apiKeys.verify(token);

    // Build context with helper methods
    const context: ApiKeyContext = {
      id: apiKey.id,
      name: apiKey.name,
      subject: apiKey.subject,
      subjectType: apiKey.subject.startsWith("user_") ? "user" : "organization",
      scopes: apiKey.scopes || [],
      claims: apiKey.claims || {},
      expiresAt: apiKey.expiresAt ? new Date(apiKey.expiresAt) : null,
      hasScope: (scope: string) => context.scopes.includes(scope),
      hasAnyScope: (scopes: string[]) => scopes.some(s => context.scopes.includes(s)),
      hasAllScopes: (scopes: string[]) => scopes.every(s => context.scopes.includes(s)),
    };

    return context;
  } catch (error) {
    if (isClerkAPIResponseError(error)) {
      // Handle specific Clerk errors
      throw new ApiError(401, "Invalid or expired API key");
    }
    console.error("[validateApiKey] Clerk API error:", error);
    throw new ApiError(500, "Authentication service unavailable");
  }
}

/**
 * Alternative: Use Clerk's authenticateRequest for machine tokens.
 * This method integrates with Clerk's standard auth flow.
 *
 * @param request - The incoming HTTP request
 * @returns Promise<ApiKeyContext> - The validated context
 *
 * @example
 * ```typescript
 * export const handler = httpAction(async (ctx, request) => {
 *   const auth = await authenticateApiRequest(request);
 *   // auth contains the verified API key context
 * });
 * ```
 */
export async function authenticateApiRequest(
  request: Request
): Promise<ApiKeyContext> {
  const { isAuthenticated, toAuth } = await clerkClient.authenticateRequest(
    request,
    { acceptsToken: "api_key" }
  );

  if (!isAuthenticated) {
    throw new ApiError(401, "Invalid or missing API key");
  }

  // Extract API key details from auth context
  const auth = toAuth();
  // ... build ApiKeyContext from auth
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
 * - seal:webhooks:manage - Configure webhook endpoints
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
} as const;

export type ApiScope = (typeof API_SCOPES)[keyof typeof API_SCOPES];
```

**Tasks:**
- [ ] Enable API Keys in Clerk Dashboard (Settings → API Keys → Enable)
- [ ] Configure scopes in Clerk Dashboard (seal:documents:read, etc.)
- [ ] Create `validateApiKey()` function using `clerkClient.apiKeys.verify()`
- [ ] Create `apiHttpAction` wrapper for HTTP actions with Clerk auth
- [ ] Add scope validation helpers (`hasScope`, `hasAnyScope`, `hasAllScopes`)
- [ ] Add rate limit checking integration point
- [ ] Add activity logging for all API calls
- [ ] Test with Clerk's built-in API key UI components

### 1.1.1 Frontend: Enable API Keys in User/Organization Profile

**File:** `apps/web/src/components/settings/api-keys-section.tsx`

```typescript
/**
 * @fileoverview API Keys management section using Clerk's built-in components.
 * Leverages Clerk's <UserProfile /> or <OrganizationProfile /> components
 * which automatically include API key management when enabled.
 *
 * @module components/settings/api-keys-section
 * @see {@link https://clerk.com/docs/reference/javascript/api-keys} Clerk APIKeys SDK
 */

import { useClerk } from "@clerk/clerk-react";

/**
 * API Keys management using Clerk's built-in UI.
 * When API Keys are enabled in the Clerk Dashboard, the UserProfile
 * and OrganizationProfile components automatically show an "API Keys" tab.
 *
 * For custom UI, use the clerk.apiKeys SDK methods:
 *
 * @example Custom UI with Clerk SDK
 * ```tsx
 * const { apiKeys } = useClerk();
 *
 * // List keys
 * const keys = await apiKeys.getAll();
 *
 * // Create new key
 * const newKey = await apiKeys.create({
 *   name: "Production API Key",
 *   description: "For CI/CD pipeline",
 *   secondsUntilExpiration: 86400 * 365, // 1 year
 * });
 * // IMPORTANT: newKey.secret is only available here, store it immediately!
 *
 * // Revoke key
 * await apiKeys.revoke({
 *   apiKeyID: "ak_xxx",
 *   revocationReason: "Compromised",
 * });
 * ```
 */
```

**Note:** When API Keys are enabled in Clerk Dashboard, the `<UserProfile />` and `<OrganizationProfile />` components automatically display an "API Keys" tab. No additional frontend work is required for basic functionality.

### 1.2 API Versioning Infrastructure

**File:** `apps/backend/convex/api/versioning.ts`

```typescript
/**
 * @fileoverview API versioning support for backwards compatibility.
 * Implements header-based versioning with fallback to latest stable.
 *
 * @module api/versioning
 *
 * @example
 * ```
 * // Request with version header
 * curl -H "X-API-Version: 2024-01-01" https://api.seal.app/v1/documents
 *
 * // Without version header, defaults to latest stable
 * curl https://api.seal.app/v1/documents
 * ```
 */

/**
 * Available API versions with their status.
 *
 * @constant
 * @type {Record<string, ApiVersion>}
 */
export const API_VERSIONS = {
  '2025-01-01': { status: 'current', deprecationDate: null },
} as const;
```

### 1.3 Error Response Standardization

**File:** `apps/backend/convex/api/errors.ts`

```typescript
/**
 * @fileoverview Standardized error responses for the public API.
 * Follows RFC 7807 Problem Details for HTTP APIs format.
 *
 * @module api/errors
 * @see {@link https://www.rfc-editor.org/rfc/rfc7807} RFC 7807
 */

/**
 * Standard API error response format.
 *
 * @interface ApiErrorResponse
 * @property {string} type - URI reference identifying the error type
 * @property {string} title - Short, human-readable summary
 * @property {number} status - HTTP status code
 * @property {string} detail - Human-readable explanation
 * @property {string} instance - URI reference for this specific occurrence
 * @property {string} [code] - Machine-readable error code
 * @property {Record<string, unknown>} [errors] - Field-level validation errors
 *
 * @example
 * ```json
 * {
 *   "type": "https://api.seal.app/errors/validation",
 *   "title": "Validation Error",
 *   "status": 422,
 *   "detail": "The request body contains invalid fields",
 *   "instance": "/v1/documents/abc123",
 *   "code": "VALIDATION_ERROR",
 *   "errors": {
 *     "title": ["Title is required", "Title must be less than 200 characters"]
 *   }
 * }
 * ```
 */
```

---

## Phase 2: Public REST API (Week 2-4)

### 2.1 API Route Structure

**File:** `apps/backend/convex/http.ts` (extend existing)

```typescript
/**
 * @fileoverview HTTP endpoint definitions for Seal.
 * Includes webhook receivers and public REST API endpoints.
 *
 * @module http
 *
 * API Base URL: https://<deployment>.convex.site/api/v1
 *
 * @example
 * ```
 * // List documents
 * GET /api/v1/documents
 *
 * // Create document
 * POST /api/v1/documents
 *
 * // Get specific document
 * GET /api/v1/documents/:id
 * ```
 */

// Route definitions with comprehensive documentation
```

### 2.2 Documents API

**File:** `apps/backend/convex/api/v1/documents.ts`

```typescript
/**
 * @fileoverview Documents REST API handlers.
 * Provides CRUD operations for documents via the public API.
 *
 * @module api/v1/documents
 * @requires documents:read scope for GET operations
 * @requires documents:write scope for POST/PUT/DELETE operations
 */

/**
 * Lists all documents accessible to the API key owner.
 *
 * @route GET /api/v1/documents
 * @scope documents:read
 *
 * @queryparam {number} [limit=20] - Maximum results to return (1-100)
 * @queryparam {string} [cursor] - Pagination cursor from previous response
 * @queryparam {string} [status] - Filter by workflow status (draft|sent|in_progress|completed)
 * @queryparam {string} [created_after] - ISO 8601 datetime filter
 * @queryparam {string} [created_before] - ISO 8601 datetime filter
 *
 * @returns {DocumentListResponse} Paginated list of documents
 *
 * @example Response
 * ```json
 * {
 *   "data": [
 *     {
 *       "id": "j57a8d9f0e1b2c3d4",
 *       "title": "Employment Agreement",
 *       "status": "in_progress",
 *       "created_at": "2025-01-15T10:30:00Z",
 *       "updated_at": "2025-01-15T14:45:00Z",
 *       "recipients_count": 2,
 *       "signed_count": 1
 *     }
 *   ],
 *   "has_more": true,
 *   "next_cursor": "eyJpZCI6Imp..."
 * }
 * ```
 *
 * @throws {ApiError} 401 - Invalid or missing API key
 * @throws {ApiError} 403 - API key lacks documents:read scope
 * @throws {ApiError} 429 - Rate limit exceeded
 */

/**
 * Creates a new document.
 *
 * @route POST /api/v1/documents
 * @scope documents:write
 *
 * @bodyparam {string} title - Document title (required, max 200 chars)
 * @bodyparam {string} [description] - Document description (max 1000 chars)
 * @bodyparam {string} file_url - URL to PDF file or base64 encoded content
 * @bodyparam {Recipient[]} [recipients] - Initial recipients to add
 * @bodyparam {string} [deadline] - ISO 8601 datetime for signing deadline
 * @bodyparam {Object} [settings] - Document settings
 * @bodyparam {boolean} [settings.require_account] - Require signers to have account
 * @bodyparam {string} [settings.reminder_frequency] - Auto-reminder frequency
 *
 * @returns {Document} The created document
 *
 * @example Request
 * ```json
 * {
 *   "title": "Service Agreement",
 *   "file_url": "https://example.com/document.pdf",
 *   "recipients": [
 *     {
 *       "email": "signer@example.com",
 *       "name": "John Doe",
 *       "role": "signer",
 *       "order": 1
 *     }
 *   ],
 *   "deadline": "2025-02-01T23:59:59Z"
 * }
 * ```
 *
 * @example Response
 * ```json
 * {
 *   "id": "j57a8d9f0e1b2c3d4",
 *   "title": "Service Agreement",
 *   "status": "draft",
 *   "created_at": "2025-01-15T10:30:00Z",
 *   "file_url": "https://...",
 *   "recipients": [...],
 *   "signing_url": "https://app.seal.app/sign/..."
 * }
 * ```
 */

/**
 * Retrieves a specific document by ID.
 *
 * @route GET /api/v1/documents/:id
 * @scope documents:read
 *
 * @pathparam {string} id - Document ID
 * @queryparam {boolean} [include_recipients=false] - Include recipient details
 * @queryparam {boolean} [include_fields=false] - Include signature field definitions
 * @queryparam {boolean} [include_audit_log=false] - Include recent audit events
 *
 * @returns {Document} The document with requested includes
 */

/**
 * Updates a document.
 * Only draft documents can have their content updated.
 * Metadata can be updated at any status.
 *
 * @route PUT /api/v1/documents/:id
 * @scope documents:write
 *
 * @pathparam {string} id - Document ID
 * @bodyparam {string} [title] - New title
 * @bodyparam {string} [description] - New description
 * @bodyparam {string} [deadline] - New deadline (ISO 8601)
 * @bodyparam {Object} [settings] - Updated settings
 */

/**
 * Deletes a document.
 * Only draft documents can be deleted. Sent/completed documents
 * are retained for compliance and audit purposes.
 *
 * @route DELETE /api/v1/documents/:id
 * @scope documents:write
 *
 * @pathparam {string} id - Document ID
 *
 * @throws {ApiError} 400 - Cannot delete non-draft documents
 */

/**
 * Sends a document for signing.
 * Transitions document from draft to sent status and notifies recipients.
 *
 * @route POST /api/v1/documents/:id/send
 * @scope documents:write
 *
 * @pathparam {string} id - Document ID
 * @bodyparam {string} [message] - Custom message to include in notification emails
 *
 * @returns {Document} Updated document with sent status
 *
 * @throws {ApiError} 400 - Document must have at least one recipient
 * @throws {ApiError} 400 - Document must have signature fields defined
 * @throws {ApiError} 409 - Document already sent
 */

/**
 * Downloads the document PDF.
 * Returns the original PDF for draft documents, or the signed PDF
 * for completed documents.
 *
 * @route GET /api/v1/documents/:id/download
 * @scope documents:read
 *
 * @pathparam {string} id - Document ID
 * @queryparam {string} [format=pdf] - Download format (pdf|zip)
 *
 * @returns {binary} PDF file content
 */

/**
 * Voids/cancels a document.
 * Stops the signing process and notifies all recipients.
 *
 * @route POST /api/v1/documents/:id/void
 * @scope documents:write
 *
 * @pathparam {string} id - Document ID
 * @bodyparam {string} reason - Reason for voiding (required, shown to recipients)
 *
 * @returns {Document} Updated document with voided status
 */
```

### 2.3 Recipients API

**File:** `apps/backend/convex/api/v1/recipients.ts`

```typescript
/**
 * @fileoverview Recipients REST API handlers.
 * Manages document recipients (signers, approvers, viewers).
 *
 * @module api/v1/recipients
 * @requires recipients:read scope for GET operations
 * @requires recipients:write scope for POST/PUT/DELETE operations
 */

/**
 * Lists recipients for a document.
 *
 * @route GET /api/v1/documents/:documentId/recipients
 * @scope recipients:read
 */

/**
 * Adds a recipient to a document.
 * Can only add recipients to draft or in_progress documents.
 *
 * @route POST /api/v1/documents/:documentId/recipients
 * @scope recipients:write
 *
 * @bodyparam {string} email - Recipient email address (required)
 * @bodyparam {string} name - Recipient display name (required)
 * @bodyparam {string} role - Recipient role: signer|approver|viewer (required)
 * @bodyparam {number} [order] - Signing order (1-based, for sequential signing)
 * @bodyparam {Object} [authentication] - Additional authentication requirements
 * @bodyparam {boolean} [authentication.require_id_verification] - Require ID check
 * @bodyparam {string} [authentication.access_code] - Access code to view document
 *
 * @returns {Recipient} The created recipient with signing URL
 */

/**
 * Updates a recipient.
 *
 * @route PUT /api/v1/documents/:documentId/recipients/:id
 * @scope recipients:write
 */

/**
 * Removes a recipient from a document.
 * Cannot remove recipients who have already signed.
 *
 * @route DELETE /api/v1/documents/:documentId/recipients/:id
 * @scope recipients:write
 */

/**
 * Resends the signing invitation to a recipient.
 *
 * @route POST /api/v1/documents/:documentId/recipients/:id/remind
 * @scope recipients:write
 *
 * @bodyparam {string} [message] - Custom reminder message
 *
 * @returns {Object} Confirmation with email send status
 */
```

### 2.4 Templates API

**File:** `apps/backend/convex/api/v1/templates.ts`

```typescript
/**
 * @fileoverview Templates REST API handlers.
 * Provides operations for reusable document templates.
 *
 * @module api/v1/templates
 * @requires templates:read scope for GET operations
 * @requires templates:write scope for POST/PUT/DELETE operations
 */

/**
 * Lists all templates.
 *
 * @route GET /api/v1/templates
 * @scope templates:read
 */

/**
 * Creates a new template from an existing document or PDF.
 *
 * @route POST /api/v1/templates
 * @scope templates:write
 *
 * @bodyparam {string} name - Template name (required)
 * @bodyparam {string} [description] - Template description
 * @bodyparam {string} [source_document_id] - Create from existing document
 * @bodyparam {string} [file_url] - Create from PDF URL
 * @bodyparam {TemplateField[]} [fields] - Pre-defined signature fields
 * @bodyparam {TemplateRecipient[]} [recipient_roles] - Role definitions
 */

/**
 * Creates a new document from a template.
 *
 * @route POST /api/v1/templates/:id/use
 * @scope templates:read, documents:write
 *
 * @pathparam {string} id - Template ID
 * @bodyparam {string} title - Document title
 * @bodyparam {Object} recipients - Map of role names to recipient details
 * @bodyparam {Object} [field_values] - Pre-fill field values
 *
 * @example Request
 * ```json
 * {
 *   "title": "NDA - Acme Corp",
 *   "recipients": {
 *     "signer": {
 *       "email": "john@acme.com",
 *       "name": "John Smith"
 *     },
 *     "counter_signer": {
 *       "email": "legal@company.com",
 *       "name": "Legal Team"
 *     }
 *   },
 *   "field_values": {
 *     "company_name": "Acme Corporation",
 *     "effective_date": "2025-02-01"
 *   }
 * }
 * ```
 */
```

### 2.5 Signatures API

**File:** `apps/backend/convex/api/v1/signatures.ts`

```typescript
/**
 * @fileoverview Signatures REST API handlers (read-only).
 * Provides access to signature verification and audit data.
 *
 * @module api/v1/signatures
 * @requires signatures:read scope for all operations
 */

/**
 * Lists all signatures for a document.
 *
 * @route GET /api/v1/documents/:documentId/signatures
 * @scope signatures:read
 *
 * @returns {Signature[]} List of signatures with verification data
 */

/**
 * Verifies document integrity and signature validity.
 *
 * @route GET /api/v1/documents/:documentId/verify
 * @scope signatures:read
 *
 * @returns {VerificationResult} Comprehensive verification report
 *
 * @example Response
 * ```json
 * {
 *   "document_id": "j57a8d9f0e1b2c3d4",
 *   "verified": true,
 *   "document_hash": "sha256:a1b2c3...",
 *   "integrity_check": {
 *     "passed": true,
 *     "checked_at": "2025-01-15T14:00:00Z"
 *   },
 *   "signatures": [
 *     {
 *       "recipient_email": "signer@example.com",
 *       "signed_at": "2025-01-15T12:30:00Z",
 *       "ip_address": "192.168.1.1",
 *       "signature_hash": "sha256:d4e5f6...",
 *       "verified": true
 *     }
 *   ],
 *   "audit_trail_hash": "sha256:g7h8i9..."
 * }
 * ```
 */
```

---

## Phase 3: Outbound Webhooks (Week 4-6)

### 3.1 Webhook Configuration Schema

**File:** `apps/backend/convex/schemas/webhooks.ts`

```typescript
/**
 * @fileoverview Database schemas for outbound webhook configuration.
 * Stores webhook endpoints, event subscriptions, and delivery state.
 *
 * @module schemas/webhooks
 */

import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Webhook endpoint configuration.
 * Each organization can have multiple webhook endpoints.
 *
 * @table webhook_endpoints
 * @index by_organization - Query endpoints by organization
 * @index by_status - Query active/paused endpoints
 */
export const webhookEndpoints = defineTable({
  /**
   * Organization that owns this webhook endpoint.
   * @type {Id<"organizations">}
   */
  organizationId: v.id("organizations"),

  /**
   * User-friendly name for this endpoint.
   * @type {string}
   * @maxLength 100
   */
  name: v.string(),

  /**
   * HTTPS URL where webhook payloads will be delivered.
   * Must be HTTPS in production.
   * @type {string}
   */
  url: v.string(),

  /**
   * Secret key for HMAC-SHA256 signature generation.
   * Used by recipients to verify webhook authenticity.
   * Stored hashed, original provided once at creation.
   * @type {string}
   */
  secretHash: v.string(),

  /**
   * Event types this endpoint subscribes to.
   * Empty array means all events.
   * @type {WebhookEventType[]}
   * @see {@link WEBHOOK_EVENT_TYPES}
   */
  events: v.array(v.string()),

  /**
   * Endpoint status.
   * - active: Receiving webhooks
   * - paused: Temporarily disabled by user
   * - disabled: Disabled due to repeated failures
   * @type {"active" | "paused" | "disabled"}
   */
  status: v.union(
    v.literal("active"),
    v.literal("paused"),
    v.literal("disabled")
  ),

  /**
   * API version for webhook payload format.
   * @type {string}
   */
  apiVersion: v.string(),

  /**
   * Optional description for this endpoint.
   * @type {string | undefined}
   */
  description: v.optional(v.string()),

  /**
   * Consecutive delivery failure count.
   * Endpoint is disabled after 10 consecutive failures.
   * @type {number}
   */
  failureCount: v.number(),

  /**
   * Timestamp of last successful delivery.
   * @type {number | undefined}
   */
  lastSuccessAt: v.optional(v.number()),

  /**
   * Timestamp of last delivery attempt.
   * @type {number | undefined}
   */
  lastAttemptAt: v.optional(v.number()),

  /**
   * Creation timestamp.
   * @type {number}
   */
  createdAt: v.number(),

  /**
   * Last update timestamp.
   * @type {number}
   */
  updatedAt: v.number(),
});

/**
 * Individual webhook delivery record.
 * Tracks each delivery attempt for debugging and retry logic.
 *
 * @table webhook_deliveries
 * @index by_endpoint - Query deliveries by endpoint
 * @index by_event - Query by event ID for debugging
 * @index by_status - Query pending/failed deliveries for retry
 */
export const webhookDeliveries = defineTable({
  /**
   * The endpoint this delivery is for.
   * @type {Id<"webhook_endpoints">}
   */
  endpointId: v.id("webhook_endpoints"),

  /**
   * Unique event identifier (for deduplication).
   * Format: evt_{timestamp}_{random}
   * @type {string}
   */
  eventId: v.string(),

  /**
   * Event type (e.g., "document.sent", "recipient.signed").
   * @type {string}
   */
  eventType: v.string(),

  /**
   * Full webhook payload (JSON).
   * @type {string}
   */
  payload: v.string(),

  /**
   * Delivery status.
   * @type {"pending" | "delivered" | "failed" | "abandoned"}
   */
  status: v.union(
    v.literal("pending"),
    v.literal("delivered"),
    v.literal("failed"),
    v.literal("abandoned")
  ),

  /**
   * Number of delivery attempts made.
   * @type {number}
   */
  attemptCount: v.number(),

  /**
   * Next scheduled retry time (if pending).
   * @type {number | undefined}
   */
  nextRetryAt: v.optional(v.number()),

  /**
   * HTTP response code from last attempt.
   * @type {number | undefined}
   */
  responseCode: v.optional(v.number()),

  /**
   * Error message from last failed attempt.
   * @type {string | undefined}
   */
  errorMessage: v.optional(v.string()),

  /**
   * Response time in milliseconds.
   * @type {number | undefined}
   */
  responseTimeMs: v.optional(v.number()),

  /**
   * Timestamp when event was created.
   * @type {number}
   */
  createdAt: v.number(),

  /**
   * Timestamp of successful delivery.
   * @type {number | undefined}
   */
  deliveredAt: v.optional(v.number()),
});
```

### 3.2 Webhook Event Types

**File:** `apps/backend/convex/api/webhooks/events.ts`

```typescript
/**
 * @fileoverview Webhook event type definitions and payload schemas.
 * Defines all events that can trigger outbound webhooks.
 *
 * @module api/webhooks/events
 */

/**
 * All available webhook event types.
 * Events follow the pattern: resource.action
 *
 * @constant
 * @type {Record<string, WebhookEventDefinition>}
 */
export const WEBHOOK_EVENT_TYPES = {
  // Document lifecycle events
  'document.created': {
    description: 'A new document was created',
    category: 'documents',
  },
  'document.sent': {
    description: 'A document was sent for signing',
    category: 'documents',
  },
  'document.viewed': {
    description: 'A document was viewed by a recipient',
    category: 'documents',
  },
  'document.completed': {
    description: 'All recipients have signed the document',
    category: 'documents',
  },
  'document.voided': {
    description: 'A document was voided/cancelled',
    category: 'documents',
  },
  'document.expired': {
    description: 'A document deadline has passed',
    category: 'documents',
  },
  'document.declined': {
    description: 'A recipient declined to sign',
    category: 'documents',
  },

  // Recipient events
  'recipient.added': {
    description: 'A recipient was added to a document',
    category: 'recipients',
  },
  'recipient.viewed': {
    description: 'A recipient viewed the document',
    category: 'recipients',
  },
  'recipient.signed': {
    description: 'A recipient signed the document',
    category: 'recipients',
  },
  'recipient.approved': {
    description: 'A recipient approved the document',
    category: 'recipients',
  },
  'recipient.declined': {
    description: 'A recipient declined to sign',
    category: 'recipients',
  },
  'recipient.reminded': {
    description: 'A reminder was sent to a recipient',
    category: 'recipients',
  },

  // Template events
  'template.created': {
    description: 'A new template was created',
    category: 'templates',
  },
  'template.updated': {
    description: 'A template was modified',
    category: 'templates',
  },
  'template.used': {
    description: 'A document was created from a template',
    category: 'templates',
  },
} as const;

/**
 * Base webhook payload structure.
 * All webhook payloads follow this format.
 *
 * @interface WebhookPayload
 * @template T - The event-specific data type
 *
 * @example
 * ```json
 * {
 *   "id": "evt_1234567890abcdef",
 *   "type": "document.completed",
 *   "api_version": "2025-01-01",
 *   "created_at": "2025-01-15T14:30:00Z",
 *   "organization_id": "org_abc123",
 *   "data": {
 *     "document": {
 *       "id": "j57a8d9f0e1b2c3d4",
 *       "title": "Service Agreement",
 *       "status": "completed",
 *       "completed_at": "2025-01-15T14:30:00Z"
 *     }
 *   }
 * }
 * ```
 */
export interface WebhookPayload<T = unknown> {
  /** Unique event identifier */
  id: string;
  /** Event type */
  type: keyof typeof WEBHOOK_EVENT_TYPES;
  /** API version used for payload format */
  api_version: string;
  /** ISO 8601 timestamp of event creation */
  created_at: string;
  /** Organization this event belongs to */
  organization_id: string;
  /** Event-specific data */
  data: T;
}

/**
 * Payload for document.completed event.
 *
 * @interface DocumentCompletedPayload
 */
export interface DocumentCompletedPayload {
  document: {
    id: string;
    title: string;
    status: 'completed';
    completed_at: string;
    download_url: string;
    recipients: Array<{
      email: string;
      name: string;
      role: string;
      signed_at: string;
    }>;
  };
}

/**
 * Payload for recipient.signed event.
 *
 * @interface RecipientSignedPayload
 */
export interface RecipientSignedPayload {
  document: {
    id: string;
    title: string;
    status: string;
  };
  recipient: {
    id: string;
    email: string;
    name: string;
    role: string;
    signed_at: string;
    ip_address: string;
  };
  /** Remaining recipients who haven't signed */
  remaining_recipients: number;
}
```

### 3.3 Webhook Delivery System

**File:** `apps/backend/convex/api/webhooks/delivery.ts`

```typescript
/**
 * @fileoverview Webhook delivery and retry logic.
 * Handles reliable delivery with exponential backoff.
 *
 * @module api/webhooks/delivery
 */

/**
 * Publishes an event to all subscribed webhook endpoints.
 * Creates delivery records and schedules immediate delivery.
 *
 * @param ctx - Convex mutation context
 * @param event - The event to publish
 *
 * @example
 * ```typescript
 * await publishWebhookEvent(ctx, {
 *   type: 'document.completed',
 *   organizationId: doc.organizationId,
 *   data: {
 *     document: { id: doc._id, title: doc.title, ... }
 *   }
 * });
 * ```
 */

/**
 * Delivers a webhook payload to an endpoint.
 * Implements HMAC-SHA256 signature for verification.
 *
 * @param ctx - Convex action context
 * @param deliveryId - The delivery record ID
 *
 * Headers sent with webhook:
 * - X-Seal-Signature: HMAC-SHA256 signature
 * - X-Seal-Timestamp: Unix timestamp of request
 * - X-Seal-Event-Id: Unique event identifier
 * - X-Seal-Event-Type: Event type name
 * - Content-Type: application/json
 *
 * @example Signature verification (Node.js)
 * ```javascript
 * const crypto = require('crypto');
 *
 * function verifyWebhook(payload, signature, timestamp, secret) {
 *   const signedPayload = `${timestamp}.${payload}`;
 *   const expectedSignature = crypto
 *     .createHmac('sha256', secret)
 *     .update(signedPayload)
 *     .digest('hex');
 *   return crypto.timingSafeEqual(
 *     Buffer.from(signature),
 *     Buffer.from(expectedSignature)
 *   );
 * }
 * ```
 */

/**
 * Retry schedule for failed deliveries.
 * Uses exponential backoff with jitter.
 *
 * Attempt 1: Immediate
 * Attempt 2: 1 minute
 * Attempt 3: 5 minutes
 * Attempt 4: 30 minutes
 * Attempt 5: 2 hours
 * Attempt 6: 8 hours
 * Attempt 7: 24 hours (final attempt)
 *
 * After 7 failed attempts, delivery is marked as abandoned.
 */
export const RETRY_SCHEDULE_MS = [
  0,           // Immediate
  60_000,      // 1 minute
  300_000,     // 5 minutes
  1_800_000,   // 30 minutes
  7_200_000,   // 2 hours
  28_800_000,  // 8 hours
  86_400_000,  // 24 hours
];

/**
 * Processes pending webhook deliveries.
 * Called by cron job to retry failed deliveries.
 *
 * @param ctx - Convex action context
 */
```

### 3.4 Webhook Management API

**File:** `apps/backend/convex/api/v1/webhooks.ts`

```typescript
/**
 * @fileoverview Webhook configuration REST API handlers.
 * Allows developers to manage their webhook endpoints.
 *
 * @module api/v1/webhooks
 * @requires webhooks:manage scope for all operations
 */

/**
 * Lists all webhook endpoints for the organization.
 *
 * @route GET /api/v1/webhooks
 * @scope webhooks:manage
 *
 * @returns {WebhookEndpoint[]} List of configured endpoints
 */

/**
 * Creates a new webhook endpoint.
 *
 * @route POST /api/v1/webhooks
 * @scope webhooks:manage
 *
 * @bodyparam {string} name - Endpoint name (required)
 * @bodyparam {string} url - HTTPS URL for delivery (required)
 * @bodyparam {string[]} [events] - Event types to subscribe (empty = all)
 * @bodyparam {string} [description] - Optional description
 *
 * @returns {WebhookEndpoint} Created endpoint with secret (shown once)
 *
 * @example Response
 * ```json
 * {
 *   "id": "whk_abc123",
 *   "name": "Production Webhook",
 *   "url": "https://api.example.com/webhooks/seal",
 *   "secret": "whsec_live_abc123...",  // Only shown once!
 *   "events": ["document.completed", "recipient.signed"],
 *   "status": "active",
 *   "created_at": "2025-01-15T10:00:00Z"
 * }
 * ```
 */

/**
 * Updates a webhook endpoint.
 *
 * @route PUT /api/v1/webhooks/:id
 * @scope webhooks:manage
 *
 * @bodyparam {string} [name] - New name
 * @bodyparam {string} [url] - New URL
 * @bodyparam {string[]} [events] - New event subscriptions
 * @bodyparam {string} [status] - active|paused
 */

/**
 * Deletes a webhook endpoint.
 *
 * @route DELETE /api/v1/webhooks/:id
 * @scope webhooks:manage
 */

/**
 * Regenerates the webhook secret.
 * Invalidates the previous secret immediately.
 *
 * @route POST /api/v1/webhooks/:id/rotate-secret
 * @scope webhooks:manage
 *
 * @returns {Object} New secret (shown once)
 */

/**
 * Lists recent deliveries for an endpoint.
 * Useful for debugging webhook issues.
 *
 * @route GET /api/v1/webhooks/:id/deliveries
 * @scope webhooks:manage
 *
 * @queryparam {number} [limit=20] - Results per page
 * @queryparam {string} [status] - Filter by status
 */

/**
 * Manually retries a failed delivery.
 *
 * @route POST /api/v1/webhooks/:id/deliveries/:deliveryId/retry
 * @scope webhooks:manage
 */

/**
 * Sends a test webhook to verify endpoint configuration.
 *
 * @route POST /api/v1/webhooks/:id/test
 * @scope webhooks:manage
 *
 * @bodyparam {string} [event_type=test.ping] - Event type to simulate
 *
 * @returns {TestResult} Delivery result with response details
 */
```

---

## Phase 4: Rate Limiting & Quotas (Week 6-7)

### 4.1 Rate Limiting Schema

**File:** `apps/backend/convex/schemas/rate_limits.ts`

```typescript
/**
 * @fileoverview Rate limiting schema for API usage control.
 * Implements sliding window rate limiting using Clerk API key IDs.
 *
 * @module schemas/rate_limits
 */

import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * API rate limit tracking per Clerk API key.
 * Uses sliding window algorithm.
 *
 * @table api_rate_limits
 * @index by_clerk_key_and_window - Efficient lookup for rate checking
 */
export const apiRateLimits = defineTable({
  /**
   * The Clerk API key ID being rate limited (ak_xxx format).
   * This is the Clerk-managed API key identifier.
   * @type {string}
   */
  clerkApiKeyId: v.string(),

  /**
   * The subject (owner) of the API key for aggregate limits.
   * Either user_xxx or org_xxx from Clerk.
   * @type {string}
   */
  subject: v.string(),

  /**
   * Window identifier (e.g., "2025-01-15T14:00" for hourly).
   * @type {string}
   */
  windowKey: v.string(),

  /**
   * Request count in this window.
   * @type {number}
   */
  requestCount: v.number(),

  /**
   * Window start timestamp.
   * @type {number}
   */
  windowStart: v.number(),
})
  .index("by_clerk_key_and_window", ["clerkApiKeyId", "windowKey"])
  .index("by_subject_and_window", ["subject", "windowKey"]);
```

### 4.2 Rate Limit Configuration

**File:** `apps/backend/convex/api/rate_limits.ts`

```typescript
/**
 * @fileoverview Rate limiting configuration and enforcement.
 *
 * @module api/rate_limits
 */

/**
 * Rate limit tiers based on subscription plan.
 *
 * @constant
 * @type {Record<string, RateLimitConfig>}
 *
 * Free tier: 100 requests/hour, 1000/day
 * Pro tier: 1000 requests/hour, 10000/day
 * Enterprise: 10000 requests/hour, unlimited/day
 */
export const RATE_LIMIT_TIERS = {
  free: {
    requestsPerHour: 100,
    requestsPerDay: 1000,
    burstLimit: 20, // Max concurrent requests
  },
  pro: {
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 50,
  },
  enterprise: {
    requestsPerHour: 10000,
    requestsPerDay: null, // Unlimited
    burstLimit: 200,
  },
} as const;

/**
 * Checks if a request should be rate limited.
 * Returns rate limit headers for response.
 *
 * @param ctx - Convex context
 * @param apiKeyId - The API key making the request
 * @returns {RateLimitResult} Whether to allow and headers to include
 *
 * Response headers:
 * - X-RateLimit-Limit: Total allowed requests
 * - X-RateLimit-Remaining: Requests remaining in window
 * - X-RateLimit-Reset: Unix timestamp when window resets
 * - Retry-After: Seconds to wait (only on 429)
 */
```

---

## Phase 5: Developer Experience (Week 7-8)

### 5.1 API Documentation Generation

**File:** `apps/backend/convex/api/docs/generator.ts`

```typescript
/**
 * @fileoverview OpenAPI specification generator from docstrings.
 * Generates OpenAPI 3.1 spec from TypeScript definitions.
 *
 * @module api/docs/generator
 */

/**
 * Generates OpenAPI specification from API route definitions.
 * Extracts JSDoc comments to build comprehensive documentation.
 *
 * Output includes:
 * - All endpoint definitions with parameters
 * - Request/response schemas from TypeScript types
 * - Authentication requirements
 * - Rate limit information
 * - Example requests and responses
 */
```

### 5.2 SDK Types Export

**File:** `apps/backend/convex/api/types.ts`

```typescript
/**
 * @fileoverview Public API TypeScript types for SDK generation.
 * These types are exported for use in client SDKs.
 *
 * @module api/types
 * @public
 */

/**
 * Document object returned by the API.
 *
 * @public
 * @interface ApiDocument
 */
export interface ApiDocument {
  /** Unique document identifier */
  id: string;
  /** Document title */
  title: string;
  /** Optional description */
  description?: string;
  /** Current workflow status */
  status: 'draft' | 'sent' | 'in_progress' | 'completed' | 'voided' | 'expired';
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** ISO 8601 last update timestamp */
  updated_at: string;
  /** Number of recipients */
  recipients_count: number;
  /** Number of recipients who have signed */
  signed_count: number;
  /** Optional signing deadline (ISO 8601) */
  deadline?: string;
  /** Download URL for the PDF (temporary, expires in 1 hour) */
  download_url?: string;
}

/**
 * Recipient object returned by the API.
 *
 * @public
 * @interface ApiRecipient
 */
export interface ApiRecipient {
  /** Unique recipient identifier */
  id: string;
  /** Recipient email address */
  email: string;
  /** Recipient display name */
  name: string;
  /** Role in the signing workflow */
  role: 'signer' | 'approver' | 'viewer';
  /** Current status */
  status: 'pending' | 'viewed' | 'signed' | 'approved' | 'declined';
  /** Signing order (for sequential signing) */
  order?: number;
  /** ISO 8601 timestamp when viewed */
  viewed_at?: string;
  /** ISO 8601 timestamp when signed/approved */
  completed_at?: string;
  /** Direct signing URL (only for draft/sent documents) */
  signing_url?: string;
}

// ... more public types
```

---

## Phase 6: Event Integration (Week 8-9)

### 6.1 Event Publisher Integration

Update existing mutations to publish webhook events:

**File:** `apps/backend/convex/documents/mutations.ts` (updates)

```typescript
/**
 * Sends a document for signing.
 * Publishes document.sent webhook event.
 *
 * @emits document.sent
 */
export const sendDocument = permissionMutation("documents:edit", {
  args: { documentId: v.id("documents"), message: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // ... existing logic ...

    // Publish webhook event
    await publishWebhookEvent(ctx, {
      type: 'document.sent',
      organizationId: document.organizationId,
      data: {
        document: {
          id: document._id,
          title: document.title,
          status: 'sent',
          sent_at: new Date().toISOString(),
          recipients: recipients.map(r => ({
            email: r.email,
            name: r.name,
            role: r.role,
          })),
        },
      },
    });

    return document;
  },
});
```

---

## Implementation Checklist

### Phase 1: Foundation ✅ COMPLETED
- [x] Create `apps/backend/convex/api/` directory structure
- [x] Implement Clerk API key authentication middleware (`validateApiKey()`)
- [x] Create `apiHttpAction` wrapper for HTTP actions with Clerk auth
- [x] Implement API versioning infrastructure
- [x] Create standardized error response format (RFC 7807)
- [x] Add docstrings to all new files
- [ ] **Clerk Setup (requires dashboard access):**
  - [ ] Enable API Keys in Clerk Dashboard (Settings → API Keys)
  - [ ] Enable User API Keys and/or Organization API Keys
  - [ ] Configure scopes: `seal:documents:read`, `seal:documents:write`, etc.
- [ ] Deprecate custom `schemas/api_keys.ts` (mark for future removal)

### Phase 2: REST API ✅ COMPLETED
- [x] Extend `http.ts` with API routes structure
- [x] Implement Documents API (`/api/v1/documents`)
  - [x] GET /api/v1/documents - List documents
  - [x] POST /api/v1/documents - Create document
  - [x] GET /api/v1/documents/get?id=xxx - Get document
  - [x] PUT /api/v1/documents/update?id=xxx - Update document
  - [x] DELETE /api/v1/documents/delete?id=xxx - Delete document
  - [x] POST /api/v1/documents/send?id=xxx - Send document
  - [x] POST /api/v1/documents/void?id=xxx - Void document
  - [x] GET /api/v1/documents/download?id=xxx - Download PDF
- [x] Implement Recipients API (`/api/v1/recipients`)
  - [x] GET /api/v1/recipients?document_id=xxx - List recipients
  - [x] POST /api/v1/recipients?document_id=xxx - Add recipient
  - [x] GET /api/v1/recipients/get?document_id=xxx&id=xxx - Get recipient
  - [x] PUT /api/v1/recipients/update?document_id=xxx&id=xxx - Update recipient
  - [x] DELETE /api/v1/recipients/delete?document_id=xxx&id=xxx - Remove recipient
  - [x] POST /api/v1/recipients/remind?document_id=xxx&id=xxx - Send reminder
- [x] Implement Templates API (`/api/v1/templates`)
  - [x] GET /api/v1/templates - List templates
  - [x] POST /api/v1/templates - Create template from document
  - [x] GET /api/v1/templates/get?id=xxx - Get template
  - [x] GET /api/v1/templates/fields?id=xxx - Get template fields
  - [x] PUT /api/v1/templates/update?id=xxx - Update template
  - [x] DELETE /api/v1/templates/delete?id=xxx - Delete template
  - [x] POST /api/v1/templates/use?id=xxx - Create document from template
- [x] Implement Signatures API (`/api/v1/signatures`)
  - [x] GET /api/v1/signatures?document_id=xxx - List signatures
  - [x] GET /api/v1/signatures/get?document_id=xxx&id=xxx - Get signature
  - [x] GET /api/v1/signatures/verify?document_id=xxx - Verify document
  - [x] GET /api/v1/signatures/audit?document_id=xxx - Get audit trail
- [x] Add comprehensive docstrings to all handlers

### Phase 3: Outbound Webhooks ✅ COMPLETED
- [x] Create webhook schemas (`webhook_endpoints`, `webhook_deliveries`)
- [x] Define all webhook event types
- [x] Implement webhook UI queries/mutations (existing in webhooks/)
- [x] Implement Webhook Management API (`/api/v1/webhooks`)
  - [x] GET /api/v1/webhooks - List endpoints
  - [x] POST /api/v1/webhooks - Create endpoint
  - [x] GET /api/v1/webhooks/get?id=xxx - Get endpoint
  - [x] PUT /api/v1/webhooks/update?id=xxx - Update endpoint
  - [x] DELETE /api/v1/webhooks/delete?id=xxx - Delete endpoint
  - [x] POST /api/v1/webhooks/rotate-secret?id=xxx - Rotate secret
  - [x] GET /api/v1/webhooks/events - Get event types
- [ ] Implement webhook HTTP delivery action with HMAC-SHA256 signatures - TODO
- [ ] Add webhook signature verification documentation - TODO

### Phase 4: Rate Limiting - TODO
- [ ] Create rate limit schema
- [ ] Implement sliding window rate limiter
- [ ] Add rate limit headers to responses
- [ ] Implement per-plan rate limit tiers

### Phase 5: Developer Experience - TODO
- [ ] Set up OpenAPI spec generation
- [ ] Export SDK types
- [ ] Create example code snippets in docstrings
- [ ] Document signature verification in multiple languages

### Phase 6: Event Integration - TODO
- [ ] Add webhook publishing to document mutations
- [ ] Add webhook publishing to recipient mutations
- [ ] Add webhook publishing to template mutations
- [ ] Test all event types end-to-end

---

## File Structure (Final)

```
apps/backend/convex/
├── api/
│   ├── middleware.ts          # Clerk API key auth, rate limiting
│   ├── versioning.ts          # API version handling
│   ├── errors.ts              # Standardized error responses (RFC 7807)
│   ├── types.ts               # Public API types (for SDK)
│   ├── rate_limits.ts         # Rate limiting logic (uses Clerk key IDs)
│   ├── v1/
│   │   ├── documents.ts       # Documents API handlers
│   │   ├── recipients.ts      # Recipients API handlers
│   │   ├── templates.ts       # Templates API handlers
│   │   ├── signatures.ts      # Signatures API handlers
│   │   └── webhooks.ts        # Webhook management API
│   ├── webhooks/
│   │   ├── events.ts          # Event type definitions
│   │   ├── delivery.ts        # Delivery & retry logic
│   │   └── publisher.ts       # Event publishing helpers
│   └── docs/
│       └── generator.ts       # OpenAPI generation
├── schemas/
│   ├── api_keys.ts            # DEPRECATED - legacy, to be removed
│   ├── webhooks.ts            # Webhook endpoint/delivery schemas
│   └── rate_limits.ts         # Rate limit tracking (uses Clerk key IDs)
└── http.ts                    # Extended with API routes

apps/web/src/
└── components/
    └── settings/
        └── api-keys-section.tsx  # Optional: Custom API key UI (Clerk SDK)
        # Note: Clerk's <UserProfile /> already includes API Keys tab
```

### Clerk Dashboard Configuration

```
Clerk Dashboard → API Keys:
├── Enable API Keys: ✓
├── Enable User API Keys: ✓ (optional)
├── Enable Organization API Keys: ✓ (recommended)
└── Scopes:
    ├── seal:documents:read
    ├── seal:documents:write
    ├── seal:templates:read
    ├── seal:templates:write
    ├── seal:recipients:read
    ├── seal:recipients:write
    ├── seal:signatures:read
    └── seal:webhooks:manage
```

---

## Security Considerations

1. **API Key Security (Clerk-Managed)**
   - Keys are managed entirely by Clerk (no local storage of secrets)
   - Opaque tokens (not JWTs) - enables instant revocation
   - Full key shown only once at creation via Clerk UI
   - Keys can be scoped to specific operations (configured in Clerk Dashboard)
   - Keys can have expiration dates
   - Keys are tied to user or organization identity
   - Verification via `clerkClient.apiKeys.verify()` - Clerk handles cryptography
   - Audit trail available in Clerk Dashboard

2. **Webhook Security**
   - HMAC-SHA256 signatures on all deliveries
   - Timestamp included to prevent replay attacks
   - HTTPS required for production endpoints
   - Secret rotation capability

3. **Rate Limiting**
   - Per-key limits prevent abuse
   - Burst limits prevent DoS
   - Plan-based tiers for fair usage

4. **Data Access**
   - API respects existing RLS rules
   - Clerk scopes limit what keys can access
   - Organization isolation maintained via Clerk subject (user_xxx or org_xxx)
   - API key owner's permissions apply to all requests

---

## Success Metrics

- API response time P95 < 200ms
- Webhook delivery success rate > 99.5%
- First delivery attempt within 5 seconds of event
- API uptime > 99.9%
- Developer onboarding time < 30 minutes

---

## Future Considerations (V2+)

- GraphQL API for flexible queries
- Real-time subscriptions (WebSocket)
- Bulk operations for high-volume users
- Custom webhook transformations
- SDK generation for multiple languages (TypeScript, Python, Go)
- API playground/console
- Usage analytics dashboard
