/**
 * MCP Server — Live Integration Tests
 *
 * These tests make real HTTP calls to the staging Convex API endpoint.
 * They require SEAL_API_KEY and SEAL_BASE_URL to be set in the environment
 * (or they read from .env.test).
 *
 * Run: bun test src/client.integration.test.ts
 *
 * The tests are intentionally read-only (no mutations) so they are safe to
 * run repeatedly against staging data.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { SealApiClient, SealApiError } from "./client";

// ---------------------------------------------------------------------------
// Configuration — reads from env so CI can inject credentials
// ---------------------------------------------------------------------------

const API_KEY = process.env.SEAL_API_KEY;
const BASE_URL = process.env.SEAL_BASE_URL;

const SKIP_INTEGRATION = !API_KEY || !BASE_URL || API_KEY === "skip";
const EFFECTIVE_API_KEY = API_KEY ?? "skip";
const EFFECTIVE_BASE_URL = BASE_URL ?? "https://example.invalid";

const describeIf = SKIP_INTEGRATION ? describe.skip : describe;

// ---------------------------------------------------------------------------
// Client under test
// ---------------------------------------------------------------------------

let client: SealApiClient;

beforeAll(() => {
  client = new SealApiClient({
    baseUrl: EFFECTIVE_BASE_URL,
    apiKey: EFFECTIVE_API_KEY,
    requestTimeout: 15_000,
    debug: false,
    maxFileSize: 50 * 1024 * 1024,
  });
});

afterAll(() => {
  // nothing to tear down — all requests are read-only
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

describeIf("GET /health", () => {
  test("returns 200 with status ok", async () => {
    const res = await client.get<{ status: string }>("/api/v1/health");
    expect(res).toMatchObject({ status: "ok" });
  });
});

// ---------------------------------------------------------------------------
// Account
// Response shape: { name, slug, status, type, ai_enabled, documents, members,
//                   signing_settings, timezone }
// ---------------------------------------------------------------------------

describeIf("GET /account", () => {
  test("returns organization info", async () => {
    const res = await client.get<{
      name: string;
      slug: string;
      status: string;
      members: { total: number };
    }>("/api/v1/account");
    expect(res).toHaveProperty("name");
    expect(res).toHaveProperty("slug");
    expect(res).toHaveProperty("status");
    expect(typeof res.members.total).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Documents
// Response shape: { data: [...], has_more, next_cursor? }
// ---------------------------------------------------------------------------

describeIf("GET /documents", () => {
  test("returns paginated document list", async () => {
    const res = await client.get<{
      data: Array<{ id: string; title: string; status: string }>;
      has_more: boolean;
    }>("/api/v1/documents");
    expect(Array.isArray(res.data)).toBe(true);
    expect(typeof res.has_more).toBe("boolean");
  });

  test("status filter narrows results", async () => {
    const all = await client.get<{ data: Array<{ status: string }> }>("/api/v1/documents");
    const sent = await client.get<{ data: Array<{ status: string }> }>("/api/v1/documents", {
      status: "sent",
    });

    // Every document in filtered list must have status=sent
    for (const doc of sent.data) {
      expect(doc.status).toBe("sent");
    }
    // Filtered set is a subset of all
    expect(sent.data.length).toBeLessThanOrEqual(all.data.length);
  });

  test("limit param is respected", async () => {
    const res = await client.get<{ data: unknown[] }>("/api/v1/documents", {
      limit: 2,
    });
    expect(res.data.length).toBeLessThanOrEqual(2);
  });
});

describeIf("GET /documents/get", () => {
  test("404 for non-existent document", async () => {
    await expect(client.get("/api/v1/documents/get", { id: "nonexistent-id" })).rejects.toThrow(
      SealApiError,
    );
  });

  test("returns document detail when id is valid", async () => {
    // Get any document id from the list first
    const list = await client.get<{ data: Array<{ id: string }> }>("/api/v1/documents", {
      limit: 1,
    });
    if (list.data.length === 0) return; // skip if no documents

    const id = list.data[0]!.id;
    const doc = await client.get<{ id: string; title: string; status: string }>(
      "/api/v1/documents/get",
      { id },
    );
    expect(doc.id).toBe(id);
    expect(doc).toHaveProperty("title");
    expect(doc).toHaveProperty("status");
  });
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

describeIf("GET /templates", () => {
  test("returns template list", async () => {
    const res = await client.get<{ data: unknown[] }>("/api/v1/templates");
    expect(Array.isArray(res.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Members
// Response shape: { data: [...] }  (no has_more/cursor — returns all members)
// ---------------------------------------------------------------------------

describeIf("GET /members", () => {
  test("returns member list with required fields", async () => {
    const res = await client.get<{
      data: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
        joined_at: string;
      }>;
    }>("/api/v1/members");
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    const member = res.data[0]!;
    expect(member).toHaveProperty("id");
    expect(member).toHaveProperty("email");
    expect(["owner", "admin", "member", "viewer"]).toContain(member.role);
  });

  test("GET /members/get returns individual member", async () => {
    const list = await client.get<{ data: Array<{ id: string }> }>("/api/v1/members");
    const id = list.data[0]?.id;
    if (!id) return;

    const member = await client.get<{ id: string; email: string }>("/api/v1/members/get", {
      id,
    });
    expect(member.id).toBe(id);
  });

  test("GET /members/get 404 for invalid id", async () => {
    await expect(client.get("/api/v1/members/get", { id: "bad-id" })).rejects.toThrow(SealApiError);
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describeIf("GET /settings", () => {
  test("returns full settings object", async () => {
    const res = await client.get<{
      signing: { default_deadline_days: number };
      security: { ip_allowlist: unknown[] };
      ai: { enabled: boolean };
    }>("/api/v1/settings");
    expect(res).toHaveProperty("signing");
    expect(res).toHaveProperty("security");
    expect(res).toHaveProperty("ai");
    expect(typeof res.signing.default_deadline_days).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

describeIf("GET /audit-log", () => {
  test("returns paginated audit entries", async () => {
    const res = await client.get<{
      entries: Array<{
        id: string;
        action: string;
        actor_type: string;
        created_at: string;
      }>;
      has_more: boolean;
    }>("/api/v1/audit-log");
    expect(Array.isArray(res.entries)).toBe(true);
    expect(typeof res.has_more).toBe("boolean");
    if (res.entries.length > 0) {
      const e = res.entries[0];
      expect(e).toHaveProperty("id");
      expect(e).toHaveProperty("action");
      expect(e).toHaveProperty("created_at");
    }
  });

  test("limit=1 returns at most 1 entry", async () => {
    const res = await client.get<{ entries: unknown[] }>("/api/v1/audit-log", {
      limit: 1,
    });
    expect(res.entries.length).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

describeIf("GET /analytics", () => {
  test("returns document stats and workspace snapshot", async () => {
    const res = await client.get<{
      documents: { total_created: number; completion_rate: number };
      period: { from: string; to: string };
      workspace_snapshot: Record<string, number>;
    }>("/api/v1/analytics");
    expect(res).toHaveProperty("documents");
    expect(res).toHaveProperty("period");
    expect(res).toHaveProperty("workspace_snapshot");
    expect(typeof res.documents.total_created).toBe("number");
    expect(typeof res.documents.completion_rate).toBe("number");
  });

  test("from param changes period start", async () => {
    const res = await client.get<{ period: { from: string } }>("/api/v1/analytics", {
      from: "2026-01-01",
    });
    // API returns ISO timestamp like "2026-01-01T00:00:00.000Z"
    expect(res.period.from).toMatch(/^2026-01-01/);
  });
});

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

describeIf("GET /contacts", () => {
  test("returns contact list with pagination", async () => {
    const res = await client.get<{
      contacts: Array<{ id: string; email: string }>;
      has_more: boolean;
    }>("/api/v1/contacts");
    expect(Array.isArray(res.contacts)).toBe(true);
    expect(typeof res.has_more).toBe("boolean");
  });

  test("GET /contacts/get 404 for invalid id", async () => {
    await expect(client.get("/api/v1/contacts/get", { id: "bad-id" })).rejects.toThrow(
      SealApiError,
    );
  });
});

// ---------------------------------------------------------------------------
// Webhooks
// Note: /webhook-event-types endpoint does not exist on this API version.
// ---------------------------------------------------------------------------

describeIf("GET /webhooks", () => {
  test("returns webhook list", async () => {
    const res = await client.get<{ data: unknown[] }>("/api/v1/webhooks");
    expect(Array.isArray(res.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Recipients & Signatures (require a document)
// ---------------------------------------------------------------------------

describeIf("GET /recipients", () => {
  test("returns recipients for a valid document", async () => {
    const list = await client.get<{ data: Array<{ id: string }> }>("/api/v1/documents", {
      limit: 1,
    });
    if (list.data.length === 0) return;

    const documentId = list.data[0]!.id;
    const res = await client.get<{ data: unknown[] }>("/api/v1/recipients", {
      document_id: documentId,
    });
    expect(Array.isArray(res.data)).toBe(true);
  });
});

describeIf("GET /signatures", () => {
  test("returns signatures for a valid document", async () => {
    const list = await client.get<{ data: Array<{ id: string; status: string }> }>(
      "/api/v1/documents",
      { status: "completed", limit: 1 },
    );
    if (list.data.length === 0) return; // no completed docs in test data

    const documentId = list.data[0]!.id;
    const res = await client.get<{ data: unknown[] }>("/api/v1/signatures", {
      document_id: documentId,
    });
    expect(Array.isArray(res.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Authentication error handling
// ---------------------------------------------------------------------------

describeIf("auth error handling", () => {
  test("no API key returns 401", async () => {
    const unauthClient = new SealApiClient({
      baseUrl: EFFECTIVE_BASE_URL,
      apiKey: "",
      requestTimeout: 10_000,
      debug: false,
      maxFileSize: 50 * 1024 * 1024,
    });
    await expect(unauthClient.get("/api/v1/documents")).rejects.toThrow(SealApiError);
  });

  test("invalid API key returns 401", async () => {
    const badClient = new SealApiClient({
      baseUrl: EFFECTIVE_BASE_URL,
      apiKey: "ak_totally_invalid_key",
      requestTimeout: 10_000,
      debug: false,
      maxFileSize: 50 * 1024 * 1024,
    });
    await expect(badClient.get("/api/v1/documents")).rejects.toThrow(SealApiError);
  });
});
