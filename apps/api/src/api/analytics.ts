import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, eq, type SQL } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { documents, member } from "../global/schema.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { user: import("../platform/session.js").SessionUser | null };
}>();

app.use("/*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const activeOrganizationId = user.session?.activeOrganizationId;
  if (!activeOrganizationId) {
    return c.json({ error: "No active organization" }, 403);
  }
  return next();
});

const analyticsStatsQuerySchema = z.object({
  scope: z
    .union([z.literal("personal"), z.literal("team")])
    .optional()
    .default("team"),
});

const analyticsStatsResponseSchema = z
  .object({
    total: z.number().int(),
    draft: z.number().int(),
    sent: z.number().int(),
    inProgress: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
    declined: z.number().int(),
    expired: z.number().int(),
    pending: z.number().int(),
    completionRate: z.number().int(),
    avgSigningTimeMs: z.number().int().nullable(),
    isAdmin: z.boolean(),
  })
  .openapi("AnalyticsStats");

const statsRouteDef = createRoute({
  method: "get",
  path: "/stats",
  request: {
    query: analyticsStatsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: analyticsStatsResponseSchema },
      },
      description: "Document statistics for analytics",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(statsRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { scope: requestedScope } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const membership = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);

  const role = membership[0]?.role ?? "member";
  const isAdmin = role === "owner" || role === "admin";
  const scope = isAdmin ? requestedScope : "personal";

  const whereBase = and(
    eq(documents.organizationId, organizationId),
    eq(documents.documentStatus, "active")
  );

  const whereScope =
    scope === "personal" ? and(whereBase, eq(documents.ownerId, userId)) : whereBase;

  const countDocuments = async (...conditions: SQL[]) => {
    const result = await db
      .select({ value: count() })
      .from(documents)
      .where(and(whereScope, ...conditions));
    return result[0]?.value ?? 0;
  };

  const total = await countDocuments();
  const draft = await countDocuments(eq(documents.status, "draft"));
  const sent = await countDocuments(eq(documents.status, "sent"));
  const inProgress = await countDocuments(eq(documents.status, "in_progress"));
  const completed = await countDocuments(eq(documents.status, "completed"));
  const cancelled = await countDocuments(eq(documents.status, "cancelled"));
  const declined = await countDocuments(eq(documents.status, "declined"));
  const expired = await countDocuments(eq(documents.status, "expired"));

  const pending = sent + inProgress;
  const finishedDocs = completed + cancelled + declined;
  const completionRate =
    finishedDocs > 0 ? Math.round((completed / finishedDocs) * 100) : 0;

  const completedDocs = await db
    .select({ sentAt: documents.sentAt, updatedAt: documents.updatedAt })
    .from(documents)
    .where(and(whereScope, eq(documents.status, "completed")));

  let avgSigningTimeMs: number | null = null;
  let totalMs = 0;
  let completedCount = 0;
  for (const doc of completedDocs) {
    if (doc.sentAt && doc.updatedAt) {
      totalMs += doc.updatedAt.getTime() - doc.sentAt.getTime();
      completedCount++;
    }
  }
  if (completedCount > 0) {
    avgSigningTimeMs = Math.round(totalMs / completedCount);
  }

  return c.json({
    total,
    draft,
    sent,
    inProgress,
    completed,
    cancelled,
    declined,
    expired,
    pending,
    completionRate,
    avgSigningTimeMs,
    isAdmin,
  });
});

export default app;
