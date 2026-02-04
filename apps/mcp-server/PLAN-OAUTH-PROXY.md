# OAuth Proxy Implementation Plan

## Goal

Transform the MCP server to act as its own OAuth Authorization Server (like Linear/Sentry), proxying authentication to Clerk behind the scenes. This fixes token persistence issues with Claude Code.

## Current State

```
Claude Code → Clerk OAuth (external domain) → MCP Server validates token
```

**Problem:** Claude Code has bugs handling external OAuth providers, causing re-authentication on every restart.

## Target State

```
Claude Code → MCP Server OAuth (same domain) → Clerk (behind the scenes) → MCP Server issues tokens
```

**Solution:** MCP Server acts as OAuth AS, issues its own tokens, handles refresh internally.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP Server (mcp.seal.nyc)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  OAuth Endpoints (NEW)                                               │
│  ├── POST /oauth/register     → Dynamic client registration         │
│  ├── GET  /oauth/authorize    → Redirects to Clerk, handles callback│
│  ├── POST /oauth/token        → Issues our JWTs, handles refresh    │
│  └── POST /oauth/revoke       → Revokes tokens                      │
│                                                                      │
│  Discovery Endpoints (UPDATE)                                        │
│  ├── /.well-known/oauth-authorization-server → Points to ourselves  │
│  └── /.well-known/oauth-protected-resource   → Points to ourselves  │
│                                                                      │
│  MCP Endpoint (KEEP)                                                 │
│  └── /mcp → Validates our tokens, serves MCP protocol               │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                           Storage (Convex)                           │
│  ├── mcp_oauth_clients        → Dynamic client registrations        │
│  ├── mcp_oauth_codes          → Authorization codes (short-lived)   │
│  └── mcp_oauth_refresh_tokens → Refresh tokens (long-lived)         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Convex Schema & API

**Files to create in `apps/backend/convex/`:**

#### 1.1 Schema: `schemas/mcp_oauth.ts`

```typescript
// Tables for OAuth state
export const mcp_oauth_clients = defineTable({
  clientId: v.string(), // Generated UUID
  clientSecret: v.optional(v.string()), // Hashed, for confidential clients
  clientName: v.string(),
  redirectUris: v.array(v.string()),
  grantTypes: v.array(v.string()),
  responseTypes: v.array(v.string()),
  tokenEndpointAuthMethod: v.string(),
  createdAt: v.number(),
}).index("by_client_id", ["clientId"]);

export const mcp_oauth_codes = defineTable({
  code: v.string(), // Hashed authorization code
  clientId: v.string(),
  userId: v.string(), // Clerk user ID
  redirectUri: v.string(),
  scope: v.string(),
  codeChallenge: v.optional(v.string()),
  codeChallengeMethod: v.optional(v.string()),
  expiresAt: v.number(), // 10 minutes from creation
}).index("by_code", ["code"]);

export const mcp_oauth_refresh_tokens = defineTable({
  tokenHash: v.string(), // Hashed refresh token
  clientId: v.string(),
  userId: v.string(),
  scope: v.string(),
  expiresAt: v.optional(v.number()), // null = never expires
  createdAt: v.number(),
})
  .index("by_token_hash", ["tokenHash"])
  .index("by_user_client", ["userId", "clientId"]);
```

#### 1.2 Mutations: `mcp_oauth/mutations.ts`

```typescript
// registerClient - Store new dynamic client registration
// createAuthorizationCode - Create short-lived auth code
// exchangeCodeForTokens - Validate code, create refresh token
// refreshAccessToken - Validate refresh token, issue new access token
// revokeToken - Delete refresh token
// cleanupExpiredCodes - Cron job to delete expired codes
```

#### 1.3 Queries: `mcp_oauth/queries.ts`

```typescript
// getClientById - Validate client exists
// validateAuthorizationCode - Check code validity
// validateRefreshToken - Check refresh token validity
```

---

### Phase 2: MCP Server OAuth Endpoints

**Files to create/modify in `apps/mcp-server/src/`:**

#### 2.1 New: `oauth/types.ts`

```typescript
// OAuth request/response types
// PKCE types
// Token types (access, refresh)
```

#### 2.2 New: `oauth/crypto.ts`

```typescript
// generateClientId() - UUID
// generateClientSecret() - Random string
// generateAuthorizationCode() - Random string
// generateRefreshToken() - Random string
// hashToken(token) - SHA-256 for storage
// verifyPKCE(verifier, challenge, method)
// signJWT(payload) - Sign access tokens
// verifyJWT(token) - Verify access tokens
```

#### 2.3 New: `oauth/storage.ts`

```typescript
// Convex client for OAuth storage
// createClient(data) → calls Convex mutation
// getClient(clientId) → calls Convex query
// createCode(data) → calls Convex mutation
// validateCode(code) → calls Convex query + delete
// createRefreshToken(data) → calls Convex mutation
// validateRefreshToken(token) → calls Convex query
// revokeRefreshToken(token) → calls Convex mutation
```

