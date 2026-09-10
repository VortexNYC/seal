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

const listResponseSchema = z.object({
  documents: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      recipients_count: z.number(),
      signed_count: z.number(),
    })
  ),
  has_more: z.boolean(),
});

const getResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  recipients_count: z.number(),
  signed_count: z.number(),
  recipients: z
    .array(
      z.object({
        email: z.string(),
        status: z.string(),
        viewed_at: z.string().optional(),
      })
    )
    .optional(),
});

describe("GET /api/v1/documents", () => {
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

  it("lists documents for the token's organization", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      ownerId: userId,
      name: "Test Document",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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
      new Request("http://localhost:8787/api/v1/documents", {
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(200);
    const body = listResponseSchema.parse(await response.json());
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0]).toMatchObject({
      id: docId,
      title: "Test Document",
      status: "draft",
      recipients_count: 1,
      signed_count: 0,
    });
    expect(body.has_more).toBe(false);
  });

  it("gets a single document with recipients", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId: crypto.randomUUID(),
      organizationId: orgId,
      ownerId: userId,
      name: "Single Doc",
      description: "A description",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    await db.insert(recipients).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      documentId: docId,
      email: "viewer@example.com",
      name: "Viewer",
      role: "viewer",
      order: 0,
      status: "viewed",
      viewedAt: new Date("2026-01-03T00:00:00.000Z"),
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
        `http://localhost:8787/api/v1/documents/get?id=${docId}&include_recipients=true`,
        {
          headers: { authorization: `Bearer ${token}` },
        }
      ),
      env
    );

    expect(response.status).toBe(200);
    const body = getResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      id: docId,
      title: "Single Doc",
      description: "A description",
      status: "sent",
      recipients_count: 1,
      signed_count: 0,
    });
    expect(body.recipients).toHaveLength(1);
    expect(body.recipients?.[0]).toMatchObject({
      email: "viewer@example.com",
      status: "viewed",
      viewed_at: "2026-01-03T00:00:00.000Z",
    });
  });

  it("rejects a request without documents:read scope", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp account:read",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const response = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/documents", {
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(403);
    const body = z.object({ error: z.string() }).parse(await response.json());
    expect(body.error).toBe("insufficient_scope");
  });

  it("creates, updates, sends, and voids a document", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();

    const storageId = "uploads/test-pdf";
    await env.DOCUMENTS_BUCKET.put(
      storageId,
      new TextEncoder().encode("%PDF-1.4 test"),
      {
        httpMetadata: { contentType: "application/pdf" },
      }
    );

    const writeToken = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp documents:write",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const readToken = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp documents:read",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const createResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/documents", {
        method: "POST",
        headers: {
          authorization: `Bearer ${writeToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "New Doc",
          storage_id: storageId,
          file_type: "application/pdf",
        }),
      }),
      env
    );

    expect(createResponse.status).toBe(200);
    const createdDoc = getResponseSchema.parse(await createResponse.json());
    expect(createdDoc.title).toBe("New Doc");

    const updateResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/documents/update", {
        method: "POST",
        headers: {
          authorization: `Bearer ${writeToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: createdDoc.id,
          description: "Updated description",
        }),
      }),
      env
    );

    expect(updateResponse.status).toBe(200);
    const updatedDoc = getResponseSchema.parse(await updateResponse.json());
    expect(updatedDoc.description).toBe("Updated description");

    const addRecipientResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/recipients", {
        method: "POST",
        headers: {
          authorization: `Bearer ${writeToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: createdDoc.id,
          email: "signer@example.com",
          name: "Signer",
          role: "signer",
        }),
      }),
      env
    );
    expect(addRecipientResponse.status).toBe(200);

    const sendResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/documents/send", {
        method: "POST",
        headers: {
          authorization: `Bearer ${writeToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: createdDoc.id }),
      }),
      env
    );
    expect(sendResponse.status).toBe(200);
    const sendBody = z.object({ success: z.boolean() }).parse(await sendResponse.json());
    expect(sendBody.success).toBe(true);

    const sentDoc = await indexApp.fetch(
      new Request(
        `http://localhost:8787/api/v1/documents/get?id=${createdDoc.id}`,
        { headers: { authorization: `Bearer ${readToken}` } }
      ),
      env
    );
    expect(sentDoc.status).toBe(200);
    const sentDocBody = getResponseSchema.parse(await sentDoc.json());
    expect(sentDocBody.status).toBe("sent");

    const voidResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/documents/void", {
        method: "POST",
        headers: {
          authorization: `Bearer ${writeToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: createdDoc.id, reason: "No longer needed" }),
      }),
      env
    );
    expect(voidResponse.status).toBe(200);
    const voidBody = z.object({ success: z.boolean() }).parse(await voidResponse.json());
    expect(voidBody.success).toBe(true);
  });
});
