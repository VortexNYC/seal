import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../_generated/api";
import { createTestContext } from "../../test.setup";

describe("Webhook idempotency", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  describe("isEventProcessed", () => {
    test("returns false for non-existent event", async () => {
      const result = await t.query(internal.stripe.webhook_idempotency.isEventProcessed, {
        eventId: "evt_nonexistent",
      });
      expect(result).toBe(false);
    });

    test("returns true after event is marked as processed", async () => {
      await t.mutation(internal.stripe.webhook_idempotency.markEventProcessed, {
        eventId: "evt_123",
        eventType: "checkout.session.completed",
        source: "main",
      });

      const result = await t.query(internal.stripe.webhook_idempotency.isEventProcessed, {
        eventId: "evt_123",
      });
      expect(result).toBe(true);
    });
  });

  describe("markEventProcessed", () => {
    test("creates a new record and returns its ID", async () => {
      const id = await t.mutation(internal.stripe.webhook_idempotency.markEventProcessed, {
        eventId: "evt_new",
        eventType: "payment_intent.succeeded",
        source: "connect",
      });
      expect(id).toBeDefined();

      // Verify the record was actually inserted
      const exists = await t.query(internal.stripe.webhook_idempotency.isEventProcessed, {
        eventId: "evt_new",
      });
      expect(exists).toBe(true);
    });

    test("returns existing ID on duplicate (idempotent)", async () => {
      const firstId = await t.mutation(internal.stripe.webhook_idempotency.markEventProcessed, {
        eventId: "evt_duplicate",
        eventType: "invoice.paid",
        source: "main",
      });

      const secondId = await t.mutation(internal.stripe.webhook_idempotency.markEventProcessed, {
        eventId: "evt_duplicate",
        eventType: "invoice.paid",
        source: "main",
      });

      expect(secondId).toEqual(firstId);
    });
  });

  describe("cleanupOldEvents", () => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    test("deletes events older than 7 days", async () => {
      const eightDaysAgo = Date.now() - SEVEN_DAYS_MS - 24 * 60 * 60 * 1000;

      await t.run(async (ctx) => {
        await ctx.db.insert("stripe_webhook_events", {
          eventId: "evt_old_1",
          eventType: "charge.succeeded",
          source: "main",
          processedAt: eightDaysAgo,
        });
        await ctx.db.insert("stripe_webhook_events", {
          eventId: "evt_old_2",
          eventType: "charge.failed",
          source: "connect",
          processedAt: eightDaysAgo - 1000,
        });
      });

      const result = await t.mutation(internal.stripe.webhook_idempotency.cleanupOldEvents, {});
      expect(result).toEqual({ deleted: 2 });

      // Verify they were actually deleted
      const check1 = await t.query(internal.stripe.webhook_idempotency.isEventProcessed, {
        eventId: "evt_old_1",
      });
      const check2 = await t.query(internal.stripe.webhook_idempotency.isEventProcessed, {
        eventId: "evt_old_2",
      });
      expect(check1).toBe(false);
      expect(check2).toBe(false);
    });

    test("keeps recent events", async () => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      await t.run(async (ctx) => {
        await ctx.db.insert("stripe_webhook_events", {
          eventId: "evt_recent",
          eventType: "invoice.created",
          source: "main",
          processedAt: oneDayAgo,
        });
      });

      const result = await t.mutation(internal.stripe.webhook_idempotency.cleanupOldEvents, {});
      expect(result).toEqual({ deleted: 0 });

      // Verify the recent event still exists
      const exists = await t.query(internal.stripe.webhook_idempotency.isEventProcessed, {
        eventId: "evt_recent",
      });
      expect(exists).toBe(true);
    });

    test("returns 0 when no old events exist", async () => {
      const result = await t.mutation(internal.stripe.webhook_idempotency.cleanupOldEvents, {});
      expect(result).toEqual({ deleted: 0 });
    });

    test("respects 100 batch limit", async () => {
      const eightDaysAgo = Date.now() - SEVEN_DAYS_MS - 24 * 60 * 60 * 1000;

      // Insert 120 old events
      await t.run(async (ctx) => {
        for (let i = 0; i < 120; i++) {
          await ctx.db.insert("stripe_webhook_events", {
            eventId: `evt_batch_${i}`,
            eventType: "charge.succeeded",
            source: "main",
            processedAt: eightDaysAgo - i * 1000,
          });
        }
      });

      const result = await t.mutation(internal.stripe.webhook_idempotency.cleanupOldEvents, {});
      expect(result).toEqual({ deleted: 100 });

      // Verify 20 old events still remain (need another cleanup pass)
      const remainingCount = await t.run(async (ctx) => {
        const remaining = await ctx.db.query("stripe_webhook_events").collect();
        return remaining.length;
      });
      expect(remainingCount).toBe(20);
    });
  });
});
