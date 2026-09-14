import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, ne, or } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  connectedApps,
  documents as documentsTable,
  integrationActivityLogs,
  organization as organizationTable,
  subscriptions,
  user,
} from "../global/schema.js";
import { organizationMiddleware } from "../platform/organization-middleware.js";
import {
  getPlanFromMetadata,
  planLimits,
  type Plan,
} from "../platform/plans.js";
import type { Variables } from "../platform/types.js";

const emailPreferencesSchema = z.object({
  enabled: z.boolean().default(true),
  documentEvents: z.boolean().default(true),
  reminders: z.boolean().default(true),
  weeklyDigest: z.boolean().default(false),
});

const notificationPreferencesSchema = z.object({
  email: emailPreferencesSchema.default({
    enabled: true,
    documentEvents: true,
    reminders: true,
    weeklyDigest: false,
  }),
  inApp: z.boolean().default(true),
  desktop: z.boolean().default(false),
  frequency: z.enum(["instant", "daily", "weekly"]).default("instant"),
});

const patchNotificationPreferencesSchema = z.object({
  email: emailPreferencesSchema.partial().optional(),
  inApp: z.boolean().optional(),
  desktop: z.boolean().optional(),
  frequency: z.enum(["instant", "daily", "weekly"]).optional(),
});

const metadataJsonSchema = z.record(z.string(), z.unknown());

