import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/webhooks", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  async function seedEndpoint(overrides: {
    name?: string;
    url?: string;
    events?: string[];
    status?: "active" | "paused" | "disabled";
    description?: string;
    organizationId?: Id<"organizations">;
  }) {
    const orgId = overrides.organizationId ?? organizationId;
    const now = BASE_TIME;

    return t.run(async (ctx) => {
      return await ctx.db.insert("webhook_endpoints", {
        organizationId: orgId,
        name: overrides.name ?? "Test Endpoint",
        url: overrides.url ?? "https://example.com/webhook",
        secretHash: "abc123hash",
        secret: "whsec_testsecret1234567890abcdef",
        secretPrefix: "whsec_testse",
        events: overrides.events ?? ["document.created"],
        status: overrides.status ?? "active",
        description: overrides.description,
        failureCount: 0,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  async function seedDelivery(overrides: {
    endpointId: Id<"webhook_endpoints">;
    status?: "pending" | "delivered" | "failed" | "abandoned";
    eventType?: string;
    createdAt?: number;
  }) {
    return t.run(async (ctx) => {
      return await ctx.db.insert("webhook_deliveries", {
        endpointId: overrides.endpointId,
        organizationId,
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        eventType: overrides.eventType ?? "document.created",
        payload: JSON.stringify({ test: true }),
        status: overrides.status ?? "delivered",
        attemptCount: 1,
        createdAt: overrides.createdAt ?? BASE_TIME,
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Webhooks API Org",
        slug: "webhooks-api-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-webhooks",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@webhooks-api.com",
        name: "Owner",
        authSubject: "webhooks_api_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // listEndpoints
  // =========================================================================

  describe("listEndpoints", () => {
    test("returns empty list when no endpoints exist", async () => {
      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      expect(result).toHaveLength(0);
    });

    test("returns endpoints for the org", async () => {
      await seedEndpoint({ name: "Endpoint A" });
      await seedEndpoint({ name: "Endpoint B" });
      await seedEndpoint({ name: "Other Org Endpoint", organizationId: otherOrgId });

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      expect(result).toHaveLength(2);
    });

    test("returns full endpoint fields", async () => {
      await seedEndpoint({
        name: "Production Webhook",
        url: "https://api.example.com/hooks",
        events: ["document.created", "document.completed"],
        status: "active",
        description: "Main production endpoint",
      });

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      const endpoint = result[0];
      expect(endpoint?.name).toBe("Production Webhook");
      expect(endpoint?.url).toBe("https://api.example.com/hooks");
      expect(endpoint?.status).toBe("active");
      expect(endpoint?.events).toEqual(["document.created", "document.completed"]);
      expect(endpoint?.description).toBe("Main production endpoint");
      expect(endpoint?.secret_prefix).toBeDefined();
      expect(endpoint?.created_at).toBeDefined();
      expect(endpoint?.updated_at).toBeDefined();
      expect(endpoint?.stats).toBeDefined();
    });

    test("includes delivery stats", async () => {
      const endpointId = await seedEndpoint({ name: "Stats Endpoint" });

      await seedDelivery({ endpointId, status: "delivered" });
      await seedDelivery({ endpointId, status: "delivered" });
      await seedDelivery({ endpointId, status: "failed" });
      await seedDelivery({ endpointId, status: "abandoned" });

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      const stats = result[0]?.stats;
      expect(stats?.total_deliveries).toBe(4);
      expect(stats?.successful).toBe(2);
      expect(stats?.failed).toBe(2);
      expect(stats?.success_rate).toBe(50);
    });

    test("stats show 100% success rate when no deliveries", async () => {
      await seedEndpoint({ name: "Fresh Endpoint" });

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      expect(result[0]?.stats.success_rate).toBe(100);
    });
  });

  // =========================================================================
  // getEndpoint
  // =========================================================================

  describe("getEndpoint", () => {
    test("returns endpoint by ID", async () => {
      const endpointId = await seedEndpoint({
        name: "Single Endpoint",
        url: "https://single.example.com/hook",
      });

      const result = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(endpointId);
      expect(result?.name).toBe("Single Endpoint");
      expect(result?.url).toBe("https://single.example.com/hook");
    });

    test("returns null for endpoint in different org", async () => {
      const endpointId = await seedEndpoint({
        name: "Other Org Endpoint",
        organizationId: otherOrgId,
      });

      const result = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result).toBeNull();
    });

    test("returns null for non-existent endpoint", async () => {
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Temp",
          url: "https://temp.example.com/hook",
          secretHash: "temp",
          secret: "whsec_temp",
          secretPrefix: "whsec_temp",
          events: [],
          status: "active",
          failureCount: 0,
          createdBy: userId,
          createdAt: BASE_TIME,
          updatedAt: BASE_TIME,
        });
        await ctx.db.delete(id);
        return id;
      });

      const result = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId: tempId,
      });

      expect(result).toBeNull();
    });

    test("includes delivery stats", async () => {
      const endpointId = await seedEndpoint({ name: "Stats Single" });

      await seedDelivery({ endpointId, status: "delivered" });
      await seedDelivery({ endpointId, status: "delivered" });
      await seedDelivery({ endpointId, status: "failed" });

      const result = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result?.stats.total_deliveries).toBe(3);
      expect(result?.stats.successful).toBe(2);
      expect(result?.stats.failed).toBe(1);
    });
  });

  // =========================================================================
  // createEndpoint
  // =========================================================================

  describe("createEndpoint", () => {
    test("creates endpoint with required fields", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "New Webhook",
        url: "https://new.example.com/hook",
        events: ["document.created", "document.completed"],
      });

      expect(result.success).toBe(true);
      expect(result.endpointId).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.secret?.startsWith("whsec_")).toBe(true);

      const endpoint = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId: result.endpointId as Id<"webhook_endpoints">,
      });

      expect(endpoint?.name).toBe("New Webhook");
      expect(endpoint?.url).toBe("https://new.example.com/hook");
      expect(endpoint?.status).toBe("active");
      expect(endpoint?.events).toEqual(["document.created", "document.completed"]);
    });

    test("creates endpoint with optional description", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Described Webhook",
        url: "https://desc.example.com/hook",
        events: ["document.created"],
        description: "A test webhook with description",
      });

      const endpoint = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId: result.endpointId as Id<"webhook_endpoints">,
      });

      expect(endpoint?.description).toBe("A test webhook with description");
    });

    test("rejects empty name", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "   ",
        url: "https://example.com/hook",
        events: ["document.created"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    test("rejects name over 100 characters", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "a".repeat(101),
        url: "https://example.com/hook",
        events: ["document.created"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name must be 100 characters or less");
    });

    test("rejects non-HTTPS URL", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "HTTP Endpoint",
        url: "http://example.com/hook",
        events: ["document.created"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook URL must use HTTPS");
    });

    test("rejects invalid URL", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Bad URL",
        url: "not-a-url",
        events: ["document.created"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid URL format");
    });

    test("rejects invalid event type", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Bad Events",
        url: "https://example.com/hook",
        events: ["invalid.event"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid event type: invalid.event");
    });

    test("enforces max 10 endpoints per org", async () => {
      for (let i = 0; i < 10; i++) {
        await seedEndpoint({
          name: `Endpoint ${i}`,
          url: `https://example${i}.com/hook`,
        });
      }

      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Over Limit",
        url: "https://overlimit.example.com/hook",
        events: ["document.created"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Maximum of 10 webhook endpoints per organization");
    });
  });

  // =========================================================================
  // updateEndpoint
  // =========================================================================

  describe("updateEndpoint", () => {
    test("updates endpoint name", async () => {
      const endpointId = await seedEndpoint({ name: "Old Name" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        name: "New Name",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(endpoint?.name).toBe("New Name");
    });

    test("updates endpoint URL", async () => {
      const endpointId = await seedEndpoint({ url: "https://old.example.com/hook" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        url: "https://new.example.com/hook",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(endpoint?.url).toBe("https://new.example.com/hook");
    });

    test("updates endpoint events", async () => {
      const endpointId = await seedEndpoint({ events: ["document.created"] });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        events: ["document.created", "document.completed", "recipient.signed"],
      });

      expect(result.success).toBe(true);

      const endpoint = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(endpoint?.events).toEqual(["document.created", "document.completed", "recipient.signed"]);
    });

    test("updates endpoint status", async () => {
      const endpointId = await seedEndpoint({ status: "active" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        status: "paused",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(endpoint?.status).toBe("paused");
    });

    test("resets failureCount when reactivating disabled endpoint", async () => {
      const endpointId = await t.run(async (ctx) => {
        return await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Disabled Endpoint",
          url: "https://disabled.example.com/hook",
          secretHash: "hash",
          secret: "whsec_disabledsecret1234567890",
          secretPrefix: "whsec_disabl",
          events: ["document.created"],
          status: "disabled",
          failureCount: 8,
          createdBy: userId,
          createdAt: BASE_TIME,
          updatedAt: BASE_TIME,
        });
      });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        status: "active",
      });

      expect(result.success).toBe(true);

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      expect(doc?.status).toBe("active");
      expect(doc?.failureCount).toBe(0);
    });

    test("updates description", async () => {
      const endpointId = await seedEndpoint({ description: "Old desc" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        description: "New description",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(endpoint?.description).toBe("New description");
    });

    test("rejects empty name on update", async () => {
      const endpointId = await seedEndpoint({ name: "Valid Name" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        name: "   ",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    test("rejects non-HTTPS URL on update", async () => {
      const endpointId = await seedEndpoint({ url: "https://valid.example.com/hook" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        url: "http://insecure.example.com/hook",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook URL must use HTTPS");
    });

    test("rejects invalid event type on update", async () => {
      const endpointId = await seedEndpoint({ events: ["document.created"] });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        events: ["invalid.event"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid event type: invalid.event");
    });

    test("returns error for endpoint in different org", async () => {
      const endpointId = await seedEndpoint({
        name: "Other Org Endpoint",
        organizationId: otherOrgId,
      });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        name: "Should Not Update",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });

    test("returns error for non-existent endpoint", async () => {
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Temp",
          url: "https://temp.example.com/hook",
          secretHash: "temp",
          secret: "whsec_temp",
          secretPrefix: "whsec_temp",
          events: [],
          status: "active",
          failureCount: 0,
          createdBy: userId,
          createdAt: BASE_TIME,
          updatedAt: BASE_TIME,
        });
        await ctx.db.delete(id);
        return id;
      });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId: tempId,
        name: "Ghost",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });
  });

  // =========================================================================
  // deleteEndpoint
  // =========================================================================

  describe("deleteEndpoint", () => {
    test("deletes an existing endpoint", async () => {
      const endpointId = await seedEndpoint({ name: "Delete Me" });

      const result = await t.mutation(internal.api.v1.webhooks.deleteEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(true);

      const deleted = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });
      expect(deleted).toBeNull();
    });

    test("deletes associated deliveries", async () => {
      const endpointId = await seedEndpoint({ name: "Cascade Delete" });
      await seedDelivery({ endpointId, status: "delivered" });
      await seedDelivery({ endpointId, status: "failed" });

      await t.mutation(internal.api.v1.webhooks.deleteEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      const deliveries = await t.run(async (ctx) => {
        return await ctx.db
          .query("webhook_deliveries")
          .withIndex("by_endpoint", (q) => q.eq("endpointId", endpointId))
          .collect();
      });

      expect(deliveries).toHaveLength(0);
    });

    test("returns error for endpoint in different org", async () => {
      const endpointId = await seedEndpoint({
        name: "Other Org Endpoint",
        organizationId: otherOrgId,
      });

      const result = await t.mutation(internal.api.v1.webhooks.deleteEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });

    test("returns error for non-existent endpoint", async () => {
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Temp",
          url: "https://temp.example.com/hook",
          secretHash: "temp",
          secret: "whsec_temp",
          secretPrefix: "whsec_temp",
          events: [],
          status: "active",
          failureCount: 0,
          createdBy: userId,
          createdAt: BASE_TIME,
          updatedAt: BASE_TIME,
        });
        await ctx.db.delete(id);
        return id;
      });

      const result = await t.mutation(internal.api.v1.webhooks.deleteEndpoint, {
        userId,
        organizationId,
        endpointId: tempId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });
  });

  // =========================================================================
  // rotateSecret
  // =========================================================================

  describe("rotateSecret", () => {
    test("rotates secret and returns new secret", async () => {
      const endpointId = await seedEndpoint({ name: "Rotate Me" });

      const result = await t.mutation(internal.api.v1.webhooks.rotateSecret, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(true);
      expect(result.secret).toBeDefined();
      expect(result.secret?.startsWith("whsec_")).toBe(true);

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      expect(doc?.secret).toBe(result.secret);
      expect(doc?.secretPrefix).toBe(result.secret?.slice(0, 12));
    });

    test("returns error for endpoint in different org", async () => {
      const endpointId = await seedEndpoint({
        name: "Other Org Endpoint",
        organizationId: otherOrgId,
      });

      const result = await t.mutation(internal.api.v1.webhooks.rotateSecret, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });

    test("returns error for non-existent endpoint", async () => {
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Temp",
          url: "https://temp.example.com/hook",
          secretHash: "temp",
          secret: "whsec_temp",
          secretPrefix: "whsec_temp",
          events: [],
          status: "active",
          failureCount: 0,
          createdBy: userId,
          createdAt: BASE_TIME,
          updatedAt: BASE_TIME,
        });
        await ctx.db.delete(id);
        return id;
      });

      const result = await t.mutation(internal.api.v1.webhooks.rotateSecret, {
        userId,
        organizationId,
        endpointId: tempId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });
  });

  // =========================================================================
  // getEventTypes
  // =========================================================================

  describe("getEventTypes", () => {
    test("returns all event types", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });

    test("includes document events", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});

      const documentEvents = result.filter((e: (typeof result)[number]) => e.category === "Documents");
      expect(documentEvents.length).toBeGreaterThan(0);
      expect(documentEvents.some((e: (typeof result)[number]) => e.type === "document.created")).toBe(true);
      expect(documentEvents.some((e: (typeof result)[number]) => e.type === "document.completed")).toBe(true);
    });

    test("includes recipient events", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});

      const recipientEvents = result.filter((e: (typeof result)[number]) => e.category === "Recipients");
      expect(recipientEvents.length).toBeGreaterThan(0);
      expect(recipientEvents.some((e: (typeof result)[number]) => e.type === "recipient.signed")).toBe(true);
    });

    test("includes template events", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});

      const templateEvents = result.filter((e: (typeof result)[number]) => e.category === "Templates");
      expect(templateEvents.length).toBeGreaterThan(0);
      expect(templateEvents.some((e: (typeof result)[number]) => e.type === "template.created")).toBe(true);
    });

    test("each event has type, category, and description", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});

      for (const event of result) {
        expect(event.type).toBeDefined();
        expect(event.category).toBeDefined();
        expect(event.description).toBeDefined();
      }
    });
  });
});
