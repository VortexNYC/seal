import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { importJWK, SignJWT } from "jose";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import {
  member,
  mcpOAuthAuthorizationCodes,
  mcpOAuthClients,
  mcpOAuthRefreshTokens,
  organization,
} from "../global/schema.js";
import { type SessionUser } from "../platform/session.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { user: SessionUser | null };
}>();

const MCP_PATH = "/mcp";
export const ISSUER_PATH = "/oauth/seal-mcp";
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

const DEFAULT_ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_AUTHORIZATION_CODE_LIFETIME_SECONDS = 5 * 60;

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

function oauthError(status: number, error: string, description?: string) {
  return new Response(
    JSON.stringify({
      error,
      ...(description ? { error_description: description } : {}),
    }),
    { status, headers: { "content-type": "application/json" } }
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

export async function getMcpPublicKey(
  env: CloudflareBindings
): Promise<CryptoKey | null> {
  const jwk = await loadSigningJwk(env);
  if (!jwk) return null;
  const publicJwk = await publicJwkFromPrivate(jwk);
  if (!publicJwk) return null;
  const alg = typeof jwk.alg === "string" ? jwk.alg : "ES256";
  publicJwk.kid = getKeyId(jwk, env);
  publicJwk.alg = alg;
  try {
    const key = await importJWK(publicJwk, alg);
    return key instanceof CryptoKey ? key : null;
  } catch {
    return null;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateSecureToken(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

async function derivePkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function parseScope(scope: string | null | undefined): string[] {
  if (!scope) return [];
  return scope
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeScopes(scopes: string[]): string[] {
  return Array.from(new Set(scopes.map((s) => s.trim()).filter(Boolean)));
}

function intersectScopes(
  requested: string[],
  allowed: string[]
): string[] | null {
  if (requested.length === 0) return normalizeScopes(allowed);
  const allowedSet = new Set(allowed);
  for (const scope of requested) {
    if (!allowedSet.has(scope)) return null;
  }
  return normalizeScopes(requested);
}

function parseRedirectUris(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // fall through
  }
  return [];
}

function validateRedirectUri(
  client: typeof mcpOAuthClients.$inferSelect,
  redirectUri: string
): boolean {
  const allowed = parseRedirectUris(client.redirectUris);
  return allowed.includes(redirectUri);
}

function clientAllowedScopes(
  client: typeof mcpOAuthClients.$inferSelect
): string[] {
  return parseScope(client.allowedScopes);
}

async function createAccessToken(
  env: CloudflareBindings,
  {
    userId,
    organizationId,
    organizationSlug,
    scopes,
    clientId,
    jti,
  }: {
    userId: string;
    organizationId: string | null;
    organizationSlug: string | null;
    scopes: string[];
    clientId: string;
    jti: string;
  }
): Promise<{ token: string; expiresIn: number } | null> {
  const key = await importMcpSigningKey(env);
  if (!key) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = DEFAULT_ACCESS_TOKEN_LIFETIME_SECONDS;
  const jwt = await new SignJWT({
    sub: userId,
    ...(organizationId ? { organizationId } : {}),
    ...(organizationSlug ? { organizationSlug } : {}),
    clientId,
    scope: scopes.join(" "),
    jti,
  })
    .setProtectedHeader({ alg: "ES256", kid: getMcpKeyId(env), typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .setIssuer(`${env.BETTER_AUTH_URL ?? "https://api.seal.nyc"}${ISSUER_PATH}`)
    .setAudience(env.BETTER_AUTH_URL ?? "https://api.seal.nyc")
    .sign(key);

  return { token: jwt, expiresIn };
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

// ---------------------------------------------------------------------------
// Dynamic client registration (RFC 7591 subset)
// ---------------------------------------------------------------------------

const registerClientSchema = z.object({
  client_name: z.string().min(1),
  redirect_uris: z.array(z.string().url()).min(1),
  scope: z.string().optional(),
  token_endpoint_auth_method: z
    .enum([
      "none",
      "client_secret_post",
      "client_secret_basic",
      "private_key_jwt",
    ])
    .optional(),
  grant_types: z
    .array(
      z.enum(["authorization_code", "refresh_token", "client_credentials"])
    )
    .optional(),
  response_types: z.array(z.enum(["code"])).optional(),
});

app.post("/register", async (c) => {
  const db = createD1(c.env.D1);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return oauthError(
      400,
      "invalid_client_metadata",
      "Request body is not valid JSON"
    );
  }

  const parsed = registerClientSchema.safeParse(body);
  if (!parsed.success) {
    return oauthError(400, "invalid_client_metadata", parsed.error.message);
  }

  const input = parsed.data;
  const requestedScopes = parseScope(input.scope);
  const allowedScopes = intersectScopes(
    requestedScopes.length > 0 ? requestedScopes : ["mcp"],
    MCP_OAUTH_SCOPES
  );
  if (!allowedScopes || allowedScopes.length === 0) {
    return oauthError(400, "invalid_client_metadata", "No allowed scopes");
  }

  const clientId = crypto.randomUUID();
  const now = new Date();
  await db.insert(mcpOAuthClients).values({
    id: clientId,
    name: input.client_name,
    redirectUris: JSON.stringify(input.redirect_uris),
    allowedScopes: allowedScopes.join(" "),
    tokenEndpointAuthMethod: input.token_endpoint_auth_method ?? "none",
    grantTypes: (input.grant_types ?? ["authorization_code"]).join(" "),
    responseTypes: (input.response_types ?? ["code"]).join(" "),
    createdAt: now,
    updatedAt: now,
  });

  return c.json(
    {
      client_id: clientId,
      client_name: input.client_name,
      redirect_uris: input.redirect_uris,
      scope: allowedScopes.join(" "),
      token_endpoint_auth_method: input.token_endpoint_auth_method ?? "none",
      grant_types: input.grant_types ?? ["authorization_code"],
      response_types: input.response_types ?? ["code"],
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    201
  );
});

// ---------------------------------------------------------------------------
// Authorization endpoint
// ---------------------------------------------------------------------------

const authorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().min(1),
  code_challenge_method: z.literal("S256"),
  organization_slug: z.string().optional(),
});

app.get("/authorize", async (c) => {
  const db = createD1(c.env.D1);
  const query = Object.fromEntries(new URL(c.req.url).searchParams.entries());
  const parsed = authorizeQuerySchema.safeParse(query);
  if (!parsed.success) {
    return oauthError(400, "invalid_request", parsed.error.message);
  }

  const params = parsed.data;

  const clients = await db
    .select()
    .from(mcpOAuthClients)
    .where(eq(mcpOAuthClients.id, params.client_id));
  const client = clients[0];
  if (!client) {
    return oauthError(400, "invalid_request", "Unknown client");
  }

  if (!validateRedirectUri(client, params.redirect_uri)) {
    return oauthError(400, "invalid_request", "Invalid redirect_uri");
  }

  const requestedScopes = parseScope(params.scope);
  const allowedScopes = clientAllowedScopes(client);
  const scopes = intersectScopes(requestedScopes, allowedScopes);
  if (!scopes || scopes.length === 0) {
    return oauthError(400, "invalid_scope", "Requested scope is not allowed");
  }

  const sessionUser = c.get("user");
  if (!sessionUser) {
    // TODO: redirect to Better Auth login instead of returning JSON
    return oauthError(401, "login_required", "User must be authenticated");
  }

  const userId = sessionUser.user.id;
  let organizationId: string | null = null;

  if (params.organization_slug) {
    const orgs = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, params.organization_slug))
      .limit(1);
    const [firstOrg] = orgs;
    if (!firstOrg) {
      return oauthError(400, "invalid_request", "Unknown organization");
    }
    const memberships = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, firstOrg.id)
        )
      )
      .limit(1);
    if (memberships.length === 0) {
      return oauthError(403, "access_denied", "User is not a member");
    }
    organizationId = firstOrg.id;
  } else {
    const memberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);
    const [first] = memberships;
    if (!first) {
      return oauthError(403, "access_denied", "User has no organization");
    }
    organizationId = first.organizationId;
  }

  const code = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + DEFAULT_AUTHORIZATION_CODE_LIFETIME_SECONDS * 1000
  );

  await db.insert(mcpOAuthAuthorizationCodes).values({
    code,
    clientId: params.client_id,
    userId,
    organizationId,
    scopes: scopes.join(" "),
    redirectUri: params.redirect_uri,
    codeChallenge: params.code_challenge,
    codeChallengeMethod: params.code_challenge_method,
    state: params.state ?? null,
    expiresAt,
  });

  const redirect = new URL(params.redirect_uri);
  redirect.searchParams.set("code", code);
  if (params.state) redirect.searchParams.set("state", params.state);

  return Response.redirect(redirect.toString(), 302);
});