function safeParseMetadata(
  value: string | null
): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    const result = metadataJsonSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function serializeMetadata(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use("/*", async (c, next) => {
  const sessionUser = c.get("user");
  if (!sessionUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.use("/:slug/*", organizationMiddleware);

const getRouteDef = createRoute({
  method: "get",
  path: "/me/notification-preferences",
  responses: {
    200: {
      content: {
        "application/json": { schema: notificationPreferencesSchema },
      },
      description: "Notification preferences",
    },
    401: { description: "Unauthorized" },
  },
});

app.openapi(getRouteDef, async (c) => {
  const db = createD1(c.env.D1);

  const rows = await db
    .select({ metadata: user.metadata })
    .from(user)
    .where(eq(user.id, c.get("user")!.user.id))
    .limit(1);

  const metadata = safeParseMetadata(rows[0]?.metadata ?? null) ?? {};
  const raw = metadata.notificationPreferences;

  const parsed = notificationPreferencesSchema.safeParse(raw);
  return c.json(
    parsed.success ? parsed.data : notificationPreferencesSchema.parse({})
  );
});

const patchRouteDef = createRoute({
  method: "patch",
  path: "/me/notification-preferences",
  request: {
    body: {
      content: {
        "application/json": { schema: patchNotificationPreferencesSchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: notificationPreferencesSchema },
      },
      description: "Notification preferences updated",
    },
    401: { description: "Unauthorized" },
  },
});

app.openapi(patchRouteDef, async (c) => {
  const body = c.req.valid("json");
  const db = createD1(c.env.D1);

  const rows = await db
    .select({ metadata: user.metadata })
    .from(user)
    .where(eq(user.id, c.get("user")!.user.id))
    .limit(1);

  const metadata = safeParseMetadata(rows[0]?.metadata ?? null) ?? {};
  const current = notificationPreferencesSchema.parse(
    metadata.notificationPreferences ?? {}
  );

  const next = {
    email: body.email ? { ...current.email, ...body.email } : current.email,
    inApp: body.inApp ?? current.inApp,
    desktop: body.desktop ?? current.desktop,
    frequency: body.frequency ?? current.frequency,
  };

  metadata.notificationPreferences = next;

  await db
    .update(user)
    .set({
      metadata: serializeMetadata(metadata),
      updatedAt: new Date(),
    })
    .where(eq(user.id, c.get("user")!.user.id));

  return c.json(notificationPreferencesSchema.parse(next));
});

const usageResponseSchema = z.object({
  totalDocuments: z.number().int(),
  workflowCounts: z.object({
    draft: z.number().int(),
    sent: z.number().int(),
    in_progress: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
    declined: z.number().int(),
  }),
  documentsThisMonth: z.number().int(),
  sentThisMonth: z.number().int(),
  completedThisMonth: z.number().int(),
  storageUsedBytes: z.number().int(),
  storageLimitBytes: z.number().int(),
  storagePercentUsed: z.number(),
  plan: z.string(),
  documentsLimit: z.number().int(),
  documentsPercentUsed: z.number(),
  completionRate: z.number().int(),
});

const usageRouteDef = createRoute({
  method: "get",
  path: "/{slug}/me/usage",
  responses: {
    200: {
      content: { "application/json": { schema: usageResponseSchema } },
      description: "User usage statistics",
    },
    401: { description: "Unauthorized" },
  },
});

app.openapi(usageRouteDef, async (c) => {
  const db = createD1(c.env.D1);

  const userId = c.get("user")!.user.id;
  const organizationId = c.get("organization").id;

  const docs = await db
    .select({
      status: documentsTable.status,
      size: documentsTable.size,
      createdAt: documentsTable.createdAt,
    })
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.ownerId, userId),
        ne(documentsTable.documentStatus, "deleted")
      )
    );

  const workflowCounts = {
    draft: 0,
    sent: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    declined: 0,
  };

  let totalStorageBytes = 0;

  for (const doc of docs) {
    const size = doc.size ?? 0;
    totalStorageBytes += size;

    switch (doc.status) {
      case "draft":
      case "sent":
      case "completed":
      case "cancelled":
      case "declined":
        workflowCounts[doc.status]++;
        break;
      case "active":
      case "in_progress":
        workflowCounts.in_progress++;
        break;
      default:
        break;
    }
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const documentsThisMonth = docs.filter(
    (doc) => doc.createdAt.getTime() >= startOfMonth
  );

  const completedThisMonth = documentsThisMonth.filter(
    (doc) => doc.status === "completed"
  );
  const sentThisMonth = documentsThisMonth.filter(
    (doc) =>
      doc.status === "sent" ||
      doc.status === "active" ||
      doc.status === "in_progress" ||
      doc.status === "completed"
  );

  let plan: Plan = "free";
  if (organizationId) {
    const orgRows = await db
      .select({ metadata: organizationTable.metadata })
      .from(organizationTable)
      .where(eq(organizationTable.id, organizationId))
      .limit(1);
    plan = getPlanFromMetadata(orgRows[0]?.metadata ?? null);
  }

  const limits = planLimits[plan] ?? planLimits.free;

  const totalSent =
    workflowCounts.sent + workflowCounts.in_progress + workflowCounts.completed;

  return c.json({
    totalDocuments: docs.length,
    workflowCounts,
    documentsThisMonth: documentsThisMonth.length,
    sentThisMonth: sentThisMonth.length,
    completedThisMonth: completedThisMonth.length,
    storageUsedBytes: totalStorageBytes,
    storageLimitBytes: limits.storageBytes,
    storagePercentUsed: Math.min(
      100,
      (totalStorageBytes / limits.storageBytes) * 100
    ),
    plan,
    documentsLimit: limits.documentsPerMonth,
    documentsPercentUsed: Math.min(
      100,
      (documentsThisMonth.length / limits.documentsPerMonth) * 100
    ),
    completionRate:
      totalSent > 0
        ? Math.round((completedThisMonth.length / totalSent) * 100)
        : 0,
  });
});

const connectedAppScopeSchema = z.array(z.string());

const connectedAppSchema = z.object({
  id: z.string(),
  appName: z.string(),
  active: z.boolean(),
  connectedAt: z.number(),
  lastActivityAt: z.number().nullable(),
  scopes: connectedAppScopeSchema,
});

const integrationActivityLogSchema = z.object({
  id: z.string(),
  type: z.string(),
  integrationName: z.string(),
  action: z.string(),
  details: z.string().nullable(),
  createdAt: z.number(),
});

const connectedAppsRouteDef = createRoute({
  method: "get",
  path: "/me/connected-apps",
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(connectedAppSchema) },
      },
      description: "List connected apps",
    },
    401: { description: "Unauthorized" },
  },
});