#### 2.4 New: `oauth/handlers.ts`

```typescript
// handleRegister(req) - Dynamic client registration (RFC 7591)
// handleAuthorize(req) - Start auth flow, redirect to Clerk
// handleCallback(req) - Clerk callback, issue our code
// handleToken(req) - Token endpoint (code exchange, refresh)
// handleRevoke(req) - Token revocation
```

#### 2.5 New: `oauth/routes.ts`

```typescript
// Hono routes for OAuth endpoints
// POST /oauth/register
// GET  /oauth/authorize
// GET  /oauth/callback (internal - Clerk redirects here)
// POST /oauth/token
// POST /oauth/revoke
```

#### 2.6 Update: `index.ts`

```typescript
// Import and mount OAuth routes
// Update discovery endpoints to point to ourselves
// Update token validation to use our JWTs
```

---

### Phase 3: OAuth Flow Implementation

#### 3.1 Dynamic Client Registration (`/oauth/register`)

```
1. Client sends POST with redirect_uris, grant_types, etc.
2. Generate client_id (and client_secret for confidential clients)
3. Store in Convex mcp_oauth_clients
4. Return client credentials
```

#### 3.2 Authorization (`/oauth/authorize`)

```
1. Validate client_id, redirect_uri, response_type, scope
2. Validate PKCE if provided (code_challenge, code_challenge_method)
3. Store state in session/cookie (client_id, redirect_uri, scope, PKCE)
4. Redirect to Clerk OAuth authorize endpoint
5. User logs in via Clerk
6. Clerk redirects to /oauth/callback with Clerk code
```

#### 3.3 Callback (`/oauth/callback`)

```
1. Exchange Clerk code for Clerk tokens (get user info)
2. Generate our authorization code
3. Store code in Convex with user_id, client_id, scope, PKCE challenge
4. Redirect to client's redirect_uri with our code
```

#### 3.4 Token Exchange (`/oauth/token`)

**Grant type: authorization_code**

```
1. Validate client_id (and client_secret if confidential)
2. Validate authorization code from Convex
3. Validate PKCE verifier if challenge was provided
4. Delete used authorization code
5. Generate access token (JWT, 1 hour expiry)
6. Generate refresh token (random, store hash in Convex)
7. Return tokens
```

**Grant type: refresh_token**

```
1. Validate refresh token from Convex
2. Generate new access token (JWT)
3. Optionally rotate refresh token
4. Return new tokens
```

---

### Phase 4: Token Format

#### Access Token (JWT)

```json
{
  "iss": "https://mcp.seal.nyc",
  "sub": "user_clerk_id",
  "aud": "https://mcp.seal.nyc/mcp",
  "exp": 1234567890,
  "iat": 1234567890,
  "scope": "profile email",
  "client_id": "generated_client_id"
}
```

Signed with a secret key (env: `MCP_JWT_SECRET`).

#### Refresh Token

- Random 256-bit string (base64url encoded)
- Stored as SHA-256 hash in Convex
- Long-lived (configurable, e.g., 30 days or never expires)

---

### Phase 5: Discovery Endpoints Update

#### `/.well-known/oauth-authorization-server`

```json
{
  "issuer": "https://mcp.seal.nyc",
  "authorization_endpoint": "https://mcp.seal.nyc/oauth/authorize",
  "token_endpoint": "https://mcp.seal.nyc/oauth/token",
  "registration_endpoint": "https://mcp.seal.nyc/oauth/register",
  "revocation_endpoint": "https://mcp.seal.nyc/oauth/revoke",
  "scopes_supported": ["profile", "email"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["none", "client_secret_basic", "client_secret_post"],
  "code_challenge_methods_supported": ["plain", "S256"]
}
```

#### `/.well-known/oauth-protected-resource`

```json
{
  "resource": "https://mcp.seal.nyc/mcp",
  "authorization_servers": ["https://mcp.seal.nyc"],
  "scopes_supported": ["profile", "email"],
  "bearer_methods_supported": ["header"]
}
```

---

## File Structure After Implementation

```
apps/mcp-server/src/
├── index.ts                    # Main app (updated)
├── oauth/
│   ├── types.ts               # OAuth types
│   ├── crypto.ts              # Crypto utilities
│   ├── storage.ts             # Convex storage client
│   ├── handlers.ts            # OAuth endpoint handlers
│   └── routes.ts              # Hono routes
├── client.ts                  # Seal API client (existing)
├── config.ts                  # Config (existing)
├── tools/                     # MCP tools (existing)
├── resources/                 # MCP resources (existing)
└── utils/                     # Utilities (existing)

apps/backend/convex/
├── schemas/
│   └── mcp_oauth.ts           # OAuth tables schema (new)
├── mcp_oauth/
│   ├── mutations.ts           # OAuth mutations (new)
│   └── queries.ts             # OAuth queries (new)
└── schema.ts                  # Update to include mcp_oauth tables
```

---

## Environment Variables

**New variables needed:**

