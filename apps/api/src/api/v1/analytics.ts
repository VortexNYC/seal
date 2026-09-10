import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { documents } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

const analyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

type AnalyticsResponse = {
  period: { from: string; to: string };
  documents: {
    total_created: number;
    total_sent: number;
    total_completed: number;
    total_cancelled: number;
    total_declined: number;
    completion_rate: number;
    median_signing_hours: number | null;
  };
  workspace_snapshot: {
    draft: number;
    sent: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    declined: number;
  };
};

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "analytics:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const query = c.req.query();
  const parsed = analyticsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const now = new Date();
  const fromDate = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const toDate = parsed.data.to ? new Date(parsed.data.to) : now;

  const db = createD1(c.env.D1);

  const periodDocs = await db
    .select({ status: documents.status, createdAt: documents.createdAt })
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted"),
        gte(documents.createdAt, fromDate),
        lt(documents.createdAt, toDate)
      )
    );

  const totalCreated = periodDocs.length;
  const totalSent = periodDocs.filter((d) => d.status === "sent").length;
  const totalCompleted = periodDocs.filter(
    (d) => d.status === "completed"
  ).length;
  const totalCancelled = periodDocs.filter((d) => d.status === "voided").length;
  const totalDeclined = periodDocs.filter(
    (d) => d.status === "declined"
  ).length;

  const completionRate =
    totalCreated > 0
      ? Math.round((totalCompleted / totalCreated) * 1000) / 1000
      : 0;

  const snapshotRows = await db
    .select({ status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    );

  const snapshot = {
    draft: 0,
    sent: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    declined: 0,
  };
  for (const row of snapshotRows) {
    const status = row.status ?? "draft";
    if (status === "draft") snapshot.draft++;
    else if (status === "sent") snapshot.sent++;
    else if (status === "in_progress") snapshot.in_progress++;
    else if (status === "completed") snapshot.completed++;
    else if (status === "voided") snapshot.cancelled++;
    else if (status === "declined") snapshot.declined++;
  }

  const response: AnalyticsResponse = {
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    documents: {
      total_created: totalCreated,
      total_sent: totalSent,
      total_completed: totalCompleted,
      total_cancelled: totalCancelled,
      total_declined: totalDeclined,
      completion_rate: completionRate,
      median_signing_hours: null,
    },
    workspace_snapshot: snapshot,
  };

  return c.json(response);
});

export default app;
