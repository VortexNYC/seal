import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("Webhook delivery", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;
  let endpointId: Id<"webhook_endpoints">;
  let deliveryId: Id<"webhook_deliveries">;

  const testPayload = JSON.stringify({ event: "document.sent", data: { id: "test" } });

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

    endpointId = await t.run(async (ctx) => {
      return await ctx.db.insert("webhook_endpoints", {
        organizationId,
        name: "Test Endpoint",
        url: "https://example.com/webhook",
        secretHash: "hash123",
        secret: "whsec_test_secret_key",
        secretPrefix: "whsec_test_s",
        events: ["document.sent"],
        status: "active",
        failureCount: 0,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    deliveryId = await t.run(async (ctx) => {
      return await ctx.db.insert("webhook_deliveries", {
        endpointId,
        organizationId,
        eventId: "evt_test_123",
        eventType: "document.sent",
        payload: testPayload,
        status: "pending",
        attemptCount: 0,
        createdAt: Date.now(),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getPendingDeliveries
  // ---------------------------------------------------------------------------
  describe("getPendingDeliveries", () => {
    test("returns deliveries with status pending and no nextRetryAt", async () => {
      const results = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.webhooks.delivery.getPendingDeliveries, {});
      });

      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe(deliveryId);
    });

    test("returns deliveries where nextRetryAt <= now", async () => {
      // Set nextRetryAt to the past
      await t.run(async (ctx) => {
        await ctx.db.patch(deliveryId, { nextRetryAt: Date.now() - 1000 });
      });

      const results = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.webhooks.delivery.getPendingDeliveries, {});
      });

      expect(results).toHaveLength(1);
      expect(results[0]._id).toBe(deliveryId);
    });

    test("does NOT return deliveries where nextRetryAt is in the future", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(deliveryId, { nextRetryAt: Date.now() + 60_000 });
      });

      const results = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.webhooks.delivery.getPendingDeliveries, {});
      });

      expect(results).toHaveLength(0);
    });

    test("does NOT return deliveries with status delivered", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(deliveryId, { status: "delivered" });
      });

      const results = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.webhooks.delivery.getPendingDeliveries, {});
      });

      expect(results).toHaveLength(0);
    });

    test("does NOT return deliveries with status abandoned", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(deliveryId, { status: "abandoned" });
      });

      const results = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.webhooks.delivery.getPendingDeliveries, {});
      });

      expect(results).toHaveLength(0);
    });

    test("limits results to 50", async () => {
      // Insert 55 additional pending deliveries (plus the 1 from beforeEach = 56 total)
      await t.run(async (ctx) => {
        for (let i = 0; i < 55; i++) {
          await ctx.db.insert("webhook_deliveries", {
            endpointId,
            organizationId,
            eventId: `evt_batch_${i}`,
            eventType: "document.sent",
            payload: testPayload,
            status: "pending",
            attemptCount: 0,
            createdAt: Date.now(),
          });
        }
      });

      const results = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.webhooks.delivery.getPendingDeliveries, {});
      });

      expect(results).toHaveLength(50);
    });
  });

  // ---------------------------------------------------------------------------
  // updateDeliveryResult
  // ---------------------------------------------------------------------------
  describe("updateDeliveryResult", () => {
    test("updates delivery to delivered with response code and deliveredAt", async () => {
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.webhooks.delivery.updateDeliveryResult, {
          deliveryId,
          status: "delivered",
          attemptCount: 1,
          responseCode: 200,
          responseBody: '{"ok":true}',
          responseTimeMs: 150,
          deliveredAt: now,
        });
      });

      const delivery = await t.run(async (ctx) => {
        return await ctx.db.get(deliveryId);
      });

      expect(delivery).not.toBeNull();
      expect(delivery!.status).toBe("delivered");
      expect(delivery!.attemptCount).toBe(1);
      expect(delivery!.responseCode).toBe(200);
      expect(delivery!.responseBody).toBe('{"ok":true}');
      expect(delivery!.responseTimeMs).toBe(150);
      expect(delivery!.deliveredAt).toBe(now);
    });

    test("updates delivery to pending (retry) with nextRetryAt and incremented attemptCount", async () => {
      const nextRetry = Date.now() + 30_000;

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.webhooks.delivery.updateDeliveryResult, {
          deliveryId,
          status: "pending",
          attemptCount: 1,
          responseCode: 500,
          responseBody: "Internal Server Error",
          responseTimeMs: 200,
          errorMessage: "HTTP 500: Internal Server Error",
          nextRetryAt: nextRetry,
        });
      });

      const delivery = await t.run(async (ctx) => {
        return await ctx.db.get(deliveryId);
      });

      expect(delivery).not.toBeNull();
      expect(delivery!.status).toBe("pending");
      expect(delivery!.attemptCount).toBe(1);
      expect(delivery!.nextRetryAt).toBe(nextRetry);
      expect(delivery!.errorMessage).toBe("HTTP 500: Internal Server Error");
    });

    test("updates delivery to abandoned with error message", async () => {
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.webhooks.delivery.updateDeliveryResult, {
          deliveryId,
          status: "abandoned",
          attemptCount: 5,
          errorMessage: "Max retry attempts exceeded",
        });
      });

      const delivery = await t.run(async (ctx) => {
        return await ctx.db.get(deliveryId);
      });

      expect(delivery).not.toBeNull();
      expect(delivery!.status).toBe("abandoned");
      expect(delivery!.attemptCount).toBe(5);
      expect(delivery!.errorMessage).toBe("Max retry attempts exceeded");
    });
  });

  // ---------------------------------------------------------------------------
  // updateEndpointStatus
  // ---------------------------------------------------------------------------
  describe("updateEndpointStatus", () => {
    test("on success, resets failureCount to 0 and sets lastSuccessAt", async () => {
      // Set a non-zero failure count first
      await t.run(async (ctx) => {
        await ctx.db.patch(endpointId, { failureCount: 3 });
      });

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.webhooks.delivery.updateEndpointStatus, {
          endpointId,
          success: true,
        });
      });

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.failureCount).toBe(0);
      expect(endpoint!.lastSuccessAt).toBeDefined();
      expect(endpoint!.lastAttemptAt).toBeDefined();
      expect(endpoint!.status).toBe("active");
    });

    test("on failure, increments failureCount", async () => {
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.webhooks.delivery.updateEndpointStatus, {
          endpointId,
          success: false,
        });
      });

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.failureCount).toBe(1);
      expect(endpoint!.lastAttemptAt).toBeDefined();
      expect(endpoint!.status).toBe("active");
    });

    test("auto-disables endpoint after 10 consecutive failures", async () => {
      // Set failure count to 9 (one away from threshold)
      await t.run(async (ctx) => {
        await ctx.db.patch(endpointId, { failureCount: 9 });
      });

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.webhooks.delivery.updateEndpointStatus, {
          endpointId,
          success: false,
        });
      });

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.failureCount).toBe(10);
      expect(endpoint!.status).toBe("disabled");
    });

    test("does not disable endpoint at 9 failures (below threshold)", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(endpointId, { failureCount: 8 });
      });

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.webhooks.delivery.updateEndpointStatus, {
          endpointId,
          success: false,
        });
      });

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.failureCount).toBe(9);
      expect(endpoint!.status).toBe("active");
    });

    test("success after failures resets failureCount", async () => {
      // Simulate 5 consecutive failures
      await t.run(async (ctx) => {
        await ctx.db.patch(endpointId, { failureCount: 5 });
      });

      // Then a success
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.webhooks.delivery.updateEndpointStatus, {
          endpointId,
          success: true,
        });
      });

      const endpoint = await t.run(async (ctx) => {
        return await ctx.db.get(endpointId);
      });

      expect(endpoint).not.toBeNull();
      expect(endpoint!.failureCount).toBe(0);
      expect(endpoint!.lastSuccessAt).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getEndpointById
  // ---------------------------------------------------------------------------
  describe("getEndpointById", () => {
    test("returns endpoint by ID", async () => {
      const endpoint = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.webhooks.delivery.getEndpointById, {
          endpointId,
        });
      });

      expect(endpoint).not.toBeNull();
      expect(endpoint!._id).toBe(endpointId);
      expect(endpoint!.name).toBe("Test Endpoint");
      expect(endpoint!.url).toBe("https://example.com/webhook");
      expect(endpoint!.status).toBe("active");
    });

    test("returns null for non-existent ID", async () => {
      // Create and immediately delete an endpoint to get a valid-shaped but non-existent ID
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("webhook_endpoints", {
          organizationId,
          name: "Temp",
          url: "https://example.com/temp",
          secretHash: "temp",
          secret: "temp",
          secretPrefix: "temp",
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

      const endpoint = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.webhooks.delivery.getEndpointById, {
          endpointId: tempId,
        });
      });

      expect(endpoint).toBeNull();
    });
  });
});