```env
# JWT signing secret (generate with: openssl rand -base64 32)
MCP_JWT_SECRET=your-256-bit-secret

# Token lifetimes (optional, has defaults)
MCP_ACCESS_TOKEN_TTL=3600       # 1 hour in seconds
MCP_REFRESH_TOKEN_TTL=2592000   # 30 days in seconds (0 = never)
MCP_AUTH_CODE_TTL=600           # 10 minutes in seconds
```

---

## Security Considerations

1. **Authorization codes** - One-time use, short-lived (10 min), stored hashed
2. **Refresh tokens** - Stored hashed, can be rotated on use
3. **Access tokens** - JWTs, short-lived (1 hour), stateless verification
4. **PKCE** - Required for public clients, prevents code interception
5. **Client secrets** - Stored hashed, only for confidential clients
6. **HTTPS only** - All OAuth endpoints require HTTPS in production

---

## Testing Checklist

- [ ] Dynamic client registration works
- [ ] Authorization flow redirects to Clerk correctly
- [ ] Callback creates valid authorization code
- [ ] Token exchange returns valid access + refresh tokens
- [ ] Access token validates correctly on /mcp endpoint
- [ ] Refresh token grants new access token
- [ ] Token revocation works
- [ ] PKCE validation works (S256 and plain)
- [ ] Expired codes are rejected
- [ ] Invalid refresh tokens are rejected
- [ ] Claude Code can connect and stay authenticated across restarts

---

## Estimated Implementation Time

| Phase     | Tasks                       | Estimate        |
| --------- | --------------------------- | --------------- |
| Phase 1   | Convex schema + API         | 2-3 hours       |
| Phase 2   | MCP OAuth endpoints         | 4-5 hours       |
| Phase 3   | OAuth flow logic            | 3-4 hours       |
| Phase 4   | Token generation/validation | 2-3 hours       |
| Phase 5   | Discovery endpoints update  | 1 hour          |
| Testing   | End-to-end testing          | 2-3 hours       |
| **Total** |                             | **14-19 hours** |

---

## Implementation Status

✅ **Phase 1: Convex Schema & API** - COMPLETED

- Created `apps/backend/convex/schemas/mcp_oauth.ts`
- Created `apps/backend/convex/mcp_oauth/mutations.ts`
- Created `apps/backend/convex/mcp_oauth/queries.ts`
- Created `apps/backend/convex/mcp_oauth/http.ts` (HTTP endpoints)
- Updated `apps/backend/convex/schema.ts`
- Updated `apps/backend/convex/http.ts` (mounted OAuth routes)
- Updated `apps/backend/convex/rls.ts` (added RLS rules)

✅ **Phase 2-4: MCP OAuth Endpoints** - COMPLETED

- Created `apps/mcp-server/src/oauth/types.ts`
- Created `apps/mcp-server/src/oauth/crypto.ts`
- Created `apps/mcp-server/src/oauth/storage.ts`
- Created `apps/mcp-server/src/oauth/handlers.ts`
- Created `apps/mcp-server/src/oauth/routes.ts`

✅ **Phase 5: Discovery & Integration** - COMPLETED

- Updated `apps/mcp-server/src/index.ts`
- Discovery endpoints now point to our own OAuth server
- MCP endpoint validates our JWTs instead of Clerk tokens

⏳ **Testing** - PENDING

---

## Required Environment Variables

### MCP Server (apps/mcp-server)

```env
# Required: JWT signing secret (generate with: openssl rand -base64 32)
MCP_JWT_SECRET=your-256-bit-secret

# Required: URL where MCP server is deployed
MCP_SERVER_URL=https://mcp.seal.nyc

# Required: Convex deployment URL (for OAuth storage)
CONVEX_SITE_URL=https://your-deployment.convex.site

# Required: Internal secret for Convex OAuth API calls
MCP_INTERNAL_SECRET=your-internal-secret

# Required: Clerk configuration (for user authentication)
CLERK_FRONTEND_API=https://your-clerk-frontend-api.clerk.accounts.dev
CLERK_SECRET_KEY=sk_test_...

# Optional: Token lifetimes (has defaults)
MCP_ACCESS_TOKEN_TTL=3600       # 1 hour in seconds (default)
MCP_REFRESH_TOKEN_TTL=2592000   # 30 days in seconds (default, 0 = never)
MCP_AUTH_CODE_TTL=600           # 10 minutes in seconds (default)
```

### Backend/Convex (apps/backend)

```env
# Required: Same internal secret as MCP server
MCP_INTERNAL_SECRET=your-internal-secret
```

---

## Next Steps

1. ~~Review and approve this plan~~ ✅
2. ~~Implement Phase 1 (Convex schema)~~ ✅
3. ~~Implement Phase 2-4 (OAuth endpoints)~~ ✅
4. ~~Implement Phase 5 (Discovery update)~~ ✅
5. **Configure environment variables in Vercel/Convex**
6. **Deploy backend to Convex** (`npx convex deploy`)
7. **Deploy MCP server to Vercel**
8. Test with Claude Code
9. Verify tokens persist across restarts
