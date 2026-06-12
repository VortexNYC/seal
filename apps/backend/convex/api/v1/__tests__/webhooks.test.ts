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
        secret: "whsec_testsecretvalue",
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

  async function seedDelivery(
    endpointId: Id<"webhook_endpoints">,
    status: "pending" | "delivered" | "failed" | "abandoned",
  ) {
    return t.run(async (ctx) => {
      return await ctx.db.insert("webhook_deliveries", {
        endpointId,
        organizationId,
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        eventType: "document.created",
        payload: "{}",
        status,
        attemptCount: 1,
        createdAt: BASE_TIME,
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
      const names = result.map((e) => e.name).sort();
      expect(names).toEqual(["Endpoint A", "Endpoint B"]);
    });

    test("includes delivery stats", async () => {
      const endpointId = await seedEndpoint({ name: "Stats Endpoint" });
      await seedDelivery(endpointId, "delivered");
      await seedDelivery(endpointId, "delivered");
      await seedDelivery(endpointId, "failed");

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      expect(result).toHaveLength(1);
      const stats = result[0]!.stats;
      expect(stats.total_deliveries).toBe(3);
      expect(stats.successful).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.success_rate).toBe(67);
    });

    test("returns 100% success rate when no deliveries", async () => {
      await seedEndpoint({ name: "No Deliveries" });

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      expect(result[0]!.stats.success_rate).toBe(100);
    });
  });

  // =========================================================================
  // getEndpoint
  // =========================================================================

  describe("getEndpoint", () => {
    test("returns endpoint by ID", async () => {
      const endpointId = await seedEndpoint({ name: "Single Endpoint" });

      const result = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(endpointId);
      expect(result?.name).toBe("Single Endpoint");
      expect(result?.url).toBe("https://example.com/webhook");
      expect(result?.status).toBe("active");
      expect(result?.events).toEqual(["document.created"]);
      expect(result?.secret_prefix).toBe("whsec_testse");
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

    test("includes delivery stats", async () => {
      const endpointId = await seedEndpoint({ name: "Stats Endpoint" });
      await seedDelivery(endpointId, "delivered");

      const result = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result!.stats.total_deliveries).toBe(1);
      expect(result!.stats.successful).toBe(1);
      expect(result!.stats.success_rate).toBe(100);
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
        name: "New Endpoint",
        url: "https://hooks.example.com/seal",
        events: ["document.completed", "recipient.signed"],
      });

      expect(result.success).toBe(true);
      expect(result.endpointId).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.secret!.startsWith("whsec_")).toBe(true);

      const fetched = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId: result.endpointId as Id<"webhook_endpoints">,
      });

      expect(fetched?.name).toBe("New Endpoint");
      expect(fetched?.url).toBe("https://hooks.example.com/seal");
      expect(fetched?.events).toEqual(["document.completed", "recipient.signed"]);
      expect(fetched?.status).toBe("active");
    });

    test("creates endpoint with description", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Described Endpoint",
        url: "https://hooks.example.com/seal",
        events: ["document.created"],
        description: "A helpful description",
      });

      expect(result.success).toBe(true);

      const fetched = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId: result.endpointId as Id<"webhook_endpoints">,
      });

      expect(fetched?.description).toBe("A helpful description");
    });

    test("fails when name is empty", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "   ",
        url: "https://hooks.example.com/seal",
        events: ["document.created"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    test("fails when name exceeds 100 characters", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "a".repeat(101),
        url: "https://hooks.example.com/seal",
        events: ["document.created"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name must be 100 characters or less");
    });

    test("fails when URL is not HTTPS", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Bad URL",
        url: "http://insecure.example.com/seal",
        events: ["document.created"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook URL must use HTTPS");
    });

    test("fails when URL is invalid", async () => {
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

    test("fails when event type is invalid", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Bad Events",
        url: "https://hooks.example.com/seal",
        events: ["document.nonexistent"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid event type: document.nonexistent");
    });

    test("fails when exceeding 10 endpoints per org", async () => {
      for (let i = 0; i < 10; i++) {
        await seedEndpoint({ name: `Endpoint ${i}` });
      }

      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Too Many",
        url: "https://hooks.example.com/seal",
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
      const endpointId = await seedEndpoint({ name: "Original Name" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        name: "Updated Name",
      });

      expect(result.success).toBe(true);

      const fetched = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(fetched?.name).toBe("Updated Name");
    });

    test("updates endpoint URL", async () => {
      const endpointId = await seedEndpoint({ name: "URL Update" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        url: "https://new.example.com/webhook",
      });

      expect(result.success).toBe(true);

      const fetched = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(fetched?.url).toBe("https://new.example.com/webhook");
    });

    test("updates endpoint events", async () => {
      const endpointId = await seedEndpoint({
        name: "Events Update",
        events: ["document.created"],
      });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        events: ["document.completed"],
      });

      expect(result.success).toBe(true);

      const fetched = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(fetched?.events).toEqual(["document.completed"]);
    });

    test("updates endpoint status", async () => {
      const endpointId = await seedEndpoint({ name: "Status Update", status: "active" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        status: "paused",
      });

      expect(result.success).toBe(true);

      const fetched = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(fetched?.status).toBe("paused");
    });

    test("fails for endpoint in different org", async () => {
      const endpointId = await seedEndpoint({ name: "Other Org", organizationId: otherOrgId });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        name: "Should Fail",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });

    test("fails when name is empty", async () => {
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

    test("fails when URL is not HTTPS", async () => {
      const endpointId = await seedEndpoint({ name: "URL Check" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        url: "http://insecure.com",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook URL must use HTTPS");
    });

    test("fails when event type is invalid", async () => {
      const endpointId = await seedEndpoint({ name: "Event Check" });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        events: ["invalid.event"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid event type: invalid.event");
    });

    test("resets failureCount when activating from disabled", async () => {
      const endpointId = await seedEndpoint({ name: "Activation Reset", status: "disabled" });

      await t.run(async (ctx) => {
        await ctx.db.patch(endpointId, { failureCount: 5 });
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

      expect(doc?.failureCount).toBe(0);
    });
  });

  // =========================================================================
  // deleteEndpoint
  // =========================================================================

  describe("deleteEndpoint", () => {
    test("deletes an existing endpoint and its deliveries", async () => {
      const endpointId = await seedEndpoint({ name: "To Delete" });
      await seedDelivery(endpointId, "delivered");
      await seedDelivery(endpointId, "failed");

      const result = await t.mutation(internal.api.v1.webhooks.deleteEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(true);

      const fetched = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(fetched).toBeNull();

      const deliveries = await t.run(async (ctx) => {
        return await ctx.db
          .query("webhook_deliveries")
          .withIndex("by_endpoint", (q) => q.eq("endpointId", endpointId))
          .collect();
      });

      expect(deliveries).toHaveLength(0);
    });

    test("fails for endpoint in different org", async () => {
      const endpointId = await seedEndpoint({ name: "Other Org", organizationId: otherOrgId });

      const result = await t.mutation(internal.api.v1.webhooks.deleteEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });
  });

  // =========================================================================
  // rotateSecret
  // =========================================================================

  describe("rotateSecret", () => {
    test("returns a new secret", async () => {
      const endpointId = await seedEndpoint({ name: "Rotate Me" });

      const result = await t.mutation(internal.api.v1.webhooks.rotateSecret, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(true);
      expect(result.secret).toBeDefined();
      expect(result.secret!.startsWith("whsec_")).toBe(true);

      const doc = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      expect(doc?.secretPrefix).toBe(result.secret!.slice(0, 12));
    });

    test("fails for endpoint in different org", async () => {
      const endpointId = await seedEndpoint({ name: "Other Org", organizationId: otherOrgId });

      const result = await t.mutation(internal.api.v1.webhooks.rotateSecret, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });
  });

  // =========================================================================
  // getEventTypes
  // =========================================================================

  describe("getEventTypes", () => {
    test("returns event types list", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("type");
      expect(result[0]).toHaveProperty("category");
      expect(result[0]).toHaveProperty("description");
    });
  });
});
