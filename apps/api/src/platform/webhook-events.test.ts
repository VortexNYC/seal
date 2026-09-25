import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import { organization, webhookDeliveries, webhooks } from "../global/schema.js";
import {
  deliverToWebhook,
  emitWebhookEvent,
  processWebhookDeliveries,
  retryWebhookDelivery,
} from "./webhook-events.js";

async function seedOrg() {
  const db = createD1(env.D1);
  const orgId = crypto.randomUUID();
  await db.insert(organization).values({
    id: orgId,
    name: "Test Org",
    slug: `test-org-${crypto.randomUUID().slice(0, 8)}`,
  });
  return { orgId, db };
}

async function createWebhook(
  db: ReturnType<typeof createD1>,
  {
    organizationId,
    url,
    events,
    status = "active",
  }: {
    organizationId: string;
    url: string;
    events: string[];
    status?: string;
  }
) {
  const id = crypto.randomUUID();
  await db.insert(webhooks).values({
    id,
    publicId: crypto.randomUUID(),
    organizationId,
    name: "Test webhook",
    url,
    events: JSON.stringify(events),
    secret: "test-secret",
    status,
  });
  return id;
}

describe("webhook-events", () => {
  it("emits pending deliveries for subscribed webhooks", async () => {
    const { orgId, db } = await seedOrg();
    await createWebhook(db, {
      organizationId: orgId,
      url: "https://example.com/hook",
      events: ["document.sent"],
    });
    await createWebhook(db, {
      organizationId: orgId,
      url: "https://example.com/hook2",
      events: ["document.completed"],
    });

    const result = await emitWebhookEvent(
      env,
      {
        organizationId: orgId,
        eventType: "document.sent",
        payload: { documentId: crypto.randomUUID() },
      },
      { flushImmediately: false }
    );

    expect(result.deliveryCount).toBe(1);

    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, orgId));
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe("pending");
    expect(rows[0]?.eventType).toBe("document.sent");
  });

  it("flushes deliveries immediately on emit (SEA-64)", async () => {
    const { orgId, db } = await seedOrg();
    await createWebhook(db, {
      organizationId: orgId,
      url: "https://example.com/hook-flush",
      events: ["document.completed"],
    });

    const result = await emitWebhookEvent(
      env,
      {
        organizationId: orgId,
        eventType: "document.completed",
        payload: { documentId: crypto.randomUUID() },
      },
      {
        fetchImpl: async () => new Response("ok", { status: 200 }),
      }
    );

    expect(result.deliveryCount).toBe(1);
    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, orgId));
    expect(rows[0]?.status).toBe("delivered");
  });

  it("delivers pending webhooks and updates status", async () => {
    const { orgId, db } = await seedOrg();
    const url = "https://example.com/hook";
    await createWebhook(db, {
      organizationId: orgId,
      url,
      events: ["document.sent"],
    });

    await emitWebhookEvent(
      env,
      {
        organizationId: orgId,
        eventType: "document.sent",
        payload: { documentId: crypto.randomUUID() },
      },
      { flushImmediately: false }
    );

    const result = await processWebhookDeliveries(env, {
      organizationId: orgId,
      fetchImpl: async () => new Response("ok", { status: 200 }),
    });

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);

    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, orgId));
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe("delivered");
    expect(rows[0]?.responseStatus).toBe(200);
    expect(rows[0]?.attemptCount).toBe(1);

    const [hook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.organizationId, orgId));
    expect(hook?.totalDeliveries).toBe(1);
    expect(hook?.successfulDeliveries).toBe(1);
    expect(hook?.failedDeliveries).toBe(0);
  });

  it("retries failed deliveries and eventually marks them failed", async () => {
    const { orgId, db } = await seedOrg();
    const url = "https://example.com/hook";
    await createWebhook(db, {
      organizationId: orgId,
      url,
      events: ["document.sent"],
    });

    await emitWebhookEvent(
      env,
      {
        organizationId: orgId,
        eventType: "document.sent",
        payload: { documentId: crypto.randomUUID() },
      },
      { flushImmediately: false }
    );

    const delivery = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, orgId))
      .then((rows) => rows[0]);
    if (delivery) {
      await db
        .update(webhookDeliveries)
        .set({ maxAttempts: 1 })
        .where(eq(webhookDeliveries.id, delivery.id));
    }

    const result = await processWebhookDeliveries(env, {
      organizationId: orgId,
      fetchImpl: async () => new Response("error", { status: 500 }),
    });

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);

    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, orgId));
    expect(rows[0]?.status).toBe("failed");
    expect(rows[0]?.attemptCount).toBeGreaterThanOrEqual(1);
  });

  it("does not deliver to non-active webhooks", async () => {
    const { orgId, db } = await seedOrg();
    const url = "https://example.com/hook";
    await createWebhook(db, {
      organizationId: orgId,
      url,
      events: ["document.sent"],
      status: "paused",
    });

    await emitWebhookEvent(
      env,
      {
        organizationId: orgId,
        eventType: "document.sent",
        payload: { documentId: crypto.randomUUID() },
      },
      { flushImmediately: false }
    );

    const result = await processWebhookDeliveries(env, {
      organizationId: orgId,
      fetchImpl: async () => new Response("ok", { status: 200 }),
    });

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);

    const rows = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, orgId));
    expect(rows[0]?.status).toBe("failed");
    expect(rows[0]?.lastError).toBe("webhook is not active");
  });

  it("retries a failed delivery via retryWebhookDelivery (SEA-64)", async () => {
    const { orgId, db } = await seedOrg();
    await createWebhook(db, {
      organizationId: orgId,
      url: "https://example.com/hook-retry",
      events: ["document.sent"],
    });

    await emitWebhookEvent(
      env,
      {
        organizationId: orgId,
        eventType: "document.sent",
        payload: { documentId: crypto.randomUUID() },
      },
      {
        fetchImpl: async () => new Response("nope", { status: 500 }),
      }
    );

    // Exhaust attempts quickly
    const [failed] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, orgId));
    expect(failed?.status).toBe("pending");
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        attemptCount: 10,
        maxAttempts: 10,
      })
      .where(eq(webhookDeliveries.id, failed!.id));

    const retried = await retryWebhookDelivery(env, {
      organizationId: orgId,
      deliveryId: failed!.id,
      fetchImpl: async () => new Response("ok", { status: 200 }),
    });
    expect(retried.ok).toBe(true);

    const [after] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, failed!.id));
    expect(after?.status).toBe("delivered");
  });

  it("delivers with a valid HMAC signature", async () => {
    const url = "https://example.com/hook";
    const secret = "test-secret";
    const payload = JSON.stringify({ eventType: "document.sent" });

    const delivered = await deliverToWebhook(
      url,
      secret,
      "document.sent",
      payload,
      crypto.randomUUID(),
      async (_url, init) => {
        const headers = init?.headers as Record<string, string>;
        const signature = headers?.["X-Seal-Signature"];
        expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
        return new Response("ok", { status: 200 });
      }
    );

    expect(delivered.success).toBe(true);
    expect(delivered.status).toBe(200);
  });
});
