import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1 } from "../../global/db.js";
import {
  contacts,
  documents,
  member,
  organization,
  templates,
  user,
} from "../../global/schema.js";
import indexApp from "../../index.js";

async function configureSigningKey() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  privateJwk.alg = "ES256";
  privateJwk.kid = "test-key-id";
  env.MCP_SIGNING_KEY = JSON.stringify(privateJwk);
  env.MCP_SIGNING_KEY_ID = "test-key-id";
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

async function seedOrgAndUser() {
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

  return { userId, orgId, db };
}

async function setupToken(
  privateJwk: JWK,
  userId: string,
  orgId: string,
  scope: string
) {
  return signAccessToken(privateJwk, {
    sub: userId,
    organizationId: orgId,
    scope,
    clientId: crypto.randomUUID(),
    jti: crypto.randomUUID(),
  });
}

describe("GET /api/v1/search", () => {
  beforeEach(async () => {
    env.MCP_SIGNING_KEY = undefined;
    env.MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(templates);
    await db.delete(documents);
    await db.delete(contacts);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("finds documents, contacts, and templates by query", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:read"
    );

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      ownerId: userId,
      name: "Alpha Contract",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      description: "A contract for the alpha release",
    });

    await db.insert(contacts).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      firstName: "Beta",
      lastName: "User",
      fullName: "Beta User",
      email: "beta@example.com",
      status: "active",
      createdBy: userId,
    });

    await db.insert(templates).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      createdBy: userId,
      name: "Gamma Template",
      description: "Standard gamma agreement",
      storageKey: "test-template-key",
      size: 123,
      contentType: "application/pdf",
    });

    const response = await indexApp.fetch(
      new Request(
        "http://localhost:8787/api/v1/search?q=alpha&types=document,contact,template",
        { headers: { authorization: `Bearer ${token}` } }
      ),
      env
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{ title: string; type: string }>;
    };
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.some((hit) => hit.title.includes("Alpha"))).toBe(true);
  });

  it("filters by type", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:read"
    );

    await db.insert(contacts).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      firstName: "Search",
      lastName: "Target",
      fullName: "Search Target",
      email: "target@example.com",
      status: "active",
      createdBy: userId,
    });

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      ownerId: userId,
      name: "Search Target Document",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
    });

    const response = await indexApp.fetch(
      new Request(
        "http://localhost:8787/api/v1/search?q=target&types=contact",
        { headers: { authorization: `Bearer ${token}` } }
      ),
      env
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ type: string }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.type).toBe("contact");
  });

  it("rejects an empty query", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:read"
    );

    const response = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/search?q=", {
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(400);
  });

  it("rejects without read scope", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:write"
    );

    const response = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/search?q=hello", {
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(403);
  });

  it("does not return another user's private document", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const otherUserId = crypto.randomUUID();
    await db.insert(user).values({
      id: otherUserId,
      name: "Other User",
      email: "other@example.com",
      emailVerified: true,
    });
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: otherUserId,
      role: "member",
    });

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      ownerId: userId,
      name: "Secret Alpha Contract",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
    });

    const token = await setupToken(
      privateJwk,
      otherUserId,
      orgId,
      "mcp documents:read"
    );

    const response = await indexApp.fetch(
      new Request(
        "http://localhost:8787/api/v1/search?q=alpha&types=document",
        {
          headers: { authorization: `Bearer ${token}` },
        }
      ),
      env
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{ title: string; type: string }>;
    };
    expect(body.data).toHaveLength(0);
  });
});
