# MCP SERVER GUIDE

## OVERVIEW
Model Context Protocol server exposing Seal tools/resources over HTTP or stdio.

## STRUCTURE
```
apps/mcp-server/
├── src/
│   ├── index.ts        # Server entry (HTTP + stdio)
│   ├── tools/          # Tool registrations
│   ├── resources/      # Resource registrations
│   ├── client.ts       # SealApiClient
│   ├── config.ts       # Zod config loader
│   └── utils/          # auth + logger
└── api/index.ts        # Vercel handler
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Server entry | `apps/mcp-server/src/index.ts` | Transport selection |
| Tool registry | `apps/mcp-server/src/tools/index.ts` | Registers all tools |
| Resource registry | `apps/mcp-server/src/resources/index.ts` | Registers all resources |
| API client | `apps/mcp-server/src/client.ts` | HTTP wrapper + errors |
| Auth extraction | `apps/mcp-server/src/utils/auth.ts` | MCP auth token parsing |

## CONVENTIONS
- Tools use Zod schemas from `@seal/backend/convex/validations/api`.
- Tool responses return `{ content: [{ type: "text", text: JSON.stringify(...) }] }`.
- Resources return `{ contents: [{ uri, mimeType, text }] }`.
- Log to stderr only (stdout reserved for MCP protocol).

## ANTI-PATTERNS
- Write to stdout in stdio mode.
- Skip `getAuthToken()`; always forward auth to `SealApiClient`.
- Use `upload_file` outside stdio mode (HTTP has no file system access).
