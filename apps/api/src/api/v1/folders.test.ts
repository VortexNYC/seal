import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { folders, member, organization, user } from "../../global/schema.js";
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

const folderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["document", "template"]),
  parent_id: z.string().nullable(),
  visibility: z.string(),
  pinned: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

describe("GET/POST /api/v1/folders", () => {
  beforeEach(async () => {
    env.MCP_SIGNING_KEY = undefined;
    env.MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(folders);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("creates and lists root folders", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp documents:read documents:write",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const createResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/folders", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Contracts" }),
      }),
      env
    );

    expect(createResponse.status).toBe(201);
    const created = folderSchema.parse(await createResponse.json());
    expect(created.name).toBe("Contracts");
    expect(created.parent_id).toBeNull();

    const listResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/folders", {
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(listResponse.status).toBe(200);
    const listed = z
      .object({ folders: z.array(folderSchema) })
      .parse(await listResponse.json());
    expect(listed.folders).toHaveLength(1);
    expect(listed.folders[0]?.id).toBe(created.id);
  });

  it("returns breadcrumbs for a nested folder", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp documents:read documents:write",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const rootResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/folders", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Root" }),
      }),
      env
    );
    const root = folderSchema.parse(await rootResponse.json());

    const childResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/folders", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Child", parent_id: root.id }),
      }),
      env
    );
    const child = folderSchema.parse(await childResponse.json());

    const breadcrumbsResponse = await indexApp.fetch(
      new Request(
        `http://localhost:8787/api/v1/folders/breadcrumbs?id=${child.id}`,
        { headers: { authorization: `Bearer ${token}` } }
      ),
      env
    );

    expect(breadcrumbsResponse.status).toBe(200);
    const body = z
      .object({
        breadcrumbs: z.array(z.object({ id: z.string(), name: z.string() })),
      })
      .parse(await breadcrumbsResponse.json());
    expect(body.breadcrumbs.map((b) => b.name)).toEqual(["Root", "Child"]);
  });
});
