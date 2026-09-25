import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { webhookDeliveries, webhooks } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import { retryWebhookDelivery } from "../../platform/webhook-events.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

const WEBHOOK_STATUSES = ["active", "paused", "disabled"] as const;

type ApiWebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  status: string;
  events: string[];
  description?: string;
  secret_prefix: string;
  created_at: string;
  updated_at: string;
  stats: {
    total_deliveries: number;
    successful: number;
    failed: number;
    success_rate: number;
  };
};

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function secretPrefix(secret: string): string {
  return `${secret.slice(0, 8)}***`;
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

function toApiWebhook(row: {
  id: string;
  name: string;
  url: string;
  status: string;
  events: string | null;
  description: string | null;
  secret: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  createdAt: Date;
  updatedAt: Date;
}): ApiWebhookEndpoint {
  const total = row.totalDeliveries;
  const successRate = total > 0 ? row.successfulDeliveries / total : 0;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    status: row.status,
    events: parseEvents(row.events),
    ...(row.description ? { description: row.description } : {}),
    secret_prefix: secretPrefix(row.secret),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    stats: {
      total_deliveries: total,
      successful: row.successfulDeliveries,
      failed: row.failedDeliveries,
      success_rate: Math.round(successRate * 1000) / 1000,
    },
  };
}

const createWebhookSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  events: z.array(z.string()),
  description: z.string().optional(),
});

const updateWebhookSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  description: z.string().optional(),
  status: z.enum(WEBHOOK_STATUSES).optional(),
});

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "webhooks:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: webhooks.id,
      name: webhooks.name,
      url: webhooks.url,
      status: webhooks.status,
      events: webhooks.events,
      description: webhooks.description,
      secret: webhooks.secret,
      totalDeliveries: webhooks.totalDeliveries,
      successfulDeliveries: webhooks.successfulDeliveries,
      failedDeliveries: webhooks.failedDeliveries,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    })
    .from(webhooks)
    .where(eq(webhooks.organizationId, organizationId))
    .orderBy(webhooks.createdAt);

  return c.json(rows.map(toApiWebhook));
});

app.get("/get", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "webhooks:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_webhook_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: webhooks.id,
      name: webhooks.name,
      url: webhooks.url,
      status: webhooks.status,
      events: webhooks.events,
      description: webhooks.description,
      secret: webhooks.secret,
      totalDeliveries: webhooks.totalDeliveries,
      successfulDeliveries: webhooks.successfulDeliveries,
      failedDeliveries: webhooks.failedDeliveries,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    })
    .from(webhooks)
    .where(
      and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(toApiWebhook(row));
});

app.post("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "webhooks:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = createWebhookSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { name, url, events, description } = parsed.data;
  const db = createD1(c.env.D1);
  const webhookId = crypto.randomUUID();
  const secret = generateSecret();

  await db.insert(webhooks).values({
    id: webhookId,
    publicId: crypto.randomUUID(),
    organizationId,
    name,
    url,
    events: JSON.stringify(events),
    description,
    secret,
    status: "active",
  });

  return c.json({ id: webhookId, secret });
});

app.put("/update", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "webhooks:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  const rawBody: unknown = await c.req.json();
  const parsed = updateWebhookSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const webhookId = id ?? parsed.data.id;
  if (!webhookId) {
    return c.json({ error: "missing_webhook_id" }, 400);
  }

  const updateValues: {
    name?: string;
    url?: string;
    events?: string;
    description?: string | null;
    status?: string;
  } = {};
  if (parsed.data.name !== undefined) updateValues.name = parsed.data.name;
  if (parsed.data.url !== undefined) updateValues.url = parsed.data.url;
  if (parsed.data.events !== undefined) {
    updateValues.events = JSON.stringify(parsed.data.events);
  }
  if (parsed.data.description !== undefined) {
    updateValues.description = parsed.data.description ?? null;
  }
  if (parsed.data.status !== undefined)
    updateValues.status = parsed.data.status;

  const db = createD1(c.env.D1);
  await db
    .update(webhooks)
    .set(updateValues)
    .where(
      and(
        eq(webhooks.id, webhookId),
        eq(webhooks.organizationId, organizationId)
      )
    );

  return c.json({ success: true });
});

