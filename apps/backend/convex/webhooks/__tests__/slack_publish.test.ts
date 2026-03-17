import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { publishWebhookEvent } from "../publish";

describe("publishWebhookEvent — Slack format endpoints", () => {
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
        clerkId: "clerk_test_owner",
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
      format?: "json" | "slack";
      name?: string;
      url?: string;
    } = {},
  ) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("webhook_endpoints", {
        organizationId,
        name: overrides.name ?? "Slack Channel",
        url: overrides.url ?? "https://hooks.slack.com/services/T123/B456/abc",
        secretHash: "hash123",
        secret: "whsec_slack_placeholder",
        secretPrefix: "whsec_slack_",
        events: overrides.events ?? [],
        status: overrides.status ?? "active",
        format: overrides.format ?? "slack",
        failureCount: 0,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Slack endpoints receive deliveries
  // ---------------------------------------------------------------------------
  test("creates delivery for active Slack endpoint subscribed to all events", async () => {
    await createEndpoint({ events: [] });

    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.completed",
        data: { document_title: "NDA" },
      });
    });

    expect(count).toBe(1);

    const deliveries = await t.run(async (ctx) => {
      return await ctx.db.query("webhook_deliveries").collect();
    });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.eventType).toBe("document.completed");
    expect(deliveries[0]!.status).toBe("pending");
  });

  // ---------------------------------------------------------------------------
  // Slack endpoint with specific events
  // ---------------------------------------------------------------------------
  test("Slack endpoint with specific events only receives matching events", async () => {
    await createEndpoint({ events: ["document.completed", "document.voided"] });

    const sentCount = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: {},
      });
    });
    expect(sentCount).toBe(0);

    const completedCount = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.completed",
        data: {},
      });
    });
    expect(completedCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Mixed JSON and Slack endpoints
  // ---------------------------------------------------------------------------
  test("publishes to both JSON and Slack endpoints simultaneously", async () => {
    await createEndpoint({
      name: "Slack Alerts",
      format: "slack",
      events: [],
      url: "https://hooks.slack.com/services/T1/B1/x",
    });
    await t.run(async (ctx) => {
      return await ctx.db.insert("webhook_endpoints", {
        organizationId,
        name: "JSON Webhook",
        url: "https://api.example.com/webhook",
        secretHash: "hash123",
        secret: "whsec_test_secret",
        secretPrefix: "whsec_test_s",
        events: [],
        status: "active",
        failureCount: 0,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "recipient.signed",
        data: { recipient_name: "Alice" },
      });
    });

    expect(count).toBe(2);

    const deliveries = await t.run(async (ctx) => {
      return await ctx.db.query("webhook_deliveries").collect();
    });

    expect(deliveries).toHaveLength(2);
    // Both deliveries share the same eventId
    expect(deliveries[0]!.eventId).toBe(deliveries[1]!.eventId);
  });

  // ---------------------------------------------------------------------------
  // Paused Slack endpoint
  // ---------------------------------------------------------------------------
  test("skips paused Slack endpoints", async () => {
    await createEndpoint({ status: "paused", events: [] });

    const count = await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: {},
      });
    });

    expect(count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Payload structure is the same for Slack endpoints
  // ---------------------------------------------------------------------------
  test("Slack endpoint delivery payload has standard structure", async () => {
    await createEndpoint({ events: [] });

    await t.run(async (ctx) => {
      return await publishWebhookEvent(ctx, {
        organizationId,
        eventType: "document.sent",
        data: { document_title: "Contract" },
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
    } = JSON.parse(deliveries[0]!.payload);

    expect(payload.id).toMatch(/^evt_\d+_[a-z0-9]+$/);
    expect(payload.type).toBe("document.sent");
    expect(payload.api_version).toBe("2025-01-01");
    expect(payload.data).toEqual({ document_title: "Contract" });
  });
});
