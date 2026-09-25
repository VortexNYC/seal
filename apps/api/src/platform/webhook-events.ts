import { and, eq, inArray, isNull, lte, lt, or, sql } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { webhookDeliveries, webhooks } from "../global/schema.js";

const MAX_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_RETRY_DELAY_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 10;
const LOCK_TIMEOUT_MS = 60_000;

export interface WebhookEventPayload {
  [key: string]: unknown;
}

export interface EmitWebhookEventInput {
  organizationId: string;
  eventType: string;
  payload: WebhookEventPayload;
}

export interface EmitWebhookEventOptions {
  /**
   * Attempt delivery in-process after enqueue (SEA-64).
   * Default true so hooks are near-realtime; tests may disable.
   */
  flushImmediately?: boolean;
  fetchImpl?: typeof fetch;
}

export interface EmitWebhookEventResult {
  eventId: string;
  deliveryCount: number;
}

function parseEvents(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((e) => typeof e === "string")) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function emitWebhookEvent(
  env: CloudflareBindings,
  input: EmitWebhookEventInput,
  options: EmitWebhookEventOptions = {}
): Promise<EmitWebhookEventResult> {
  const db = createD1(env.D1);
  const eventId = crypto.randomUUID();
  const now = new Date();
  const payload = JSON.stringify({
    eventId,
    eventType: input.eventType,
    timestamp: now.toISOString(),
    data: input.payload,
  });

  const hookRows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      secret: webhooks.secret,
      events: webhooks.events,
    })
    .from(webhooks)
    .where(eq(webhooks.organizationId, input.organizationId));

  const values = hookRows
    .filter((hook) => {
      const subscribed = parseEvents(hook.events);
      return subscribed.includes(input.eventType) || subscribed.includes("*");
    })
    .map((hook) => ({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      webhookId: hook.id,
      eventId,
      eventType: input.eventType,
      payload,
      status: "pending" as const,
      attemptCount: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextRetryAt: now,
      createdAt: now,
    }));

  if (values.length > 0) {
    await db
      .insert(webhookDeliveries)
      .values(values)
      .onConflictDoNothing({
        target: [webhookDeliveries.webhookId, webhookDeliveries.eventId],
      });

    // SEA-64: first attempt immediately — do not wait for the daily cron.
    if (options.flushImmediately !== false) {
      try {
        await processWebhookDeliveries(env, {
          organizationId: input.organizationId,
          limit: Math.max(values.length, 50),
          fetchImpl: options.fetchImpl,
        });
      } catch (err) {
        console.error("[webhooks] immediate flush failed:", err);
      }
    }
  }

  return { eventId, deliveryCount: values.length };
}

export async function deliverToWebhook(
  url: string,
  secret: string,
  eventType: string,
  payload: string,
  deliveryId: string,
  fetchImpl = fetch
): Promise<{
  success: boolean;
  status: number | null;
  body: string | null;
  error: string | null;
}> {
  let response: Response | undefined;
  try {
    const signature = await hmacSha256(secret, payload);
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Seal-Event": eventType,
        "X-Seal-Delivery-Id": deliveryId,
        "X-Seal-Signature": `sha256=${signature}`,
        "User-Agent": "Seal-Webhook/1.0",
      },
      body: payload,
    });

    const body = await response.text();
    return {
      success: response.ok,
      status: response.status,
      body,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: response?.status ?? null,
      body: null,
      error: message,
    };
  }
}

export interface ProcessWebhookDeliveriesResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export async function processWebhookDeliveries(
  env: CloudflareBindings,
  {
    organizationId,
    limit = 100,
    fetchImpl = fetch,
  }: { organizationId?: string; limit?: number; fetchImpl?: typeof fetch } = {}
): Promise<ProcessWebhookDeliveriesResult> {
  const db = createD1(env.D1);
  const now = new Date();
  const lockCutoff = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  const conditions = [
    eq(webhookDeliveries.status, "pending"),
    eq(webhookDeliveries.organizationId, webhooks.organizationId),
    lte(webhookDeliveries.nextRetryAt, now),
    or(
      isNull(webhookDeliveries.lockedAt),
      lt(webhookDeliveries.lockedAt, lockCutoff)
    ),
    lt(webhookDeliveries.attemptCount, webhookDeliveries.maxAttempts),
  ];

  if (organizationId) {
    conditions.push(eq(webhookDeliveries.organizationId, organizationId));
  }

  const pending = await db
    .select({
      delivery: {
        id: webhookDeliveries.id,
        webhookId: webhookDeliveries.webhookId,
        eventType: webhookDeliveries.eventType,
        payload: webhookDeliveries.payload,
        attemptCount: webhookDeliveries.attemptCount,
        maxAttempts: webhookDeliveries.maxAttempts,
        lockedAt: webhookDeliveries.lockedAt,
        status: webhookDeliveries.status,
      },
      webhook: {
        url: webhooks.url,
        secret: webhooks.secret,
        status: webhooks.status,
      },
    })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
    .where(and(...conditions))
    .limit(limit);

  const selectedIds = pending.map((row) => row.delivery.id);
  if (selectedIds.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Lock the selected rows in a single update to prevent concurrent sweepers.
  const locked = await db
    .update(webhookDeliveries)
    .set({ lockedAt: now })
    .where(
      and(
        inArray(webhookDeliveries.id, selectedIds),
        or(
          isNull(webhookDeliveries.lockedAt),
          lt(webhookDeliveries.lockedAt, lockCutoff)
        ),
        eq(webhookDeliveries.status, "pending")
      )
    )
    .returning({ id: webhookDeliveries.id });

  const lockedIds = new Set(locked.map((r) => r.id));
  const toProcess = pending.filter((row) => lockedIds.has(row.delivery.id));

  let succeeded = 0;
  let failed = 0;

  for (const row of toProcess) {
    const delivery = row.delivery;
    const webhook = row.webhook;
    const attemptCount = delivery.attemptCount + 1;

    if (webhook.status !== "active") {
      await db
        .update(webhookDeliveries)
        .set({
          status: "failed",
          attemptCount,
          lastError: "webhook is not active",
          responseStatus: null,
          responseBody: null,
          lockedAt: null,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      await db
        .update(webhooks)
        .set({
          totalDeliveries: sql`${webhooks.totalDeliveries} + 1`,
          failedDeliveries: sql`${webhooks.failedDeliveries} + 1`,
        })
        .where(eq(webhooks.id, delivery.webhookId));

      failed++;
      continue;
    }

    const result = await deliverToWebhook(
      webhook.url,
      webhook.secret,
      delivery.eventType,
      delivery.payload,
      delivery.id,
      fetchImpl
    );

    if (result.success) {
      await db
        .update(webhookDeliveries)
        .set({
          status: "delivered",
          attemptCount,
          responseStatus: result.status,
          responseBody: result.body,
          deliveredAt: now,
          lastError: null,
          lockedAt: null,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      await db
        .update(webhooks)
        .set({
          totalDeliveries: sql`${webhooks.totalDeliveries} + 1`,
          successfulDeliveries: sql`${webhooks.successfulDeliveries} + 1`,
          lastDeliveryAt: now,
        })
        .where(eq(webhooks.id, delivery.webhookId));

      succeeded++;
    } else {
      const exhausted = attemptCount >= delivery.maxAttempts;
      const delay = Math.min(
        INITIAL_RETRY_DELAY_MS * Math.pow(2, attemptCount - 1),
        MAX_RETRY_DELAY_MS
      );
      const nextRetryAt = exhausted ? now : new Date(now.getTime() + delay);

      await db
        .update(webhookDeliveries)
        .set({
          status: exhausted ? "failed" : "pending",
          attemptCount,
          responseStatus: result.status,
          responseBody: result.body,
          lastError: result.error,
          nextRetryAt,
          lockedAt: null,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      await db
        .update(webhooks)
        .set({
          totalDeliveries: sql`${webhooks.totalDeliveries} + 1`,
          failedDeliveries: sql`${webhooks.failedDeliveries} + 1`,
        })
        .where(eq(webhooks.id, delivery.webhookId));

      failed++;
    }
  }

  return { processed: toProcess.length, succeeded, failed };
}

export type RetryWebhookDeliveryResult =
  | { ok: true; deliveryId: string }
  | { ok: false; error: "not_found" | "not_failed" | "webhook_inactive" };

/**
 * Re-queue a failed (or exhausted) delivery for another attempt budget (SEA-64).
 */
export async function retryWebhookDelivery(
  env: CloudflareBindings,
  params: {
    organizationId: string;
    deliveryId: string;
    fetchImpl?: typeof fetch;
  }
): Promise<RetryWebhookDeliveryResult> {
  const db = createD1(env.D1);
  const now = new Date();

  const rows = await db
    .select({
      id: webhookDeliveries.id,
      status: webhookDeliveries.status,
      webhookId: webhookDeliveries.webhookId,
      webhookStatus: webhooks.status,
    })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
    .where(
      and(
        eq(webhookDeliveries.id, params.deliveryId),
        eq(webhookDeliveries.organizationId, params.organizationId)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "not_found" };
  }
  if (row.status !== "failed") {
    return { ok: false, error: "not_failed" };
  }
  if (row.webhookStatus !== "active") {
    return { ok: false, error: "webhook_inactive" };
  }

  await db
    .update(webhookDeliveries)
    .set({
      status: "pending",
      attemptCount: 0,
      nextRetryAt: now,
      lockedAt: null,
      lastError: null,
      responseStatus: null,
      responseBody: null,
      deliveredAt: null,
    })
    .where(eq(webhookDeliveries.id, row.id));

  await processWebhookDeliveries(env, {
    organizationId: params.organizationId,
    limit: 10,
    fetchImpl: params.fetchImpl,
  });

  return { ok: true, deliveryId: row.id };
}
