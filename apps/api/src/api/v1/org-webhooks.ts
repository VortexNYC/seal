/**
 * Session-auth webhook management for the SPA settings UI.
 * Mounted at /api/v1/organizations/:organizationSlug/webhooks
 * (outside MCP Bearer middleware — same pattern as tokens).
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { webhooks } from "../../global/schema.js";
import {
  apiTokenAuth,
  parseApiTokenScopes,
} from "../../platform/api-token-auth.js";
import { getAuditActor, writeAuditLog } from "../../platform/audit-log.js";
import { organizationMiddleware } from "../../platform/organization-middleware.js";
import type { Variables } from "../../platform/types.js";

const WEBHOOK_STATUSES = ["active", "paused", "disabled"] as const;

const WEBHOOK_EVENT_TYPES = [
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
    type: "recipient.signed",
    category: "recipient",
    description: "A recipient signed the document",
  },
  {
    type: "recipient.declined",
    category: "recipient",
    description: "A recipient declined the document",
  },
  {
    type: "audit.entry.created",
    category: "audit",
    description: "A sealed audit log entry was written",
  },
] as const;

const createWebhookSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  description: z.string().max(500).optional(),
});

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use("/*", apiTokenAuth);
app.use("/*", organizationMiddleware);

function canAdminister(c: {
  get: <K extends keyof Variables>(key: K) => Variables[K];
}): boolean {
  const membership = c.get("membership");
  const roleOk =
    membership?.role === "admin" || membership?.role === "owner";
  if (!roleOk) {
    return false;
  }
  const apiToken = c.get("apiToken");
  if (apiToken) {
    return parseApiTokenScopes(apiToken.scopes).includes("admin");
  }
  return true;
}

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

app.get("/event-types", (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }
  return c.json(WEBHOOK_EVENT_TYPES);
});

app.get("/", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organization = c.get("organization");
  if (!organization) {
    return c.json({ error: "unauthorized" }, 401);
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
    .where(eq(webhooks.organizationId, organization.id))
    .orderBy(webhooks.createdAt);

  return c.json(
    rows.map((row) => {
      const total = row.totalDeliveries;
      const successRate = total > 0 ? row.successfulDeliveries / total : 0;
      return {
        id: row.id,
        name: row.name,
        url: row.url,
        status: row.status,
        events: parseEvents(row.events),
        description: row.description ?? undefined,
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
    })
  );
});

app.post("/", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organization = c.get("organization");
  const user = c.get("user");
  if (!organization || !user) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const rawBody: unknown = await c.req.json().catch(() => null);
  const parsed = createWebhookSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { name, url, events, description } = parsed.data;
  const allowed: ReadonlySet<string> = new Set(
    WEBHOOK_EVENT_TYPES.map((e) => e.type)
  );
  if (!events.every((event) => allowed.has(event))) {
    return c.json({ error: "invalid_events" }, 400);
  }

  const db = createD1(c.env.D1);
  const webhookId = crypto.randomUUID();
  const secret = generateSecret();

  await db.insert(webhooks).values({
    id: webhookId,
    publicId: crypto.randomUUID(),
    organizationId: organization.id,
    name,
    url,
    events: JSON.stringify(events),
    description: description ?? null,
    secret,
    status: "active" satisfies (typeof WEBHOOK_STATUSES)[number],
  });

  const actor = getAuditActor({
    apiToken: c.get("apiToken"),
    mcp: c.get("mcp"),
    user: c.get("user"),
  });
  if (actor) {
    await writeAuditLog(db, {
      organizationId: organization.id,
      actor,
      action: "webhook.create",
      resourceType: "webhook",
      resourceId: webhookId,
      metadata: { name, url, events },
      ipAddress:
        c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
      userAgent: c.req.header("user-agent"),
    });
  }

  return c.json({ id: webhookId, secret }, 201);
});

app.delete("/:webhookId", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organization = c.get("organization");
  if (!organization) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const webhookId = c.req.param("webhookId");
  const db = createD1(c.env.D1);

  const deleted = await db
    .delete(webhooks)
    .where(
      and(
        eq(webhooks.id, webhookId),
        eq(webhooks.organizationId, organization.id)
      )
    )
    .returning({ id: webhooks.id });

  if (!deleted[0]) {
    return c.json({ error: "not_found" }, 404);
  }

  const actor = getAuditActor({
    apiToken: c.get("apiToken"),
    mcp: c.get("mcp"),
    user: c.get("user"),
  });
  if (actor) {
    await writeAuditLog(db, {
      organizationId: organization.id,
      actor,
      action: "webhook.delete",
      resourceType: "webhook",
      resourceId: webhookId,
      metadata: {},
      ipAddress:
        c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
      userAgent: c.req.header("user-agent"),
    });
  }

  return c.json({ deleted: true });
});

export default app;
