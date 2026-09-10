import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1 } from "../../global/db.js";
import { documents, member, organization, user } from "../../global/schema.js";
import indexApp from "../../index.js";

async function configureSigningKey() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  privateJwk.alg = "ES256";
  privateJwk.kid = "test-key-id";
  env.SEAL_MCP_SIGNING_KEY = JSON.stringify(privateJwk);
  env.SEAL_MCP_SIGNING_KEY_ID = "test-key-id";
  return privateJwk;
}

async function signAccessToken(
  privateJwk: JWK,
  payload: {
    sub: string;
    organizationId?: string;
    scope: string;
    clientId: string;
    jti: string;
  }
): Promise<string> {
  const key = await importJWK(privateJwk, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: payload.sub,
    ...(payload.organizationId
      ? { organizationId: payload.organizationId }
      : {}),
    scope: payload.scope,
    clientId: payload.clientId,
    jti: payload.jti,
  })
    .setProtectedHeader({ alg: "ES256", kid: "test-key-id", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 900)
    .setIssuer(`${env.BETTER_AUTH_URL}/oauth/seal-mcp`)
    .setAudience(env.BETTER_AUTH_URL)
    .sign(key);
}

describe("GET /api/v1/account", () => {
  beforeEach(async () => {
    env.SEAL_MCP_SIGNING_KEY = undefined;
    env.SEAL_MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(documents);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("returns account info for a valid MCP access token", async () => {
    const privateJwk = await configureSigningKey();
    const db = createD1(env.D1);

    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();

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

    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId,
      role: "admin",
    });

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      ownerId: userId,
      name: "Draft Doc",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      ownerId: userId,
      name: "Completed Doc",
      status: "completed",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp account:read",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const response = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/account", {
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      name: "Test Org",
      slug: "test-org",
      type: "company",
      status: "active",
      members: {
        total: 1,
        active: 1,
        by_role: { admin: 1, owner: 0, member: 0, viewer: 0 },
      },
      documents: {
        total: 2,
        draft: 1,
        completed: 1,
        sent: 0,
        in_progress: 0,
        cancelled: 0,
        declined: 0,
      },
      signing_settings: {
        allowed_signature_types: ["draw", "type", "upload"],
        default_deadline_days: 30,
      },
      ai_enabled: true,
    });
  });

  it("rejects a request without a bearer token", async () => {
    const response = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/account"),
      env
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error", "unauthorized");
  });
});
