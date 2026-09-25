import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createD1 } from "../../global/db.js";
import {
  apiTokens,
  auditLogs,
  member,
  organization,
  user,
} from "../../global/schema.js";
import app from "../../index.js";
import { hashToken } from "../../platform/api-token-auth.js";
import { writeAuditLog } from "../../platform/audit-log.js";

interface AuditLogEntry {
  id: string;
  actorId: string;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogResponse {
  entries: AuditLogEntry[];
  has_more: boolean;
  next_cursor?: string;
}

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

async function seedAuditLog(
  db: ReturnType<typeof createD1>,
  {
    organizationId,
    actorId,
    actorType,
    action,
    resourceType,
    resourceId,
    metadata,
    createdAt,
  }: {
    organizationId: string;
    actorId: string;
    actorType: "user" | "agent" | "api_token";
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
  }
) {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId,
    actorId,
    actorType,
    action,
    resourceType,
    resourceId,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
    createdAt: createdAt ?? new Date(),
  });
}

async function getAuditJson(
  slug: string,
  plaintext: string,
  query?: string
): Promise<AuditLogResponse> {
  const res = await app.fetch(
    new Request(
      `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
        slug
      )}/audit${query ? `?${query}` : ""}`,
      { headers: { authorization: `Bearer ${plaintext}` } }
    ),
    env
  );
  expect(res.status).toBe(200);
  return res.json() as Promise<AuditLogResponse>;
}

