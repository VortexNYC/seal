import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { contacts, member, organization, user } from "../../global/schema.js";
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

const listResponseSchema = z.object({
  contacts: z.array(
    z.object({
      id: z.string(),
      first_name: z.string(),
      last_name: z.string(),
      full_name: z.string(),
      email: z.string(),
      status: z.string(),
    })
  ),
  has_more: z.boolean(),
});

const getResponseSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  full_name: z.string(),
  email: z.string(),
  status: z.string(),
});

describe("GET /api/v1/contacts", () => {
  beforeEach(async () => {
    env.SEAL_MCP_SIGNING_KEY = undefined;
    env.SEAL_MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(contacts);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("lists contacts for the token's organization", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const contactId = crypto.randomUUID();
    await db.insert(contacts).values({
      id: contactId,
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Doe",
      email: "jane@example.com",
      status: "active",
      createdBy: userId,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp contacts:read",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const response = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/contacts", {
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(200);
    const body = listResponseSchema.parse(await response.json());
    expect(body.contacts).toHaveLength(1);
    expect(body.contacts[0]).toMatchObject({
      id: contactId,
      first_name: "Jane",
      last_name: "Doe",
      full_name: "Jane Doe",
      email: "jane@example.com",
      status: "active",
    });
    expect(body.has_more).toBe(false);
  });

  it("gets a single contact", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const contactId = crypto.randomUUID();
    await db.insert(contacts).values({
      id: contactId,
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      firstName: "John",
      lastName: "Smith",
      fullName: "John Smith",
      email: "john@example.com",
      status: "lead",
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp contacts:read",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const response = await indexApp.fetch(
      new Request(`http://localhost:8787/api/v1/contacts/get?id=${contactId}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(200);
    const body = getResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      id: contactId,
      first_name: "John",
      last_name: "Smith",
      full_name: "John Smith",
      email: "john@example.com",
      status: "lead",
    });
  });
});
