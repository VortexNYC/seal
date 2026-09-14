import type { MiddlewareHandler } from "hono";
import { jwtVerify } from "jose";

import { getMcpPublicKey, ISSUER_PATH } from "../api/mcp-oauth.js";

export interface McpAccessToken {
  sub: string;
  organizationId?: string;
  organizationSlug?: string;
  scope: string;
  clientId: string;
  jti: string;
  kind?: "mcp" | "api";
}

type McpVariables = {
  mcp: McpAccessToken;
};

function getIssuerAndAudience(env: CloudflareBindings): {
  issuer: string;
  audience: string;
} {
  const base = (env.BETTER_AUTH_URL ?? "https://api.seal.nyc").replace(
    /\/$/,
    ""
  );
  return {
    issuer: `${base}${ISSUER_PATH}`,
    audience: base,
  };
}

export function mcpHasScope(token: McpAccessToken, required: string): boolean {
  const scopes = token.scope.split(/\s+/);
  if (scopes.includes(required)) return true;
  if (token.kind !== "api") return false;

  if (scopes.includes("admin")) return true;
  if (required.endsWith(":read") && scopes.includes("read")) return true;
  if (
    (required.endsWith(":write") ||
      required.endsWith(":create") ||
      required.endsWith(":update") ||
      required.endsWith(":delete") ||
      required.endsWith(":send")) &&
    scopes.includes("write")
  ) {
    return true;
  }
  if (
    (required.startsWith("signatures") || required.endsWith(":sign")) &&
    scopes.includes("sign")
  ) {
    return true;
  }
  return false;
}

export async function verifyMcpAccessToken(
  env: CloudflareBindings,
  token: string
): Promise<McpAccessToken | null> {
  const key = await getMcpPublicKey(env);
  if (!key) return null;

  try {
    const { issuer, audience } = getIssuerAndAudience(env);
    const { payload } = await jwtVerify(token, key, { issuer, audience });

    if (typeof payload.sub !== "string") return null;
    if (typeof payload.scope !== "string") return null;
    if (typeof payload.clientId !== "string") return null;
    if (typeof payload.jti !== "string") return null;

    return {
      sub: payload.sub,
      organizationId:
        typeof payload.organizationId === "string"
          ? payload.organizationId
          : undefined,
      organizationSlug:
        typeof payload.organizationSlug === "string"
          ? payload.organizationSlug
          : undefined,
      scope: payload.scope,
      clientId: payload.clientId,
      jti: payload.jti,
      kind: "mcp",
    };
  } catch {
    return null;
  }
}

export const mcpAuth: MiddlewareHandler<{
  Bindings: CloudflareBindings;
  Variables: McpVariables;
}> = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = header.slice("Bearer ".length).trim();
  const payload = await verifyMcpAccessToken(c.env, token);
  if (!payload) {
    return c.json({ error: "unauthorized" }, 401);
  }

  c.set("mcp", payload);
  return next();
};