// ---------------------------------------------------------------------------
// Token endpoint
// ---------------------------------------------------------------------------

const tokenRequestSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string(),
  redirect_uri: z.string().url(),
  client_id: z.string(),
  code_verifier: z.string().min(1),
});

app.post("/token", async (c) => {
  const db = createD1(c.env.D1);

  let body: URLSearchParams;
  try {
    const buffer = await c.req.raw.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    body = new URLSearchParams(text);
  } catch {
    return oauthError(400, "invalid_request", "Invalid form body");
  }

  const raw = {
    grant_type: body.get("grant_type"),
    code: body.get("code"),
    redirect_uri: body.get("redirect_uri"),
    client_id: body.get("client_id"),
    code_verifier: body.get("code_verifier"),
  };

  const parsed = tokenRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return oauthError(400, "invalid_request", parsed.error.message);
  }

  const params = parsed.data;

  const clients = await db
    .select()
    .from(mcpOAuthClients)
    .where(eq(mcpOAuthClients.id, params.client_id));
  const client = clients[0];
  if (!client) {
    return oauthError(400, "invalid_client", "Unknown client");
  }

  if (!validateRedirectUri(client, params.redirect_uri)) {
    return oauthError(400, "invalid_grant", "redirect_uri mismatch");
  }

  const codes = await db
    .select()
    .from(mcpOAuthAuthorizationCodes)
    .where(eq(mcpOAuthAuthorizationCodes.code, params.code));
  const codeRecord = codes[0];
  if (!codeRecord) {
    return oauthError(400, "invalid_grant", "Invalid authorization code");
  }

  if (
    codeRecord.consumedAt !== null ||
    new Date(codeRecord.expiresAt).getTime() <= Date.now()
  ) {
    return oauthError(
      400,
      "invalid_grant",
      "Authorization code expired or used"
    );
  }

  if (codeRecord.clientId !== params.client_id) {
    return oauthError(400, "invalid_grant", "client_id mismatch");
  }

  if (codeRecord.redirectUri !== params.redirect_uri) {
    return oauthError(400, "invalid_grant", "redirect_uri mismatch");
  }

  const challenge = await derivePkceChallenge(params.code_verifier);
  if (challenge !== codeRecord.codeChallenge) {
    return oauthError(400, "invalid_grant", "PKCE verification failed");
  }

  await db
    .update(mcpOAuthAuthorizationCodes)
    .set({ consumedAt: new Date() })
    .where(eq(mcpOAuthAuthorizationCodes.code, params.code));

  const scopeString = codeRecord.scopes ?? client.allowedScopes;
  const scopes = normalizeScopes(parseScope(scopeString));

  let organizationSlug: string | null = null;
  if (codeRecord.organizationId) {
    const orgs = await db
      .select({ slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, codeRecord.organizationId))
      .limit(1);
    organizationSlug = orgs[0]?.slug ?? null;
  }

  const jti = crypto.randomUUID();
  const accessTokenResult = await createAccessToken(c.env, {
    userId: codeRecord.userId,
    organizationId: codeRecord.organizationId,
    organizationSlug,
    scopes,
    clientId: params.client_id,
    jti,
  });
  if (!accessTokenResult) {
    return oauthError(503, "server_error", "Unable to sign access token");
  }

  const refreshToken = await generateSecureToken();
  const refreshTokenHash = await hashToken(refreshToken);
  await db.insert(mcpOAuthRefreshTokens).values({
    id: crypto.randomUUID(),
    tokenHash: refreshTokenHash,
    clientId: params.client_id,
    userId: codeRecord.userId,
    organizationId: codeRecord.organizationId,
    scopes: scopes.join(" "),
    expiresAt: new Date(
      Date.now() + DEFAULT_REFRESH_TOKEN_LIFETIME_SECONDS * 1000
    ),
  });

  return c.json({
    access_token: accessTokenResult.token,
    token_type: "Bearer",
    expires_in: accessTokenResult.expiresIn,
    refresh_token: refreshToken,
    scope: scopes.join(" "),
  });
});

// ---------------------------------------------------------------------------
// JWKS endpoint
// ---------------------------------------------------------------------------

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