app.openapi(connectedAppsRouteDef, async (c) => {
  const db = createD1(c.env.D1);

  const rows = await db
    .select({
      id: connectedApps.id,
      appName: connectedApps.appName,
      active: connectedApps.active,
      connectedAt: connectedApps.connectedAt,
      lastActivityAt: connectedApps.lastActivityAt,
      scopes: connectedApps.scopes,
    })
    .from(connectedApps)
    .where(eq(connectedApps.userId, c.get("user")!.user.id))
    .orderBy(connectedApps.connectedAt);

  return c.json(
    rows.map((row) => ({
      id: row.id,
      appName: row.appName,
      active: row.active,
      connectedAt: row.connectedAt.getTime(),
      lastActivityAt: row.lastActivityAt?.getTime() ?? null,
      scopes: safeParseStringArray(row.scopes),
    }))
  );
});

function safeParseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    const result = connectedAppScopeSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

const integrationActivityRouteDef = createRoute({
  method: "get",
  path: "/me/integration-activity",
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(integrationActivityLogSchema) },
      },
      description: "List integration activity",
    },
    401: { description: "Unauthorized" },
  },
});

app.openapi(integrationActivityRouteDef, async (c) => {
  const db = createD1(c.env.D1);

  const rows = await db
    .select({
      id: integrationActivityLogs.id,
      type: integrationActivityLogs.type,
      integrationName: integrationActivityLogs.integrationName,
      action: integrationActivityLogs.action,
      details: integrationActivityLogs.details,
      createdAt: integrationActivityLogs.createdAt,
    })
    .from(integrationActivityLogs)
    .where(eq(integrationActivityLogs.userId, c.get("user")!.user.id))
    .orderBy(integrationActivityLogs.createdAt);

  return c.json(
    rows.map((row) => ({
      id: row.id,
      type: row.type,
      integrationName: row.integrationName,
      action: row.action,
      details: row.details,
      createdAt: row.createdAt.getTime(),
    }))
  );
});

const disconnectConnectedAppRouteDef = createRoute({
  method: "delete",
  path: "/me/connected-apps/:id",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: { description: "Connected app removed" },
    401: { description: "Unauthorized" },
    404: { description: "Not found" },
  },
});

app.openapi(disconnectConnectedAppRouteDef, async (c) => {
  const { id } = c.req.valid("param");
  const db = createD1(c.env.D1);

  const existing = await db
    .select({ id: connectedApps.id })
    .from(connectedApps)
    .where(
      and(
        eq(connectedApps.id, id),
        eq(connectedApps.userId, c.get("user")!.user.id)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  await db.delete(connectedApps).where(eq(connectedApps.id, existing[0].id));

  return c.body(null, 204);
});

const subscriptionResponseSchema = z.object({
  plan: z.string(),
});

const subscriptionRouteDef = createRoute({
  method: "get",
  path: "/{slug}/me/subscription",
  responses: {
    200: {
      content: { "application/json": { schema: subscriptionResponseSchema } },
      description: "Current subscription plan",
    },
    401: { description: "Unauthorized" },
  },
});

app.openapi(subscriptionRouteDef, async (c) => {
  const db = createD1(c.env.D1);

  const organizationId = c.get("organization").id;
  let plan: Plan = "free";

  if (organizationId) {
    const now = Date.now();
    const recent = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          or(
            eq(subscriptions.status, "active"),
            eq(subscriptions.status, "trialing"),
            eq(subscriptions.status, "past_due")
          )
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(20);

    const paid =
      recent.find((s) => s.status === "active" || s.status === "trialing") ??
      recent.find((s) => {
        if (s.status !== "past_due") return false;
        const since = (s.pastDueSince ?? s.createdAt).getTime();
        return now - since <= 14 * 24 * 60 * 60 * 1000;
      });

    const metadataSchema = z.object({ tier: z.string().optional() });
    let tier: string | undefined;
    if (paid?.metadata != null) {
      try {
        const parsed = metadataSchema.safeParse(JSON.parse(paid.metadata));
        if (parsed.success) {
          tier = parsed.data.tier;
        }
      } catch {
        // ignore malformed metadata
      }
    }

    plan =
      tier === "enterprise" ? "enterprise" : tier === "pro" ? "pro" : "free";
  }

  return c.json({ plan });
});

export default app;
