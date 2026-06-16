/**
 * Seal MCP Server — Cloudflare Worker edition.
 *
 * Thin Streamable-HTTP MCP front for Seal. Speaks real MCP (initialize /
 * tools/list / tools/call) via the Agents SDK `createMcpHandler`, and each tool
 * forwards to Seal's `/api/v1` REST resource server (see ./tools + ./client).
 *
 * Auth is delegated entirely to Seal Convex (`@plasmapos/vortex-auth` MCP OAuth
 * server + `resolveMcpApiAuth` at `/api/v1`). The worker does NOT verify tokens
 * itself: it requires a bearer to be present and passes it straight through;
 * Seal's `/api/v1` validates the Better-Auth MCP access token. The authorization
 * server, JWKS, and token validation all live in Seal Convex.
 *
 * Discovery: the worker advertises Seal Convex's protected-resource metadata
 * (proxied) so the MCP client discovers Seal's OAuth authorization server and
 * runs authorize/PKCE/token directly against the Convex site.
 *
 * Env vars (wrangler.jsonc vars or secrets):
 *   SEAL_API_BASE_URL — Seal backend API base, e.g.
 *     https://<deployment>.convex.site/api/v1 (the Convex site origin is
 *     derived from this to reach the OAuth metadata endpoints)
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

// RFC 9728 protected-resource metadata, served by the worker for its own /mcp
// resource and proxied from Seal Convex's seal-mcp document.
const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";
const SEAL_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource/seal-mcp";

function withCors(resp: Response): Response {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
  h.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
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

/** Convex site origin (hosts the OAuth metadata) derived from the API base. */
function getConvexSiteOrigin(env: Env): string {
  return new URL(env.SEAL_API_BASE_URL).origin;
}

type WorkerGlobalWithProcess = typeof globalThis & {
  process?: {
    env: Record<string, string>;
  };
};

// Bridge the Worker's `env` arg into process.env so `getConfig()` and other
// modules that read process.env keep working unchanged. nodejs_compat provides
// the process shim; we just need to populate env values.
function bridgeEnvToProcess(env: Env): void {
  const g = globalThis as WorkerGlobalWithProcess;
  g.process = g.process || { env: {} };
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") g.process.env[k] = v;
  }
}

function unauthorized(url: URL): Response {
  return withCors(
    new Response(
      JSON.stringify({ error: "unauthorized", error_description: "Missing bearer token" }),
      {
        status: 401,
        headers: {
          "content-type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${url.origin}${PROTECTED_RESOURCE_PATH}"`,
        },
      },
    ),
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
          description: "Model Context Protocol server for Seal document management",
          endpoints: {
            mcp: "/mcp",
            health: "/health",
            oauth_protected_resource: PROTECTED_RESOURCE_PATH,
          },
          documentation: "https://docs.seal.app/api/mcp",
        }),
      );
    }

    if (url.pathname === "/health") {
      return withCors(Response.json({ status: "ok", name: "seal-mcp-server", version: "0.0.1" }));
    }

    // RFC 9728 protected-resource metadata — proxied from Seal Convex's seal-mcp
    // document so the client discovers Seal's OAuth authorization server.
    if (
      url.pathname === PROTECTED_RESOURCE_PATH ||
      url.pathname === `${PROTECTED_RESOURCE_PATH}/mcp`
    ) {
      try {
        const upstream = await fetch(`${getConvexSiteOrigin(env)}${SEAL_PROTECTED_RESOURCE_PATH}`);
        const body = await upstream.text();
        return withCors(
          new Response(body, {
            status: upstream.status,
            headers: { "content-type": "application/json" },
          }),
        );
      } catch (error) {
        return withCors(
          Response.json(
            {
              error: "metadata_unavailable",
              error_description: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 502 },
          ),
        );
      }
    }

    if (url.pathname === "/mcp") {
      if (request.method !== "POST") {
        return withCors(
          Response.json(
            { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null },
            { status: 405 },
          ),
        );
      }

      const bearer = getBearerToken(request);
      if (!bearer) {
        return unauthorized(url);
      }

      // Per-request server + tools/resources/prompts. The verified bearer is
      // passed through unchanged; Seal's /api/v1 (resolveMcpApiAuth) is the auth
      // gate. Tools read the token via getMcpAuthContext().props (utils/auth.ts).
      const config = getConfig();
      const apiClient = new SealApiClient(config);
      const server = new McpServer({ name: "seal-mcp-server", version: "0.0.1" });
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
