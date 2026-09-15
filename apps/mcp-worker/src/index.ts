/**
 * Seal MCP Server — Cloudflare Worker edition.
 *
 * Thin Streamable-HTTP MCP front for Seal. Speaks real MCP (initialize /
 * tools/list / tools/call) via the Agents SDK `createMcpHandler`, and each tool
 * forwards to the Seal API.
 *
 * Auth is handled by the OAuth endpoints in apps/api. The worker serves its own
 * OAuth protected-resource metadata and forwards MCP tool calls to
 * `SEAL_API_BASE_URL` (the Seal API).
 *
 * Env vars (wrangler.jsonc vars or secrets):
 *   SEAL_API_BASE_URL — Seal API base, e.g. https://api.seal.nyc/api/v1
 *   SEAL_API_KEY — optional server-to-server fallback credential
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";

import { SealApiClient } from "./client";
import { getConfig } from "./config";
import { registerAllPrompts } from "./prompts";
import { registerAllResources } from "./resources";
import { registerAllTools } from "./tools";

interface Env {
  SEAL_API_BASE_URL: string;
  SEAL_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  SEAL_AUTH_SERVER_ORIGIN?: string;
}

const MCP_OAUTH_RESOURCE_SLUG = "seal-mcp";
const MCP_PATH = "/mcp";
const OAUTH_BASE_PATH = "/oauth";
const ISSUER_PATH = `${OAUTH_BASE_PATH}/${MCP_OAUTH_RESOURCE_SLUG}`;
const PROTECTED_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource/${MCP_OAUTH_RESOURCE_SLUG}`;
const JWKS_PATH = `${ISSUER_PATH}/jwks`;

const MCP_OAUTH_SCOPES = [
  "mcp",
  "account:read",
  "account:write",
  "documents:read",
  "documents:write",
  "contacts:read",
  "contacts:write",
  "templates:read",
  "templates:write",
  "webhooks:read",
  "webhooks:write",
  "analytics:read",
  "settings:read",
  "settings:write",
  "signatures:read",
  "signatures:write",
];

function allowedOrigins(requestOrigin: string): Set<string> {
  const config = getConfig();
  const origins = new Set<string>([requestOrigin]);
  if (config.authServerOrigin) {
    origins.add(new URL(config.authServerOrigin).origin);
  }
  if (process.env.ALLOWED_ORIGINS) {
    for (const origin of process.env.ALLOWED_ORIGINS.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }
  return origins;
}

function withCors(request: Request, resp: Response): Response {
  const origin = request.headers.get("Origin");
  if (!origin) return resp;
  const requestOrigin = new URL(request.url).origin;
  if (!allowedOrigins(requestOrigin).has(origin)) return resp;

  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Expose-Headers", "WWW-Authenticate");
  h.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version"
  );
  h.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  return new Response(resp.body, { status: resp.status, headers: h });
}

function getBearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
}

// Bridge the Worker's `env` arg into process.env so `getConfig()` and other
// modules that read process.env keep working unchanged. The nodejs_compat
// compatibility flag guarantees the process shim exists; we just populate it.
function bridgeEnvToProcess(env: Env): void {
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") process.env[k] = v;
  }
}

function resolveAuthServerOrigin(
  config: ReturnType<typeof getConfig>,
  requestOrigin: string
): string {
  if (config.authServerOrigin) {
    return config.authServerOrigin.replace(/\/$/, "");
  }
  return requestOrigin.replace(/\/$/, "");
}

function buildProtectedResourceMetadata(
  resourceOrigin: string,
  authServerOrigin: string
) {
  const normalizedResourceOrigin = resourceOrigin.replace(/\/$/, "");
  const normalizedAuthServerOrigin = authServerOrigin.replace(/\/$/, "");
  return {
    resource: `${normalizedResourceOrigin}${MCP_PATH}`,
    authorization_servers: [`${normalizedAuthServerOrigin}${ISSUER_PATH}`],
    jwks_uri: `${normalizedAuthServerOrigin}${JWKS_PATH}`,
    bearer_methods_supported: ["header"],
    scopes_supported: MCP_OAUTH_SCOPES,
  };
}

function unauthorized(request: Request): Response {
  const url = new URL(request.url);
  return withCors(
    request,
    new Response(
      JSON.stringify({
        error: "unauthorized",
        error_description: "Missing bearer token",
      }),
      {
        status: 401,
        headers: {
          "content-type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${url.origin}${PROTECTED_RESOURCE_METADATA_PATH}"`,
        },
      }
    )
  );
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    bridgeEnvToProcess(env);

    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(request, new Response(null, { status: 204 }));
    }

    if (url.pathname === "/") {
      return withCors(
        request,
        Response.json({
          name: "Seal MCP Server",
          version: "0.0.1",
          description:
            "Model Context Protocol server for Seal document management",
          endpoints: {
            mcp: MCP_PATH,
            health: "/health",
            oauth_protected_resource: PROTECTED_RESOURCE_METADATA_PATH,
          },
          documentation: "https://docs.seal.nyc/api/mcp",
        })
      );
    }

    if (url.pathname === "/health") {
      return withCors(
        request,
        Response.json({
          status: "ok",
          name: "seal-mcp-server",
          version: "0.0.1",
        })
      );
    }

    // RFC 9728 protected-resource metadata — served locally. The authorization
    // server it advertises lives in apps/api (configurable via SEAL_AUTH_SERVER_ORIGIN).
    if (url.pathname === PROTECTED_RESOURCE_METADATA_PATH) {
      const config = getConfig();
      const authServerOrigin = resolveAuthServerOrigin(config, url.origin);
      return withCors(
        request,
        Response.json(
          buildProtectedResourceMetadata(url.origin, authServerOrigin)
        )
      );
    }

    if (url.pathname === MCP_PATH) {
      if (request.method !== "POST") {
        return withCors(
          request,
          Response.json(
            {
              jsonrpc: "2.0",
              error: { code: -32000, message: "Method not allowed" },
              id: null,
            },
            { status: 405 }
          )
        );
      }

      const bearer = getBearerToken(request);
      if (!bearer) {
        return unauthorized(request);
      }

      // Per-request server + tools/resources/prompts. The bearer is forwarded
      // to the Seal API for validation.
      const config = getConfig();
      const apiClient = new SealApiClient(config);
      const server = new McpServer({
        name: "seal-mcp-server",
        version: "0.0.1",
      });
      registerAllTools(server, apiClient);
      registerAllResources(server, apiClient);
      registerAllPrompts(server);

      const handler = createMcpHandler(server, {
        authContext: {
          props: {
            token: bearer,
          },
        },
      });
      return withCors(request, await handler(request, env, ctx));
    }

    return withCors(request, new Response("Not found", { status: 404 }));
  },
};