describe("api v1 audit logs", () => {
  it("lists audit events with default pagination", async () => {
    const { slug, plaintext, orgId } = await seedTokenContext();
    const db = createD1(env.D1);

    await seedAuditLog(db, {
      organizationId: orgId,
      actorId: plaintext,
      actorType: "api_token",
      action: "api_token.create",
      resourceType: "api_token",
      resourceId: crypto.randomUUID(),
    });

    const body = await getAuditJson(slug, plaintext);
    expect(body.entries.length).toBeGreaterThanOrEqual(1);
    expect(body.has_more).toBe(false);
  });

  it("filters by action", async () => {
    const { slug, plaintext, orgId } = await seedTokenContext();
    const db = createD1(env.D1);

    await seedAuditLog(db, {
      organizationId: orgId,
      actorId: plaintext,
      actorType: "api_token",
      action: "document.sent",
      resourceType: "document",
      resourceId: crypto.randomUUID(),
    });
    await seedAuditLog(db, {
      organizationId: orgId,
      actorId: plaintext,
      actorType: "api_token",
      action: "api_token.create",
      resourceType: "api_token",
      resourceId: crypto.randomUUID(),
    });

    const body = await getAuditJson(
      slug,
      plaintext,
      `action=${encodeURIComponent("document.sent")}`
    );
    expect(body.entries.length).toBe(1);
    expect(body.entries[0]?.action).toBe("document.sent");
  });

  it("filters by resource type", async () => {
    const { slug, plaintext, orgId } = await seedTokenContext();
    const db = createD1(env.D1);

    await seedAuditLog(db, {
      organizationId: orgId,
      actorId: plaintext,
      actorType: "api_token",
      action: "document.create",
      resourceType: "document",
      resourceId: crypto.randomUUID(),
    });
    await seedAuditLog(db, {
      organizationId: orgId,
      actorId: plaintext,
      actorType: "api_token",
      action: "template.create",
      resourceType: "template",
      resourceId: crypto.randomUUID(),
    });

    const body = await getAuditJson(
      slug,
      plaintext,
      `resourceType=${encodeURIComponent("template")}`
    );
    expect(body.entries.length).toBe(1);
    expect(body.entries[0]?.resourceType).toBe("template");
  });

  it("filters by actor id", async () => {
    const { slug, plaintext, orgId } = await seedTokenContext();
    const db = createD1(env.D1);

    const actorA = crypto.randomUUID();
    const actorB = crypto.randomUUID();

    await seedAuditLog(db, {
      organizationId: orgId,
      actorId: actorA,
      actorType: "user",
      action: "document.view",
      resourceType: "document",
      resourceId: crypto.randomUUID(),
    });
    await seedAuditLog(db, {
      organizationId: orgId,
      actorId: actorB,
      actorType: "user",
      action: "document.view",
      resourceType: "document",
      resourceId: crypto.randomUUID(),
    });

    const body = await getAuditJson(slug, plaintext, `actor=${actorA}`);
    expect(body.entries.length).toBe(1);
    expect(body.entries[0]?.actorId).toBe(actorA);
  });

  it("filters by date range", async () => {
    const { slug, plaintext, orgId } = await seedTokenContext();
    const db = createD1(env.D1);

    const oldId = crypto.randomUUID();
    const newId = crypto.randomUUID();

    await seedAuditLog(db, {
      organizationId: orgId,
      actorId: plaintext,
      actorType: "api_token",
      action: "document.create",
      resourceType: "document",
      resourceId: oldId,
      createdAt: new Date("2026-09-10T00:00:00.000Z"),
    });
    await seedAuditLog(db, {
      organizationId: orgId,
      actorId: plaintext,
      actorType: "api_token",
      action: "document.create",
      resourceType: "document",
      resourceId: newId,
      createdAt: new Date("2026-09-15T00:00:00.000Z"),
    });

    const from = encodeURIComponent("2026-09-12T00:00:00.000Z");
    const to = encodeURIComponent("2026-09-16T00:00:00.000Z");
    const action = encodeURIComponent("document.create");
    const body = await getAuditJson(
      slug,
      plaintext,
      `from=${from}&to=${to}&action=${action}`
    );
    expect(body.entries.length).toBe(1);
    expect(body.entries[0]?.resourceId).toBe(newId);
  });

  it("paginates with limit and cursor", async () => {
    const { slug, plaintext, orgId } = await seedTokenContext();
    const db = createD1(env.D1);

    for (let i = 0; i < 3; i++) {
      await seedAuditLog(db, {
        organizationId: orgId,
        actorId: plaintext,
        actorType: "api_token",
        action: "document.create",
        resourceType: "document",
        resourceId: crypto.randomUUID(),
        createdAt: new Date(2026, 8, 15, 12, 0, i, 0),
      });
    }

    const resourceType = encodeURIComponent("document");
    const first = await getAuditJson(
      slug,
      plaintext,
      `resourceType=${resourceType}&limit=1`
    );
    expect(first.entries.length).toBe(1);
    expect(first.has_more).toBe(true);
    expect(first.next_cursor).toBeDefined();

    const second = await getAuditJson(
      slug,
      plaintext,
      `resourceType=${resourceType}&limit=1&cursor=${first.next_cursor}`
    );
    expect(second.entries.length).toBe(1);
    expect(second.has_more).toBe(true);
    expect(second.next_cursor).toBeDefined();

    const third = await getAuditJson(
      slug,
      plaintext,
      `resourceType=${resourceType}&limit=1&cursor=${second.next_cursor}`
    );
    expect(third.entries.length).toBe(1);
    expect(third.has_more).toBe(false);
  });

  it("rejects a non-admin token", async () => {
    const { slug, plaintext } = await seedTokenContext({
      tokenScopes: ["read"],
    });

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/audit`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(res.status).toBe(403);
  });

  it("rejects requests outside the organization", async () => {
    const { plaintext } = await seedTokenContext();
    const other = `other-org-${crypto.randomUUID().slice(0, 8)}`;

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          other
        )}/audit`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(res.status).toBe(404);
  });

  it("verifies the org audit hash chain", async () => {
    const { slug, plaintext, orgId, userId } = await seedTokenContext();
    const db = createD1(env.D1);

    await writeAuditLog(db, {
      organizationId: orgId,
      actor: { type: "user", id: userId },
      action: "document.created",
      resourceType: "document",
      resourceId: crypto.randomUUID(),
    });

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/audit/verify`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      checked: number;
      tipHash: string | null;
    };
    expect(body.ok).toBe(true);
    expect(body.checked).toBeGreaterThanOrEqual(1);
    expect(body.tipHash).toBeTruthy();
  });

  it("exports sealed audit entries as NDJSON for SIEM pull (SEA-67)", async () => {
    const { slug, plaintext, orgId, userId } = await seedTokenContext();
    const db = createD1(env.D1);

    await writeAuditLog(db, {
      organizationId: orgId,
      actor: { type: "user", id: userId },
      action: "settings.update",
      resourceType: "organization",
      resourceId: orgId,
      ipAddress: "198.51.100.20",
    });

    const res = await app.fetch(
      new Request(
        `http://localhost:8787/api/v1/organizations/${encodeURIComponent(
          slug
        )}/audit/export?limit=50`,
        { headers: { authorization: `Bearer ${plaintext}` } }
      ),
      env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const text = new TextDecoder().decode(await res.arrayBuffer());
    const lines = text
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const first = JSON.parse(lines[0] ?? "{}") as {
      action: string;
      ipAddress: string | null;
      sequence: number;
    };
    const last = JSON.parse(lines[lines.length - 1] ?? "{}") as {
      sequence: number;
    };
    expect(first.action).toBe("settings.update");
    expect(first.ipAddress).toBe("198.51.100.20");
    expect(first.sequence).toBeGreaterThan(0);
    expect(res.headers.get("x-seal-next-sequence")).toBe(
      String(last.sequence)
    );
  });
});
