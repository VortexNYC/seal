import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  documents,
  member,
  organization,
  recipients,
  user,
} from "../../global/schema.js";
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

async function seedDocument(
  db: ReturnType<typeof createD1>,
  { userId, orgId }: { userId: string; orgId: string }
) {
  const docId = crypto.randomUUID();
  await db.insert(documents).values({
    id: docId,
    publicId: crypto.randomUUID(),
    organizationId: orgId,
    ownerId: userId,
    name: "Doc",
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return docId;
}

const listResponseSchema = z.object({
  recipients: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      status: z.string(),
      role: z.string(),
    })
  ),
});

const getResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  status: z.string(),
  role: z.string(),
});

describe("GET /api/v1/recipients", () => {
  beforeEach(async () => {
    env.SEAL_MCP_SIGNING_KEY = undefined;
    env.SEAL_MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(recipients);
    await db.delete(documents);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("lists recipients for a document", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      ownerId: userId,
      name: "Doc",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(recipients).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      documentId: docId,
      email: "signer@example.com",
      name: "Signer",
      role: "signer",
      order: 1,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp documents:read",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const response = await indexApp.fetch(
      new Request(
        `http://localhost:8787/api/v1/recipients?document_id=${docId}`,
        {
          headers: { authorization: `Bearer ${token}` },
        }
      ),
      env
    );

    expect(response.status).toBe(200);
    const body = listResponseSchema.parse(await response.json());
    expect(body.recipients).toHaveLength(1);
    expect(body.recipients[0]).toMatchObject({
      email: "signer@example.com",
      status: "pending",
      role: "signer",
    });
  });

  it("gets a single recipient", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      ownerId: userId,
      name: "Doc",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const recipientId = crypto.randomUUID();
    await db.insert(recipients).values({
      id: recipientId,
      publicId: crypto.randomUUID(),
      documentId: docId,
      email: "viewer@example.com",
      name: "Viewer",
      role: "viewer",
      order: 0,
      status: "viewed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp documents:read",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const response = await indexApp.fetch(
      new Request(
        `http://localhost:8787/api/v1/recipients/get?document_id=${docId}&id=${recipientId}`,
        {
          headers: { authorization: `Bearer ${token}` },
        }
      ),
      env
    );

    expect(response.status).toBe(200);
    const body = getResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      id: recipientId,
      email: "viewer@example.com",
      status: "viewed",
      role: "viewer",
    });
  });

  it("creates, updates, deletes, and reminds a recipient", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();
    const docId = await seedDocument(db, { userId, orgId });

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp documents:write",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const createResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/recipients", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: docId,
          email: "signer@example.com",
          name: "Signer",
          role: "signer",
        }),
      }),
      env
    );
    expect(createResponse.status).toBe(200);
    const created = getResponseSchema.parse(await createResponse.json());
    expect(created.email).toBe("signer@example.com");

    const updateResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/recipients/update", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: docId,
          id: created.id,
          name: "Signer Updated",
        }),
      }),
      env
    );
    expect(updateResponse.status).toBe(200);
    const updated = getResponseSchema.parse(await updateResponse.json());
    expect(updated.name).toBe("Signer Updated");

    const remindResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/recipients/remind", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: docId,
          id: created.id,
        }),
      }),
      env
    );
    expect(remindResponse.status).toBe(200);
    const remindBody = z
      .object({ success: z.boolean() })
      .parse(await remindResponse.json());
    expect(remindBody.success).toBe(true);

    const deleteResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/recipients/delete", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: docId,
          id: created.id,
        }),
      }),
      env
    );
    expect(deleteResponse.status).toBe(200);
    const deleteBody = z
      .object({ success: z.boolean() })
      .parse(await deleteResponse.json());
    expect(deleteBody.success).toBe(true);
  });
});