app.delete("/delete", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "webhooks:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_webhook_id" }, 400);
  }

  const db = createD1(c.env.D1);
  await db
    .delete(webhooks)
    .where(
      and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId))
    );

  return c.json({ success: true });
});

app.post("/rotate-secret", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "webhooks:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_webhook_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const newSecret = generateSecret();
  const result = await db
    .update(webhooks)
    .set({ secret: newSecret })
    .where(
      and(eq(webhooks.id, id), eq(webhooks.organizationId, organizationId))
    )
    .returning({ id: webhooks.id });

  if (result.length === 0) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json({ secret: newSecret });
});

app.get("/event-types", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "webhooks:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const eventTypes = [
    {
      type: "document.created",
      category: "document",
      description: "A new document was created",
    },
    {
      type: "document.sent",
      category: "document",
      description: "A document was sent for signing",
    },
    {
      type: "document.viewed",
      category: "document",
      description: "A document was viewed by a recipient",
    },
    {
      type: "document.completed",
      category: "document",
      description: "All recipients have signed the document",
    },
    {
      type: "document.voided",
      category: "document",
      description: "A document was voided",
    },
    {
      type: "document.expired",
      category: "document",
      description: "A document passed its deadline",
    },
    {
      type: "document.declined",
      category: "document",
      description: "A document was declined",
    },
    {
      type: "recipient.added",
      category: "recipient",
      description: "A recipient was added to a document",
    },
    {
      type: "recipient.viewed",
      category: "recipient",
      description: "A recipient viewed the document",
    },
    {
      type: "recipient.signed",
      category: "recipient",
      description: "A recipient signed the document",
    },
    {
      type: "recipient.approved",
      category: "recipient",
      description: "A recipient approved the document",
    },
    {
      type: "recipient.declined",
      category: "recipient",
      description: "A recipient declined the document",
    },
    {
      type: "recipient.reminded",
      category: "recipient",
      description: "A reminder was sent to a recipient",
    },
    {
      type: "template.created",
      category: "template",
      description: "A template was created",
    },
    {
      type: "template.updated",
      category: "template",
      description: "A template was updated",
    },
    {
      type: "template.used",
      category: "template",
      description: "A document was created from a template",
    },
  ];

  return c.json(eventTypes);
});

app.get("/deliveries", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "webhooks:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const status = c.req.query("status");
  const webhookId = c.req.query("webhook_id");
  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") ?? "50", 10), 1),
    100
  );
  const offset = Math.max(parseInt(c.req.query("offset") ?? "0", 10), 0);

  const conditions = [eq(webhookDeliveries.organizationId, organizationId)];
  if (status) conditions.push(eq(webhookDeliveries.status, status));
  if (webhookId) conditions.push(eq(webhookDeliveries.webhookId, webhookId));

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
      eventId: webhookDeliveries.eventId,
      eventType: webhookDeliveries.eventType,
      status: webhookDeliveries.status,
      attemptCount: webhookDeliveries.attemptCount,
      maxAttempts: webhookDeliveries.maxAttempts,
      responseStatus: webhookDeliveries.responseStatus,
      responseBody: webhookDeliveries.responseBody,
      lastError: webhookDeliveries.lastError,
      nextRetryAt: webhookDeliveries.nextRetryAt,
      deliveredAt: webhookDeliveries.deliveredAt,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .where(and(...conditions))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json(
    rows.map((row) => ({
      ...row,
      nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      createdAt: row.createdAt?.toISOString() ?? null,
    }))
  );
});

app.post("/deliveries/:deliveryId/retry", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "webhooks:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const deliveryId = c.req.param("deliveryId");
  if (!deliveryId) {
    return c.json({ error: "missing_delivery_id" }, 400);
  }

  const result = await retryWebhookDelivery(c.env, {
    organizationId,
    deliveryId,
  });

  if (!result.ok) {
    if (result.error === "not_found") {
      return c.json({ error: "not_found" }, 404);
    }
    if (result.error === "not_failed") {
      return c.json({ error: "delivery_not_failed" }, 400);
    }
    return c.json({ error: "webhook_inactive" }, 400);
  }

  return c.json({ success: true, delivery_id: result.deliveryId });
});

export default app;
