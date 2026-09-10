/**
 * Seal MCP Server — Cloudflare Worker edition.
 *
 * Thin Streamable-HTTP MCP front for Seal. Speaks real MCP (initialize /
 * tools/list / tools/call) via the Agents SDK `createMcpHandler`, and each tool
 * forwards to the Seal API.
 *
 * Auth is being migrated from Seal Convex into this worker. The worker now
 * serves its own OAuth protected-resource and authorization-server metadata;
 * the authorize/token/JWKS endpoints will be added next. Until then, the `/mcp`
 * tool calls still forward to the legacy Convex API base configured by
 * `SEAL_API_BASE_URL`.
 *
 * Env vars (wrangler.jsonc vars or secrets):
 *   SEAL_API_BASE_URL — Seal backend API base, e.g.
 *     https://<deployment>.convex.site/api/v1
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
}

const MCP_OAUTH_RESOURCE_SLUG = "seal-mcp";
const MCP_PATH = "/mcp";
const OAUTH_BASE_PATH = "/oauth";
const ISSUER_PATH = `${OAUTH_BASE_PATH}/${MCP_OAUTH_RESOURCE_SLUG}`;
const PROTECTED_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource/${MCP_OAUTH_RESOURCE_SLUG}`;
const AUTHORIZATION_SERVER_METADATA_PATH = `/.well-known/oauth-authorization-server/${MCP_OAUTH_RESOURCE_SLUG}`;
const AUTHORIZE_PATH = `${ISSUER_PATH}/authorize`;
const TOKEN_PATH = `${ISSUER_PATH}/token`;
const JWKS_PATH = `${ISSUER_PATH}/jwks`;
const REGISTRATION_PATH = `${ISSUER_PATH}/register`;

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

function withCors(resp: Response): Response {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
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

function buildProtectedResourceMetadata(origin: string) {
  const normalizedOrigin = origin.replace(/\/$/, "");
  return {
    resource: `${normalizedOrigin}${MCP_PATH}`,
    authorization_servers: [`${normalizedOrigin}${ISSUER_PATH}`],
    jwks_uri: `${normalizedOrigin}${JWKS_PATH}`,
    bearer_methods_supported: ["header"],
    scopes_supported: MCP_OAUTH_SCOPES,
  };
}

function buildAuthorizationServerMetadata(origin: string) {
  const normalizedOrigin = origin.replace(/\/$/, "");
  return {
    issuer: `${normalizedOrigin}${ISSUER_PATH}`,
    authorization_endpoint: `${normalizedOrigin}${AUTHORIZE_PATH}`,
    token_endpoint: `${normalizedOrigin}${TOKEN_PATH}`,
    registration_endpoint: `${normalizedOrigin}${REGISTRATION_PATH}`,
    jwks_uri: `${normalizedOrigin}${JWKS_PATH}`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: MCP_OAUTH_SCOPES,
    resource: `${normalizedOrigin}${MCP_PATH}`,
  };
}

function unauthorized(url: URL): Response {
  return withCors(
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
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname === "/") {
      return withCors(
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
          documentation: "https://docs.seal.app/api/mcp",
        })
      );
    }

    if (url.pathname === "/health") {
      return withCors(
        Response.json({
          status: "ok",
          name: "seal-mcp-server",
          version: "0.0.1",
        })
      );
    }

    // RFC 9728 protected-resource metadata — served locally so the worker no
    // longer depends on Convex for OAuth discovery.
    if (url.pathname === PROTECTED_RESOURCE_METADATA_PATH) {
      return withCors(
        Response.json(buildProtectedResourceMetadata(url.origin))
      );
    }

    // Authorization-server metadata for the same protected resource.
    if (url.pathname === AUTHORIZATION_SERVER_METADATA_PATH) {
      return withCors(
        Response.json(buildAuthorizationServerMetadata(url.origin))
      );
    }

    if (url.pathname === MCP_PATH) {
      if (request.method !== "POST") {
        return withCors(
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
        return unauthorized(url);
      }

      // Per-request server + tools/resources/prompts. The bearer is forwarded
      // to the Seal API; Convex currently validates it. Once the OAuth/token
      // endpoints are implemented in this worker, the data plane will move to
      // apps/api and validation will happen there.
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
      return withCors(await handler(request, env, ctx));
    }

    return withCors(new Response("Not found", { status: 404 }));
  },
};
