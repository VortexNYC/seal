import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  documents as documentsTable,
  organization,
  usageEvents,
} from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import {
  currentUsagePeriod,
  recordUsageEvent,
} from "../../platform/usage-events.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

const recordUsageBodySchema = z.object({
  event_type: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  period: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "usage:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const routeSlug = c.req.param("organizationSlug");
  if (mcp.organizationSlug && mcp.organizationSlug !== routeSlug) {
    return c.json({ error: "organization_mismatch" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const period = c.req.query("period") ?? currentUsagePeriod();
  const db = createD1(c.env.D1);

  const [orgRow] = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const { getPlanFromMetadata, planLimits } =
    await import("../../platform/plans.js");
  const plan = getPlanFromMetadata(orgRow?.metadata ?? null);
  const limits = planLimits[plan] ?? planLimits.free;

  const docs = await db
    .select({
      status: documentsTable.status,
      size: documentsTable.size,
      createdAt: documentsTable.createdAt,
    })
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.organizationId, organizationId),
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

  const totalSent =
    workflowCounts.sent + workflowCounts.in_progress + workflowCounts.completed;

  const eventRows = await db
    .select({
      eventType: usageEvents.eventType,
      quantity: sql<number>`sum(${usageEvents.quantity})`.mapWith(Number),
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.organizationId, organizationId),
        eq(usageEvents.period, period)
      )
    )
    .groupBy(usageEvents.eventType);

  const metrics: Record<string, number> = {};
  for (const row of eventRows) {
    metrics[row.eventType] = row.quantity ?? 0;
  }

  return c.json({
    period,
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
    metrics,
  });
});

app.post("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "usage:write") && !mcpHasScope(mcp, "admin")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const routeSlug = c.req.param("organizationSlug");
  if (mcp.organizationSlug && mcp.organizationSlug !== routeSlug) {
    return c.json({ error: "organization_mismatch" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = recordUsageBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const db = createD1(c.env.D1);
  const period = parsed.data.period ?? currentUsagePeriod();
  await recordUsageEvent(db, {
    organizationId,
    eventType: parsed.data.event_type,
    quantity: parsed.data.quantity,
    period,
    metadata: parsed.data.metadata,
  });

  return c.json({ success: true, period }, 201);
});

export default app;
