import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/webhooks", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const VALID_URL = "https://example.com/webhooks";
  const VALID_EVENTS = ["document.created", "document.sent"];

  async function insertEndpoint(overrides: {
    name?: string;
    url?: string;
    events?: string[];
    status?: "active" | "paused" | "disabled";
    description?: string;
    organizationId?: Id<"organizations">;
  } = {}) {
    return t.run(async (ctx) => {
      return await ctx.db.insert("webhook_endpoints", {
        organizationId: overrides.organizationId ?? organizationId,
        name: overrides.name ?? "Test Endpoint",
        url: overrides.url ?? VALID_URL,
        secretHash: "abc123hash",
        secret: "whsec_abc123secret",
        secretPrefix: "whsec_abc1",
        events: overrides.events ?? VALID_EVENTS,
        status: overrides.status ?? "active",
        failureCount: 0,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...(overrides.description !== undefined ? { description: overrides.description } : {}),
      });
    });
  }

  async function insertDelivery(overrides: {
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
        payload: JSON.stringify({ event: "document.created" }),
        status: overrides.status ?? "delivered",
        attemptCount: 1,
        createdAt: overrides.createdAt ?? Date.now(),
        ...(overrides.status === "delivered" ? { deliveredAt: Date.now() } : {}),
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Webhooks Test Org",
        slug: "webhooks-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-webhooks-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@webhooks-test.com",
        name: "Admin",
        authSubject: "webhooks_admin",
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

      expect(result).toEqual([]);
    });

    test("returns endpoints for the organization", async () => {
      await insertEndpoint({ name: "Endpoint 1" });
      await insertEndpoint({ name: "Endpoint 2" });

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.name).sort()).toEqual(["Endpoint 1", "Endpoint 2"]);
    });

    test("does not return endpoints from other organizations", async () => {
      await insertEndpoint({ name: "My Endpoint" });
      await insertEndpoint({ name: "Other Endpoint", organizationId: otherOrgId });

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("My Endpoint");
    });

    test("includes delivery stats in endpoint response", async () => {
      const endpointId = await insertEndpoint({ name: "With Stats" });
      await insertDelivery({ endpointId, status: "delivered" });
      await insertDelivery({ endpointId, status: "delivered" });
      await insertDelivery({ endpointId, status: "failed" });

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      expect(result).toHaveLength(1);
      expect(result[0].stats.total_deliveries).toBe(3);
      expect(result[0].stats.successful).toBe(2);
      expect(result[0].stats.failed).toBe(1);
      expect(result[0].stats.success_rate).toBe(67);
    });

    test("returns 100% success rate when no deliveries exist", async () => {
      await insertEndpoint({ name: "No Stats" });

      const result = await t.query(internal.api.v1.webhooks.listEndpoints, {
        userId,
        organizationId,
      });

      expect(result).toHaveLength(1);
      expect(result[0].stats.total_deliveries).toBe(0);
      expect(result[0].stats.success_rate).toBe(100);
    });
  });

  // =========================================================================
  // getEndpoint
  // =========================================================================

  describe("getEndpoint", () => {
    test("returns endpoint by ID", async () => {
      const endpointId = await insertEndpoint({ name: "My Endpoint", description: "Test desc" });

      const result = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(endpointId);
      expect(result!.name).toBe("My Endpoint");
      expect(result!.url).toBe(VALID_URL);
      expect(result!.status).toBe("active");
      expect(result!.description).toBe("Test desc");
    });

    test("returns null for non-existent endpoint", async () => {
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Temp",
          url: VALID_URL,
          secretHash: "hash",
          secret: "secret",
          secretPrefix: "prefix",
          events: [],
          status: "active",
          failureCount: 0,
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
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

    test("returns null for endpoint belonging to another organization", async () => {
      const endpointId = await insertEndpoint({
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
      const endpointId = await insertEndpoint({ name: "Stats Endpoint" });
      await insertDelivery({ endpointId, status: "delivered" });
      await insertDelivery({ endpointId, status: "abandoned" });

      const result = await t.query(internal.api.v1.webhooks.getEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result).not.toBeNull();
      expect(result!.stats.total_deliveries).toBe(2);
      expect(result!.stats.successful).toBe(1);
      expect(result!.stats.failed).toBe(1);
    });
  });

  // =========================================================================
  // createEndpoint
  // =========================================================================

  describe("createEndpoint", () => {
    test("creates a webhook endpoint successfully", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "New Endpoint",
        url: "https://example.com/hook",
        events: ["document.created", "document.completed"],
        description: "My webhook",
      });

      expect(result.success).toBe(true);
      expect(result.endpointId).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.secret).toMatch(/^whsec_/);
    });

    test("rejects empty name", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "   ",
        url: VALID_URL,
        events: VALID_EVENTS,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    test("rejects name exceeding 100 characters", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "a".repeat(101),
        url: VALID_URL,
        events: VALID_EVENTS,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name must be 100 characters or less");
    });

    test("rejects non-HTTPS URL", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Bad URL",
        url: "http://example.com/hook",
        events: VALID_EVENTS,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook URL must use HTTPS");
    });

    test("rejects invalid URL format", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Bad URL",
        url: "not-a-url",
        events: VALID_EVENTS,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid URL format");
    });

    test("rejects invalid event type", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Bad Event",
        url: VALID_URL,
        events: ["document.created", "invalid.event"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid event type: invalid.event");
    });

    test("rejects creating more than 10 endpoints per organization", async () => {
      for (let i = 0; i < 10; i++) {
        await t.mutation(internal.api.v1.webhooks.createEndpoint, {
          userId,
          organizationId,
          name: `Endpoint ${i}`,
          url: `https://example.com/hook-${i}`,
          events: VALID_EVENTS,
        });
      }

      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Endpoint 11",
        url: "https://example.com/hook-11",
        events: VALID_EVENTS,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Maximum of 10 webhook endpoints per organization");
    });

    test("persists endpoint data correctly", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.createEndpoint, {
        userId,
        organizationId,
        name: "Persisted Endpoint",
        url: "https://example.com/persist",
        events: ["document.created"],
        description: "My desc",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(result.endpointId as Id<"webhook_endpoints">);
      });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.name).toBe("Persisted Endpoint");
      expect(endpoint!.url).toBe("https://example.com/persist");
      expect(endpoint!.events).toEqual(["document.created"]);
      expect(endpoint!.description).toBe("My desc");
      expect(endpoint!.status).toBe("active");
      expect(endpoint!.secretHash).toBeDefined();
      expect(endpoint!.secret).toMatch(/^whsec_/);
      expect(endpoint!.secretPrefix).toBe(result.secret!.slice(0, 12));
      expect(endpoint!.organizationId).toBe(organizationId);
      expect(endpoint!.createdBy).toBe(userId);
    });
  });

  // =========================================================================
  // updateEndpoint
  // =========================================================================

  describe("updateEndpoint", () => {
    let endpointId: Id<"webhook_endpoints">;

    beforeEach(async () => {
      endpointId = await insertEndpoint({ name: "Update Me" });
    });

    test("updates endpoint name", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        name: "Updated Name",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });
      expect(endpoint!.name).toBe("Updated Name");
    });

    test("updates endpoint URL", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        url: "https://new-url.example.com/hook",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });
      expect(endpoint!.url).toBe("https://new-url.example.com/hook");
    });

    test("updates endpoint events", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        events: ["document.completed", "recipient.signed"],
      });

      expect(result.success).toBe(true);

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });
      expect(endpoint!.events).toEqual(["document.completed", "recipient.signed"]);
    });

    test("updates endpoint status to paused", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        status: "paused",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });
      expect(endpoint!.status).toBe("paused");
    });

    test("re-enables a disabled endpoint and resets failure count", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(endpointId, {
          status: "disabled",
          failureCount: 5,
        });
      });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        status: "active",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });
      expect(endpoint!.status).toBe("active");
      expect(endpoint!.failureCount).toBe(0);
    });

    test("updates description", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        description: "New description",
      });

      expect(result.success).toBe(true);

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });
      expect(endpoint!.description).toBe("New description");
    });

    test("rejects empty name", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        name: "   ",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    test("rejects name exceeding 100 characters", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        name: "a".repeat(101),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Name must be 100 characters or less");
    });

    test("rejects non-HTTPS URL", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        url: "http://insecure.example.com",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook URL must use HTTPS");
    });

    test("rejects invalid URL format", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        url: "not-a-url",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid URL format");
    });

    test("rejects invalid event type", async () => {
      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId,
        events: ["bogus.event"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid event type: bogus.event");
    });

    test("returns error for non-existent endpoint", async () => {
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Temp",
          url: VALID_URL,
          secretHash: "hash",
          secret: "secret",
          secretPrefix: "prefix",
          events: [],
          status: "active",
          failureCount: 0,
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.delete(id);
        return id;
      });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId: tempId,
        name: "New Name",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });

    test("returns error for endpoint belonging to another organization", async () => {
      const otherEndpointId = await insertEndpoint({
        name: "Other Org",
        organizationId: otherOrgId,
      });

      const result = await t.mutation(internal.api.v1.webhooks.updateEndpoint, {
        userId,
        organizationId,
        endpointId: otherEndpointId,
        name: "Hacked",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });
  });

  // =========================================================================
  // deleteEndpoint
  // =========================================================================

  describe("deleteEndpoint", () => {
    test("deletes endpoint and its deliveries", async () => {
      const endpointId = await insertEndpoint({ name: "Delete Me" });
      await insertDelivery({ endpointId });
      await insertDelivery({ endpointId, status: "failed" });

      const result = await t.mutation(internal.api.v1.webhooks.deleteEndpoint, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(true);

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });
      expect(endpoint).toBeNull();

      const deliveries = await t.run(async (ctx) => {
        return await ctx.db
          .query("webhook_deliveries")
          .withIndex("by_endpoint", (q) => q.eq("endpointId", endpointId))
          .collect();
      });
      expect(deliveries).toHaveLength(0);
    });

    test("returns error for non-existent endpoint", async () => {
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Temp",
          url: VALID_URL,
          secretHash: "hash",
          secret: "secret",
          secretPrefix: "prefix",
          events: [],
          status: "active",
          failureCount: 0,
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
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

    test("returns error for endpoint belonging to another organization", async () => {
      const otherEndpointId = await insertEndpoint({
        name: "Other Org",
        organizationId: otherOrgId,
      });

      const result = await t.mutation(internal.api.v1.webhooks.deleteEndpoint, {
        userId,
        organizationId,
        endpointId: otherEndpointId,
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
      const endpointId = await insertEndpoint({ name: "Rotate Me" });

      const before = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      const result = await t.mutation(internal.api.v1.webhooks.rotateSecret, {
        userId,
        organizationId,
        endpointId,
      });

      expect(result.success).toBe(true);
      expect(result.secret).toBeDefined();
      expect(result.secret).toMatch(/^whsec_/);

      const after = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      expect(after!.secret).toBe(result.secret);
      expect(after!.secret).not.toBe(before!.secret);
      expect(after!.secretHash).not.toBe(before!.secretHash);
      expect(after!.secretPrefix).toBe(result.secret!.slice(0, 12));
    });

    test("returns error for non-existent endpoint", async () => {
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Temp",
          url: VALID_URL,
          secretHash: "hash",
          secret: "secret",
          secretPrefix: "prefix",
          events: [],
          status: "active",
          failureCount: 0,
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
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

    test("returns error for endpoint belonging to another organization", async () => {
      const otherEndpointId = await insertEndpoint({
        name: "Other Org",
        organizationId: otherOrgId,
      });

      const result = await t.mutation(internal.api.v1.webhooks.rotateSecret, {
        userId,
        organizationId,
        endpointId: otherEndpointId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook endpoint not found");
    });
  });

  // =========================================================================
  // getEventTypes
  // =========================================================================

  describe("getEventTypes", () => {
    test("returns list of available event types", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});

      expect(result).toHaveLength(16);
      expect(result[0]).toEqual({
        type: "document.created",
        category: "Documents",
        description: "A new document was created",
      });
    });

    test("includes all document events", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});
      const docEvents = result.filter((e) => e.category === "Documents");

      expect(docEvents.map((e) => e.type)).toEqual([
        "document.created",
        "document.sent",
        "document.viewed",
        "document.completed",
        "document.voided",
        "document.expired",
        "document.declined",
      ]);
    });

    test("includes all recipient events", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});
      const recipientEvents = result.filter((e) => e.category === "Recipients");

      expect(recipientEvents.map((e) => e.type)).toEqual([
        "recipient.added",
        "recipient.viewed",
        "recipient.signed",
        "recipient.approved",
        "recipient.declined",
        "recipient.reminded",
      ]);
    });

    test("includes all template events", async () => {
      const result = await t.query(internal.api.v1.webhooks.getEventTypes, {});
      const templateEvents = result.filter((e) => e.category === "Templates");

      expect(templateEvents.map((e) => e.type)).toEqual([
        "template.created",
        "template.updated",
        "template.used",
      ]);
    });
  });
});