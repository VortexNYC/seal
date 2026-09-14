import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createD1 } from "../../global/db.js";
import { apiTokens, member, organization, user } from "../../global/schema.js";
import app from "../../index.js";
import { hashToken } from "../../platform/api-token-auth.js";

async function seedTokenContext({
  role = "admin",
  tokenScopes = ["admin"],
}: {
  role?: string;
  tokenScopes?: string[];
} = {}) {
  const db = createD1(env.D1);
  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const slug = `test-org-${crypto.randomUUID().slice(0, 8)}`;

  await db.insert(organization).values({
    id: orgId,
    name: "Test Org",
    slug,
  });
  await db.insert(user).values({
    id: userId,
    name: "Test User",
    email: `test-${crypto.randomUUID().slice(0, 8)}@example.com`,
  });
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role,
  });

  const publicId = `tk_${crypto.randomUUID().slice(0, 8)}`;
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `seal_${publicId}_${secret}`;
  const tokenHash = await hashToken(plaintext);

  const tokenId = crypto.randomUUID();
  await db.insert(apiTokens).values({
    id: tokenId,
    publicId,
    organizationId: orgId,
    userId,
    name: "Test token",
    tokenHash,
    scopes: JSON.stringify(tokenScopes),
  });

  return { orgId, userId, slug, plaintext, tokenId };
}

describe("api v1 tokens", () => {
  it("creates, lists, and revokes tokens using an admin API token", async () => {
    const { slug, plaintext } = await seedTokenContext();

    const createRes = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/tokens`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${plaintext}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: "Production",
            scopes: ["read", "write"],
          }),
        }
      ),
      env
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; token: string };
    expect(typeof created.token).toBe("string");
    expect(created.token.startsWith("seal_")).toBe(true);

    const listRes = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/tokens`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as Array<{
      id: string;
      token?: string;
    }>;
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((item) => item.token === undefined)).toBe(true);

    const revokeRes = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/tokens/${created.id}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${plaintext}` },
        }
      ),
      env
    );
    expect(revokeRes.status).toBe(200);
  });

  it("rejects a non-admin token from creating tokens", async () => {
    const { slug, plaintext } = await seedTokenContext({
      role: "member",
      tokenScopes: ["read"],
    });

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/tokens`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${plaintext}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: "Try", scopes: ["read"] }),
        }
      ),
      env
    );
    expect(res.status).toBe(403);
  });

  it("uses a read-scoped API token to call /api/v1/documents", async () => {
    const { plaintext } = await seedTokenContext({ tokenScopes: ["read"] });

    const res = await app.fetch(
      new Request("http://localhost:8787/api/v1/documents?limit=10", {
        headers: { authorization: `Bearer ${plaintext}` },
      }),
      env
    );
    expect(res.status).toBe(200);
  });

  it("rejects a write-scoped API token from /api/v1/documents GET", async () => {
    const { plaintext } = await seedTokenContext({ tokenScopes: ["write"] });

    const res = await app.fetch(
      new Request("http://localhost:8787/api/v1/documents?limit=10", {
        headers: { authorization: `Bearer ${plaintext}` },
      }),
      env
    );
    expect(res.status).toBe(403);
  });

  it("rejects a revoked or unknown token", async () => {
    const { slug, plaintext } = await seedTokenContext();
    const db = createD1(env.D1);
    const token = await db
      .select({ id: apiTokens.id })
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, await hashToken(plaintext)))
      .limit(1);
    if (!token[0]) throw new Error("seeded token not found");
    await db
      .update(apiTokens)
      .set({ revokedAt: new Date() })
      .where(eq(apiTokens.id, token[0].id));

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/tokens`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(res.status).toBe(401);
  });
});
