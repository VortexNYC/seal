import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createD1 } from "../../global/db.js";
import {
  apiTokens,
  documents,
  documentInvoices,
  member,
  organization,
  subscriptions,
  user,
} from "../../global/schema.js";
import app from "../../index.js";
import { hashToken } from "../../platform/api-token-auth.js";

async function seedBillingContext({
  tokenScopes = ["admin"],
}: {
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
    metadata: JSON.stringify({ plan: "pro" }),
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
    role: "admin",
  });

  const publicId = `tk_${crypto.randomUUID().slice(0, 8)}`;
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `seal_${publicId}_${secret}`;
  const tokenHash = await hashToken(plaintext);

  await db.insert(apiTokens).values({
    id: crypto.randomUUID(),
    publicId,
    organizationId: orgId,
    userId,
    name: "Test token",
    tokenHash,
    scopes: JSON.stringify(tokenScopes),
  });

  return { db, orgId, userId, slug, plaintext };
}

describe("api v1 billing", () => {
  it("returns usage for a read-scoped API token", async () => {
    const { db, slug, userId, orgId, plaintext } = await seedBillingContext({
      tokenScopes: ["read"],
    });
    if (!orgId) throw new Error("org not found");

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: `doc_${crypto.randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      ownerId: userId,
      name: "Doc 1",
      status: "completed",
      documentStatus: "active",
      size: 1024,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/usage`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totalDocuments: number;
      plan: string;
      storageUsedBytes: number;
    };
    expect(body.totalDocuments).toBe(1);
    expect(body.plan).toBe("pro");
    expect(body.storageUsedBytes).toBe(1024);
  });

  it("rejects a write-scoped API token from usage read", async () => {
    const { slug, plaintext } = await seedBillingContext({
      tokenScopes: ["write"],
    });

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/usage`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(res.status).toBe(403);
  });

  it("returns billing summary and invoices for an admin token", async () => {
    const { db, slug, userId, orgId, plaintext } = await seedBillingContext();
    if (!orgId) throw new Error("org not found");

    const documentId = crypto.randomUUID();
    await db.insert(documents).values({
      id: documentId,
      publicId: `doc_${crypto.randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      ownerId: userId,
      name: "Doc 2",
      status: "completed",
      documentStatus: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      publicId: `sub_${crypto.randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      externalCustomerId: "cus_1",
      externalSubscriptionId: "sub_1",
      status: "active",
      currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
      currentPeriodEnd: new Date("2026-01-31T23:59:59Z"),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(documentInvoices).values({
      id: crypto.randomUUID(),
      documentId,
      organizationId: orgId,
      providerInvoiceId: "inv_1",
      status: "paid",
      customerEmail: "test@example.com",
      amountDue: 1000,
      currency: "usd",
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/billing`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      plan: string;
      subscription: { status: string } | null;
      invoices: Array<{ status: string; amountDue: number }>;
    };
    expect(body.plan).toBe("pro");
    expect(body.subscription?.status).toBe("active");
    expect(body.invoices).toHaveLength(1);
    expect(body.invoices[0]?.status).toBe("paid");
    expect(body.invoices[0]?.amountDue).toBe(1000);
  });

  it("rejects a different organization slug for billing", async () => {
    const { plaintext } = await seedBillingContext();

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/other-org/billing`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(res.status).toBe(403);
  });
});
