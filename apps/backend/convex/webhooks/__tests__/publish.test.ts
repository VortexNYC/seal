import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { publishWebhookEvent } from "../publish";

describe("publishWebhookEvent", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Test Owner",
        authSubject: "test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  async function createEndpoint(
    overrides: {
      events?: string[];
      status?: "active" | "paused" | "disabled";
      name?: string;
      url?: string;
    } = {}
  ) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("webhook_endpoints", {
        organizationId,
        name: overrides.name ?? "Test Endpoint",
        url: overrides.url ?? "https://example.com/webhook",
        secretHash: "hash123",
        secret: "whsec_test_secret_key",
        secretPrefix: "whsec_test_s",
        events: overrides.events ?? [],
        status: overrides.status ?? "active",
        failureCount: 0,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  }

  // ---------------------------------------------------------------------------
  // No endpoints
  // ---------------------------------------------------------------------------
  test("returns 0 when no endpoints exist", async () => {
    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: { document_id: "test" },
      });
    });

    expect(count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // All-events endpoint (empty events array)
  // ---------------------------------------------------------------------------
  test("creates delivery for active endpoint subscribed to all events", async () => {
    await createEndpoint({ events: [] });

    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: { document_id: "test" },
      });
    });

    expect(count).toBe(1);

    const deliveries = await t.run(async (ctx) => {
      return await ctx.db.query("webhook_deliveries").collect();
    });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].eventType).toBe("document.sent");
    expect(deliveries[0].status).toBe("pending");
    expect(deliveries[0].attemptCount).toBe(0);
    expect(deliveries[0].organizationId).toBe(organizationId);
  });

  // ---------------------------------------------------------------------------
  // Specific matching event
  // ---------------------------------------------------------------------------
  test("creates delivery for endpoint subscribed to matching event type", async () => {
    await createEndpoint({ events: ["document.sent", "document.completed"] });

    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: { document_id: "test" },
      });
    });

    expect(count).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Non-matching event
  // ---------------------------------------------------------------------------
  test("skips endpoint not subscribed to the event type", async () => {
    await createEndpoint({ events: ["recipient.signed"] });

    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: { document_id: "test" },
      });
    });

    expect(count).toBe(0);

    const deliveries = await t.run(async (ctx) => {
      return await ctx.db.query("webhook_deliveries").collect();
    });

    expect(deliveries).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Paused / disabled endpoints
  // ---------------------------------------------------------------------------
  test("skips paused endpoints", async () => {
    await createEndpoint({ status: "paused", events: [] });

    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: { document_id: "test" },
      });
    });

    expect(count).toBe(0);
  });

  test("skips disabled endpoints", async () => {
    await createEndpoint({ status: "disabled", events: [] });

    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: { document_id: "test" },
      });
    });

    expect(count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Multiple matching endpoints
  // ---------------------------------------------------------------------------
  test("creates multiple deliveries for multiple matching endpoints", async () => {
    await createEndpoint({
      name: "Endpoint A",
      events: [],
      url: "https://a.example.com/webhook",
    });
    await createEndpoint({
      name: "Endpoint B",
      events: ["document.sent"],
      url: "https://b.example.com/webhook",
    });
    await createEndpoint({
      name: "Endpoint C",
      events: ["recipient.signed"],
      url: "https://c.example.com/webhook",
    });

    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: { document_id: "test" },
      });
    });

    // Endpoint A matches (all events), Endpoint B matches (document.sent), Endpoint C does not
    expect(count).toBe(2);

    const deliveries = await t.run(async (ctx) => {
      return await ctx.db.query("webhook_deliveries").collect();
    });

    expect(deliveries).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Payload structure
  // ---------------------------------------------------------------------------
  test("payload contains correct structure", async () => {
    await createEndpoint({ events: [] });

    await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: { document_id: "doc_123", title: "Test Document" },
      });
    });

    const deliveries = await t.run(async (ctx) => {
      return await ctx.db.query("webhook_deliveries").collect();
    });

    expect(deliveries).toHaveLength(1);

    const payload: {
      id: string;
      type: string;
      api_version: string;
      created_at: string;
      organization_id: string;
      data: Record<string, unknown>;
    } = JSON.parse(deliveries[0].payload);

    // id format: evt_{timestamp}_{random}
    expect(payload.id).toMatch(/^evt_\d+_[a-z0-9]+$/);
    expect(payload.type).toBe("document.sent");
    expect(payload.api_version).toBe("2025-01-01");
    expect(payload.created_at).toBeDefined();
    // Verify created_at is a valid ISO string
    expect(Number.isNaN(new Date(payload.created_at).getTime())).toBe(false);
    expect(payload.organization_id).toBe(organizationId);
    expect(payload.data).toEqual({
      document_id: "doc_123",
      title: "Test Document",
    });
  });

  // ---------------------------------------------------------------------------
  // Shared eventId across deliveries
  // ---------------------------------------------------------------------------
  test("all deliveries for the same publish call share the same eventId", async () => {
    await createEndpoint({
      name: "Endpoint A",
      events: [],
      url: "https://a.example.com/webhook",
    });
    await createEndpoint({
      name: "Endpoint B",
      events: [],
      url: "https://b.example.com/webhook",
    });

    await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.completed",
        data: { document_id: "doc_456" },
      });
    });

    const deliveries = await t.run(async (ctx) => {
      return await ctx.db.query("webhook_deliveries").collect();
    });

    expect(deliveries).toHaveLength(2);
    expect(deliveries[0].eventId).toBe(deliveries[1].eventId);
    expect(deliveries[0].eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
  });
});
