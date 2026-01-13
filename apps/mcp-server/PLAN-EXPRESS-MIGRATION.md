# MCP Server Migration: Hono → Express + Clerk

## Overview

Migrate the MCP server from Hono with custom OAuth proxy to Express with Clerk's official `@clerk/mcp-tools/express` package.

## Current vs Target Architecture

### Current (Hono + Custom OAuth Proxy)
```
Claude Code → MCP OAuth Proxy → Clerk (behind scenes) → MCP issues own JWTs
```
- ~1000+ lines of custom OAuth code
- Custom JWT handling
- Custom Convex storage for OAuth state
- Maintenance burden

### Target (Express + @clerk/mcp-tools)
```
Claude Code → Clerk OAuth (via @clerk/mcp-tools) → MCP validates Clerk tokens
```
- ~50 lines using Clerk's official helpers
- Standard Clerk middleware
- No custom OAuth storage needed
- Official Clerk support

---

## Migration Steps

### Phase 1: Update Dependencies

**Remove:**
- `hono` - Web framework

**Add:**
- `express` - Web framework
- `@clerk/express` - Clerk middleware for Express
- `@clerk/mcp-tools` - MCP-specific OAuth helpers
- `cors` - CORS middleware

**package.json changes:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@clerk/express": "^1.x.x",
    "@clerk/mcp-tools": "^0.x.x",
    "cors": "^2.x.x",
    "express": "^4.21.x",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/express": "^4.x.x",
    "@types/cors": "^2.x.x"
  }
}
```

---

### Phase 2: Rewrite Entry Point (src/index.ts)

**From Hono:**
```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());
app.get("/.well-known/oauth-protected-resource", ...);
app.all("/mcp", ...);
```

**To Express + @clerk/mcp-tools:**
```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware, type MachineAuthObject } from '@clerk/express';
import {
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  authServerMetadataHandlerClerk,
  streamableHttpHandler,
} from '@clerk/mcp-tools/express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const app = express();
app.use(cors({ exposedHeaders: ['WWW-Authenticate'] }));
app.use(clerkMiddleware());
app.use(express.json());

// Create MCP server
const server = new McpServer({
  name: 'seal-mcp-server',
  version: '0.0.1',
});

// Register tools and resources
registerAllTools(server, apiClient);
registerAllResources(server, apiClient);

// MCP endpoint with Clerk auth
app.post('/mcp', mcpAuthClerk, streamableHttpHandler(server));

// OAuth discovery endpoints
app.get(
  '/.well-known/oauth-protected-resource/mcp',
  protectedResourceHandlerClerk({ scopes_supported: ['email', 'profile'] })
);
app.get('/.well-known/oauth-authorization-server', authServerMetadataHandlerClerk);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', name: 'seal-mcp-server', version: '0.0.1' });
});

app.listen(process.env.PORT || 5183);
```

---

### Phase 3: Update Auth Utilities

**Current (`src/utils/auth.ts`):**
- Custom token extraction from MCP context

**New approach:**
- Use Clerk's `authInfo` from `@clerk/mcp-tools`
- Access user data via `clerkClient` in tool handlers

**Tool handler example:**
```typescript
server.tool(
  'get_document',
  'Gets a specific document',
  { documentId: z.string() },
  async ({ documentId }, { authInfo }) => {
    // authInfo.extra contains userId from Clerk
    const userId = authInfo!.extra!.userId! as string;

    // Use API client with user context
    const document = await apiClient.get(`/documents/${documentId}`, {
      userId,
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(document) }],
    };
  }
);
```

---

### Phase 4: Update Vercel Handler (api/index.ts)

**Current:**
```typescript
import app from '../src/index';
// Convert Vercel request → Hono → response
```

**New (Express for Vercel):**
```typescript
import app from '../src/index';
// Express app works directly with Vercel
export default app;
```

May need `@vercel/node` express adapter or serverless-http.

---

### Phase 5: Remove Custom OAuth Code

**Files to delete:**
- `src/oauth/types.ts`
- `src/oauth/crypto.ts`
- `src/oauth/storage.ts`
- `src/oauth/handlers.ts`
- `src/oauth/routes.ts`

**Backend files to potentially remove:**
- `convex/schemas/mcp_oauth.ts`
- `convex/mcp_oauth/mutations.ts`
- `convex/mcp_oauth/queries.ts`
- `convex/mcp_oauth/http.ts`

---

### Phase 6: Update Configuration

**Environment variables:**

**Keep:**
- `SEAL_API_BASE_URL`
- `SEAL_API_KEY` (fallback)
- `SEAL_REQUEST_TIMEOUT`
- `SEAL_DEBUG`

**Add (Clerk):**
- `CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key

**Remove:**
- `MCP_JWT_SECRET`
- `MCP_SERVER_URL`
- `MCP_INTERNAL_SECRET`
- `MCP_ACCESS_TOKEN_TTL`
- `MCP_REFRESH_TOKEN_TTL`
- `MCP_AUTH_CODE_TTL`
- `CLERK_FRONTEND_API`
- `CONVEX_SITE_URL`

---

## File Changes Summary

### Modified Files
| File | Changes |
|------|---------|
| `package.json` | Update dependencies |
| `src/index.ts` | Complete rewrite to Express |
| `src/config.ts` | Remove OAuth config, add Clerk config |
| `src/client.ts` | Update auth handling |
| `src/utils/auth.ts` | Simplify to use Clerk authInfo |
| `api/index.ts` | Update for Express |
| `vercel.json` | Ensure Express compatibility |
| `tsconfig.json` | No changes expected |

### Deleted Files
| File | Reason |
|------|--------|
| `src/oauth/types.ts` | Custom OAuth no longer needed |
| `src/oauth/crypto.ts` | Custom JWT no longer needed |
| `src/oauth/storage.ts` | Convex OAuth storage no longer needed |
| `src/oauth/handlers.ts` | Custom OAuth handlers no longer needed |
| `src/oauth/routes.ts` | Custom OAuth routes no longer needed |

### Unchanged Files
| File | Reason |
|------|--------|
| `src/tools/*.ts` | MCP tools remain the same (minor auth updates) |
| `src/resources/*.ts` | MCP resources remain the same |
| `src/utils/logger.ts` | Logging utilities unchanged |

---

## Clerk Dashboard Configuration

1. **Enable Dynamic Client Registration:**
   - Go to Clerk Dashboard → OAuth Applications
   - Enable "Dynamic client registration"

2. **Configure OAuth Scopes:**
   - Ensure `email` and `profile` scopes are available

3. **Set Environment Variables:**
   - Add `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to Vercel

---

## Testing Checklist

- [ ] Express server starts locally
- [ ] Health endpoint responds
- [ ] OAuth discovery endpoints work:
  - [ ] `/.well-known/oauth-protected-resource/mcp`
  - [ ] `/.well-known/oauth-authorization-server`
- [ ] Claude Code can discover the server
- [ ] Claude Code can authenticate via Clerk
- [ ] MCP tools work with authenticated user
- [ ] Vercel deployment works
- [ ] Session persists across Claude Code restarts

---

## Rollback Plan

If issues arise with Clerk's Express integration:
1. The Hono + custom OAuth proxy code is in git history
2. Can revert to previous commit
3. Custom OAuth storage in Convex can be re-enabled

---

## Implementation Order

1. Create new Express entry point (don't delete Hono yet)
2. Test Express locally with Clerk
3. Verify Claude Code can connect
4. Delete Hono/custom OAuth code
5. Deploy to Vercel
6. Clean up Convex OAuth tables (optional)
