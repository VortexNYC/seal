import { OpenAPIHono } from "@hono/zod-openapi";
import { importJWK } from "jose";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const MCP_PATH = "/mcp";
const ISSUER_PATH = "/oauth/seal-mcp";
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

type Jwk = Record<string, unknown>;

function isRecord(value: unknown): value is Jwk {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeParseJwk(raw: string): Jwk | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function missingSigningKeyResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "server_error",
      error_description: "MCP signing key not configured",
    }),
    { status: 503, headers: { "content-type": "application/json" } }
  );
}

async function loadSigningJwk(env: CloudflareBindings): Promise<Jwk | null> {
  const raw = env.SEAL_MCP_SIGNING_KEY;
  if (!raw) return null;
  return safeParseJwk(raw);
}

function getKeyId(jwk: Jwk, env: CloudflareBindings): string {
  const fromJwk = typeof jwk.kid === "string" ? jwk.kid : undefined;
  return fromJwk ?? env.SEAL_MCP_SIGNING_KEY_ID ?? "seal-mcp-key-1";
}

async function publicJwkFromPrivate(jwk: Jwk): Promise<Jwk | null> {
  const kid = typeof jwk.kid === "string" ? jwk.kid : "seal-mcp-key-1";
  const kty = typeof jwk.kty === "string" ? jwk.kty : undefined;
  if (!kty) return null;

  if (kty === "EC") {
    const crv = typeof jwk.crv === "string" ? jwk.crv : undefined;
    const x = typeof jwk.x === "string" ? jwk.x : undefined;
    const y = typeof jwk.y === "string" ? jwk.y : undefined;
    if (!crv || !x || !y) return null;
    return { kty, crv, x, y, kid, use: "sig" };
  }

  if (kty === "RSA") {
    const n = typeof jwk.n === "string" ? jwk.n : undefined;
    const e = typeof jwk.e === "string" ? jwk.e : undefined;
    if (!n || !e) return null;
    return { kty, n, e, kid, use: "sig" };
  }

  if (kty === "OKP") {
    const crv = typeof jwk.crv === "string" ? jwk.crv : undefined;
    const x = typeof jwk.x === "string" ? jwk.x : undefined;
    if (!crv || !x) return null;
    return { kty, crv, x, kid, use: "sig" };
  }

  return null;
}

export async function importMcpSigningKey(
  env: CloudflareBindings
): Promise<CryptoKey | null> {
  const jwk = await loadSigningJwk(env);
  if (!jwk) return null;
  const alg = typeof jwk.alg === "string" ? jwk.alg : undefined;
  if (!alg) return null;
  try {
    const key = await importJWK(jwk, alg);
    return key instanceof CryptoKey ? key : null;
  } catch {
    return null;
  }
}

export function getMcpKeyId(env: CloudflareBindings): string {
  const jwk = env.SEAL_MCP_SIGNING_KEY;
  if (!jwk) return env.SEAL_MCP_SIGNING_KEY_ID ?? "seal-mcp-key-1";
  const parsed = safeParseJwk(jwk);
  return parsed
    ? getKeyId(parsed, env)
    : (env.SEAL_MCP_SIGNING_KEY_ID ?? "seal-mcp-key-1");
}

export function buildAuthorizationServerMetadata(origin: string) {
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

app.get("/", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(buildAuthorizationServerMetadata(origin));
});

app.get("/jwks", async (c) => {
  const jwk = await loadSigningJwk(c.env);
  if (!jwk) {
    return missingSigningKeyResponse();
  }
  const publicJwk = await publicJwkFromPrivate(jwk);
  if (!publicJwk) {
    return new Response(
      JSON.stringify({
        error: "server_error",
        error_description: "Invalid MCP signing key",
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }
  publicJwk.kid = getKeyId(jwk, c.env);
  return c.json({ keys: [publicJwk] });
});

export default app;
