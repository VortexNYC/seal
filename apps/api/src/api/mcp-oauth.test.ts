import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { exportJWK, generateKeyPair } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import {
  mcpOAuthAuthorizationCodes,
  mcpOAuthClients,
  mcpOAuthRefreshTokens,
  organization,
  user,
} from "../global/schema.js";
import mcpOauth from "./mcp-oauth.js";

function createApp() {
  const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
  app.route("/oauth/seal-mcp", mcpOauth);
  return app;
}

async function generatePkce() {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = Buffer.from(verifierBytes).toString("base64url");
  const challengeBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  const challenge = Buffer.from(challengeBuffer).toString("base64url");
  return { verifier, challenge };
}

async function configureSigningKey() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  privateJwk.alg = "ES256";
  privateJwk.kid = "test-key-id";
  env.SEAL_MCP_SIGNING_KEY = JSON.stringify(privateJwk);
  env.SEAL_MCP_SIGNING_KEY_ID = "test-key-id";
  return privateJwk;
}

describe("MCP OAuth", () => {
  beforeEach(async () => {
    env.SEAL_MCP_SIGNING_KEY = undefined;
    env.SEAL_MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(mcpOAuthRefreshTokens);
    await db.delete(mcpOAuthAuthorizationCodes);
    await db.delete(mcpOAuthClients);
    await db.delete(organization);
    await db.delete(user);
  });

  it("returns 503 when no signing key is configured", async () => {
    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/oauth/seal-mcp/jwks"),
      env
    );
    expect(response.status).toBe(503);
    const body = z.object({ error: z.string() }).parse(await response.json());
    expect(body.error).toBe("server_error");
  });

  it("exposes the public half of an EC signing key at the JWKS endpoint", async () => {
    const privateJwk = await configureSigningKey();

    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/oauth/seal-mcp/jwks"),
      env
    );
    expect(response.status).toBe(200);
    const body = z
      .object({
        keys: z.array(z.unknown()),
      })
      .parse(await response.json());
    expect(body.keys).toHaveLength(1);

    const publicJwk = body.keys[0];
    expect(publicJwk).toEqual({
      kty: "EC",
      crv: "P-256",
      x: privateJwk.x,
      y: privateJwk.y,
      kid: "test-key-id",
      use: "sig",
    });
  });

  it("registers a dynamic client and returns metadata", async () => {
    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/oauth/seal-mcp/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "Test MCP Client",
          redirect_uris: ["https://example.com/callback"],
          scope: "mcp documents:read",
        }),
      }),
      env
    );
    expect(response.status).toBe(201);
    const body = z
      .object({
        client_id: z.string(),
        client_name: z.string(),
        redirect_uris: z.array(z.string()),
        scope: z.string(),
        token_endpoint_auth_method: z.string(),
        grant_types: z.array(z.string()),
        response_types: z.array(z.string()),
        client_id_issued_at: z.number(),
      })
      .parse(await response.json());

    expect(body.client_name).toBe("Test MCP Client");
    expect(body.redirect_uris).toEqual(["https://example.com/callback"]);
    expect(body.scope).toBe("mcp documents:read");
  });

  it("exchanges a valid authorization code for an access token", async () => {
    await configureSigningKey();
    const db = createD1(env.D1);

    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const clientId = crypto.randomUUID();

    await db.insert(user).values({
      id: userId,
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
    });

    await db.insert(organization).values({
      id: orgId,
      name: "Test Org",
      slug: "test-org",
    });

    await db.insert(mcpOAuthClients).values({
      id: clientId,
      name: "Test Client",
      redirectUris: JSON.stringify(["https://example.com/callback"]),
      allowedScopes: "mcp documents:read",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { verifier, challenge } = await generatePkce();
    const code = crypto.randomUUID();
    await db.insert(mcpOAuthAuthorizationCodes).values({
      code,
      clientId,
      userId,
      organizationId: orgId,
      scopes: "mcp documents:read",
      redirectUri: "https://example.com/callback",
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/oauth/seal-mcp/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: "https://example.com/callback",
          client_id: clientId,
          code_verifier: verifier,
        }).toString(),
      }),
      env
    );

    expect(response.status).toBe(200);
    const body = z
      .object({
        access_token: z.string(),
        token_type: z.literal("Bearer"),
        expires_in: z.number(),
        refresh_token: z.string(),
        scope: z.string(),
      })
      .parse(await response.json());

    expect(body.scope).toBe("mcp documents:read");

    const consumedCode = await db
      .select()
      .from(mcpOAuthAuthorizationCodes)
      .where(eq(mcpOAuthAuthorizationCodes.code, code));
    expect(consumedCode[0]?.consumedAt).not.toBeNull();

    const refreshTokens = await db
      .select()
      .from(mcpOAuthRefreshTokens)
      .where(eq(mcpOAuthRefreshTokens.clientId, clientId));
    expect(refreshTokens.length).toBe(1);
    expect(refreshTokens[0]?.userId).toBe(userId);
    expect(refreshTokens[0]?.organizationId).toBe(orgId);
  });

  it("rejects an authorization code exchange with a mismatched verifier", async () => {
    await configureSigningKey();
    const db = createD1(env.D1);

    const userId = crypto.randomUUID();
    const clientId = crypto.randomUUID();

    await db.insert(user).values({
      id: userId,
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
    });

    await db.insert(mcpOAuthClients).values({
      id: clientId,
      name: "Test Client",
      redirectUris: JSON.stringify(["https://example.com/callback"]),
      allowedScopes: "mcp",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { challenge } = await generatePkce();
    const code = crypto.randomUUID();
    await db.insert(mcpOAuthAuthorizationCodes).values({
      code,
      clientId,
      userId,
      scopes: "mcp",
      redirectUri: "https://example.com/callback",
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/oauth/seal-mcp/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: "https://example.com/callback",
          client_id: clientId,
          code_verifier: "wrong-verifier",
        }).toString(),
      }),
      env
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error", "invalid_grant");
  });
});
