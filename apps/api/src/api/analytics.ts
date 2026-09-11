import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, eq, gte, inArray, lt, lte, type SQL } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  documents,
  member,
  notifications,
  recipients,
  templates,
  user,
} from "../global/schema.js";
import type { Variables } from "../platform/types.js";
import { organizationMiddleware } from "../platform/organization-middleware.js";

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
  path: "/{slug}/stats",
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
  const organizationId = c.get("organization").id;
  const userId = c.get("user")!.user.id;
  const { scope: requestedScope } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const membership = await db
    .select()
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId))
    )
    .limit(1);

  const role = membership[0]?.role ?? "member";
  const isAdmin = role === "owner" || role === "admin";
  const scope = isAdmin ? requestedScope : "personal";

  const whereBase = and(
    eq(documents.organizationId, organizationId),
    eq(documents.documentStatus, "active")
  );

  const whereScope =
    scope === "personal"
      ? and(whereBase, eq(documents.ownerId, userId))
      : whereBase;

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

const analyticsTrendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
  startDate: z.coerce.number().int().optional(),
  endDate: z.coerce.number().int().optional(),
  scope: z
    .union([z.literal("personal"), z.literal("team")])
    .optional()
    .default("team"),
});

const analyticsTrendSchema = z
  .object({
    date: z.string(),
    created: z.number().int(),
    completed: z.number().int(),
  })
  .openapi("AnalyticsTrend");

const trendsRouteDef = createRoute({
  method: "get",
  path: "/{slug}/trends",
  request: {
    query: analyticsTrendsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(analyticsTrendSchema) },
      },
      description: "Daily document creation and completion trends",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(trendsRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const userId = c.get("user")!.user.id;
  const {
    days,
    startDate,
    endDate,
    scope: requestedScope,
  } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const membership = await db
    .select()
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId))
    )
    .limit(1);

  const role = membership[0]?.role ?? "member";
  const isAdmin = role === "owner" || role === "admin";
  const scope = isAdmin ? requestedScope : "personal";

  const now = new Date();
  let startMs: number;
  let endMs: number;
  if (startDate !== undefined && endDate !== undefined) {
    startMs = startDate;
    endMs = endDate;
  } else {
    const dayCount = days ?? 30;
    startMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (dayCount - 1)
    );
    endMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  const startDay = new Date(startMs);
  const endDay = new Date(endMs);

  const dayRanges: { day: Date; nextDay: Date }[] = [];
  const current = new Date(
    Date.UTC(
      startDay.getUTCFullYear(),
      startDay.getUTCMonth(),
      startDay.getUTCDate()
    )
  );
  while (current.getTime() <= endDay.getTime()) {
    const next = new Date(
      Date.UTC(
        current.getUTCFullYear(),
        current.getUTCMonth(),
        current.getUTCDate() + 1
      )
    );
    dayRanges.push({ day: new Date(current), nextDay: next });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const countForDay = async (
    day: Date,
    nextDay: Date,
    status: string | null
  ) => {
    const conditions: SQL[] = [
      eq(documents.organizationId, organizationId),
      eq(documents.documentStatus, "active"),
      gte(status ? documents.updatedAt : documents.createdAt, day),
      lt(status ? documents.updatedAt : documents.createdAt, nextDay),
    ];
    if (status) {
      conditions.push(eq(documents.status, status));
    }
    if (scope === "personal") {
      conditions.push(eq(documents.ownerId, userId));
    }

    const result = await db
      .select({ value: count() })
      .from(documents)
      .where(and(...conditions));
    return result[0]?.value ?? 0;
  };

  const createdPromises = dayRanges.map(({ day, nextDay }) =>
    countForDay(day, nextDay, null)
  );
  const completedPromises = dayRanges.map(({ day, nextDay }) =>
    countForDay(day, nextDay, "completed")
  );

  const createdRows = await Promise.all(createdPromises);
  const completedRows = await Promise.all(completedPromises);

  const results = dayRanges.map(({ day }, index) => ({
    date: day.toISOString().slice(0, 10),
    created: createdRows[index] ?? 0,
    completed: completedRows[index] ?? 0,
  }));

  return c.json(results);
});

const analyticsPeriodStatsQuerySchema = z.object({
  period: z.union([
    z.literal("today"),
    z.literal("week"),
    z.literal("month"),
    z.literal("year"),
  ]),
  scope: z
    .union([z.literal("personal"), z.literal("team")])
    .optional()
    .default("team"),
});

const analyticsPeriodStatsResponseSchema = z
  .object({
    created: z.number().int(),
    completed: z.number().int(),
    period: z.string(),
  })
  .openapi("AnalyticsPeriodStats");

const periodStatsRouteDef = createRoute({
  method: "get",
  path: "/{slug}/period-stats",
  request: {
    query: analyticsPeriodStatsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: analyticsPeriodStatsResponseSchema },
      },
      description: "Document counts for a period",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(periodStatsRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const userId = c.get("user")!.user.id;
  const { period, scope: requestedScope } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const membership = await db
    .select()
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId))
    )
    .limit(1);

  const role = membership[0]?.role ?? "member";
  const isAdmin = role === "owner" || role === "admin";
  const scope = isAdmin ? requestedScope : "personal";

  const now = Date.now();
  let startMs: number;
  switch (period) {
    case "today":
      startMs = new Date().setHours(0, 0, 0, 0);
      break;
    case "week":
      startMs = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case "month":
      startMs = now - 30 * 24 * 60 * 60 * 1000;
      break;
    case "year":
      startMs = now - 365 * 24 * 60 * 60 * 1000;
      break;
  }

  const baseConditions: SQL[] = [
    eq(documents.organizationId, organizationId),
    eq(documents.documentStatus, "active"),
  ];
  if (scope === "personal") {
    baseConditions.push(eq(documents.ownerId, userId));
  }

  const createdResult = await db
    .select({ value: count() })
    .from(documents)
    .where(and(...baseConditions, gte(documents.createdAt, new Date(startMs))));

  const completedResult = await db
    .select({ value: count() })
    .from(documents)
    .where(
      and(
        ...baseConditions,
        eq(documents.status, "completed"),
        gte(documents.updatedAt, new Date(startMs))
      )
    );

  return c.json({
    created: createdResult[0]?.value ?? 0,
    completed: completedResult[0]?.value ?? 0,
    period,
  });
});

const memberActivitySchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    created: z.number().int(),
    completed: z.number().int(),
    pending: z.number().int(),
    completionRate: z.number().int(),
    avgSigningTimeMs: z.number().int().nullable(),
  })
  .openapi("MemberActivity");

const memberActivityRouteDef = createRoute({
  method: "get",
  path: "/{slug}/member-activity",
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(memberActivitySchema) },
      },
      description: "Per-member document activity",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization or not admin" },
  },
});

app.openapi(memberActivityRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const userId = c.get("user")!.user.id;

  const db = createD1(c.env.D1);

  const membership = await db
    .select()
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId))
    )
    .limit(1);

  const role = membership[0]?.role ?? "member";
  const isAdmin = role === "owner" || role === "admin";
  if (!isAdmin) {
    return c.json([]);
  }

  const membersRows = await db
    .select({
      userId: member.userId,
      role: member.role,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId));

  const memberDocs = await db
    .select({
      ownerId: documents.ownerId,
      status: documents.status,
      sentAt: documents.sentAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, organizationId),
        eq(documents.documentStatus, "active")
      )
    );

  const results = membersRows.map((m) => {
    const owned = memberDocs.filter((d) => d.ownerId === m.userId);
    const created = owned.length;
    const completed = owned.filter((d) => d.status === "completed").length;
    const pending = owned.filter(
      (d) => d.status === "sent" || d.status === "in_progress"
    ).length;

    let totalMs = 0;
    let completedCount = 0;
    for (const doc of owned) {
      if (doc.status === "completed" && doc.sentAt && doc.updatedAt) {
        totalMs += doc.updatedAt.getTime() - doc.sentAt.getTime();
        completedCount++;
      }
    }
    const avgSigningTimeMs =
      completedCount > 0 ? Math.round(totalMs / completedCount) : null;

    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      created,
      completed,
      pending,
      completionRate: created > 0 ? Math.round((completed / created) * 100) : 0,
      avgSigningTimeMs,
    };
  });

  return c.json(results);
});

const exportDocumentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    ownerName: z.string(),
    ownerEmail: z.string(),
    createdAt: z.number(),
    sentAt: z.number().nullable(),
    completedAt: z.number().nullable(),
    deadline: z.number().nullable(),
    recipientCount: z.number().int(),
    signedCount: z.number().int(),
    pendingCount: z.number().int(),
  })
  .openapi("ExportDocument");

const exportDocumentsQuerySchema = z.object({
  workflowStatus: z.string().optional(),
  startDate: z.coerce.number().int().optional(),
  endDate: z.coerce.number().int().optional(),
});

const exportDocumentsRouteDef = createRoute({
  method: "get",
  path: "/{slug}/documents/export",
  request: {
    query: exportDocumentsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(exportDocumentSchema) },
      },
      description: "Documents for CSV/PDF export",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(exportDocumentsRouteDef, async (c) => {
  const organizationId = c.get("organization").id;

  const { workflowStatus, startDate, endDate } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const conditions: SQL[] = [
    eq(documents.organizationId, organizationId),
    eq(documents.documentStatus, "active"),
  ];
  if (workflowStatus) {
    conditions.push(eq(documents.status, workflowStatus));
  }
  if (startDate !== undefined) {
    conditions.push(gte(documents.createdAt, new Date(startDate)));
  }
  if (endDate !== undefined) {
    conditions.push(lte(documents.createdAt, new Date(endDate)));
  }

  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      status: documents.status,
      ownerId: documents.ownerId,
      createdAt: documents.createdAt,
      sentAt: documents.sentAt,
      updatedAt: documents.updatedAt,
      deadline: documents.deadline,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(documents)
    .leftJoin(user, eq(documents.ownerId, user.id))
    .where(and(...conditions))
    .orderBy(documents.createdAt);

  const documentIds = rows.map((r) => r.id);
  const recipientRows =
    documentIds.length > 0
      ? await db
          .select({
            documentId: recipients.documentId,
            status: recipients.status,
          })
          .from(recipients)
          .where(inArray(recipients.documentId, documentIds))
      : [];

  const recipientsByDoc = new Map<string, typeof recipientRows>();
  for (const r of recipientRows) {
    const list = recipientsByDoc.get(r.documentId);
    if (list) {
      list.push(r);
    } else {
      recipientsByDoc.set(r.documentId, [r]);
    }
  }

  const results = rows.map((row) => {
    const docRecipients = recipientsByDoc.get(row.id) ?? [];
    const recipientCount = docRecipients.length;
    const signedCount = docRecipients.filter(
      (r) => r.status === "signed" || r.status === "approved"
    ).length;
    const pendingCount = docRecipients.filter(
      (r) => r.status === "pending"
    ).length;

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      ownerName: row.ownerName ?? "Unknown",
      ownerEmail: row.ownerEmail ?? "",
      createdAt: row.createdAt.getTime(),
      sentAt: row.sentAt ? row.sentAt.getTime() : null,
      completedAt:
        row.status === "completed" ? (row.updatedAt?.getTime() ?? null) : null,
      deadline: row.deadline ? row.deadline.getTime() : null,
      recipientCount,
      signedCount,
      pendingCount,
    };
  });

  return c.json(results);
});

const emailEngagementQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const emailEngagementSchema = z
  .object({
    total: z.number().int(),
    deliveryRate: z.number().int(),
    openRate: z.number().int(),
    clickRate: z.number().int(),
    bounceRate: z.number().int(),
    avgTimeToOpen: z.number().int().nullable(),
  })
  .openapi("EmailEngagement");

const emailEngagementRouteDef = createRoute({
  method: "get",
  path: "/{slug}/email-engagement",
  request: {
    query: emailEngagementQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: emailEngagementSchema },
      },
      description: "Email engagement stats for the active organization",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(emailEngagementRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const { days } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const startMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const start = new Date(startMs);

  const allRows = await db
    .select({
      emailStatus: notifications.emailStatus,
      lastEmailError: notifications.lastEmailError,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        gte(notifications.emailSentAt, start)
      )
    );

  const total = allRows.length;
  const bounced = allRows.filter(
    (r) => r.lastEmailError !== null && r.lastEmailError !== ""
  ).length;
  const delivered = total - bounced;

  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 100;
  const bounceRate = total > 0 ? Math.round((bounced / total) * 100) : 0;

  return c.json({
    total,
    deliveryRate,
    openRate: 0,
    clickRate: 0,
    bounceRate,
    avgTimeToOpen: null,
  });
});

const timingBucketSchema = z
  .object({
    bucket: z.string(),
    count: z.number().int(),
  })
  .openapi("TimingBucket");

const recipientTimingResponseSchema = z
  .object({
    sampleSize: z.number().int(),
    avgTimeToView: z.number().int().nullable(),
    avgTimeToSign: z.number().int().nullable(),
    avgTotalTurnaround: z.number().int().nullable(),
    distribution: z.array(timingBucketSchema),
  })
  .openapi("RecipientTiming");

const recipientTimingQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const recipientTimingRouteDef = createRoute({
  method: "get",
  path: "/{slug}/recipient-timing",
  request: {
    query: recipientTimingQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: recipientTimingResponseSchema },
      },
      description: "Recipient signing timing distribution",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

function bucketForMs(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return "<1h";
  if (hours < 6) return "1-6h";
  if (hours < 24) return "6-24h";
  const days = hours / 24;
  if (days < 3) return "1-3d";
  if (days < 7) return "3-7d";
  return "7d+";
}

app.openapi(recipientTimingRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const { days } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const startMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const start = new Date(startMs);

  const rows = await db
    .select({
      signedAt: recipients.signedAt,
      viewedAt: recipients.viewedAt,
      sentAt: documents.sentAt,
    })
    .from(recipients)
    .innerJoin(documents, eq(recipients.documentId, documents.id))
    .where(
      and(
        eq(documents.organizationId, organizationId),
        eq(documents.documentStatus, "active"),
        gte(recipients.signedAt, start)
      )
    );

  let totalView = 0;
  let viewCount = 0;
  let totalSign = 0;
  let signCount = 0;
  let totalTurnaround = 0;
  let turnaroundCount = 0;

  const buckets = new Map<string, number>();
  for (const row of rows) {
    const signedAt = row.signedAt?.getTime();
    const sentAt = row.sentAt?.getTime();
    const viewedAt = row.viewedAt?.getTime();

    if (signedAt && sentAt) {
      const turnaround = signedAt - sentAt;
      totalTurnaround += turnaround;
      turnaroundCount++;

      const bucket = bucketForMs(turnaround);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }

    if (viewedAt && sentAt) {
      totalView += viewedAt - sentAt;
      viewCount++;
    }

    if (signedAt && viewedAt) {
      totalSign += signedAt - viewedAt;
      signCount++;
    }
  }

  const distribution = ["<1h", "1-6h", "6-24h", "1-3d", "3-7d", "7d+"].map(
    (bucket) => ({
      bucket,
      count: buckets.get(bucket) ?? 0,
    })
  );

  return c.json({
    sampleSize: rows.length,
    avgTimeToView: viewCount > 0 ? Math.round(totalView / viewCount) : null,
    avgTimeToSign: signCount > 0 ? Math.round(totalSign / signCount) : null,
    avgTotalTurnaround:
      turnaroundCount > 0
        ? Math.round(totalTurnaround / turnaroundCount)
        : null,
    distribution,
  });
});

const templatePerformanceSchema = z
  .object({
    templateId: z.string(),
    templateName: z.string(),
    docsSent: z.number().int(),
    completionRate: z.number().int(),
    avgTurnaround: z.number().int().nullable(),
    declineRate: z.number().int(),
  })
  .openapi("TemplatePerformance");

const templatePerformanceQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
});

const templatePerformanceRouteDef = createRoute({
  method: "get",
  path: "/{slug}/template-performance",
  request: {
    query: templatePerformanceQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(templatePerformanceSchema) },
      },
      description: "Template performance summary",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(templatePerformanceRouteDef, async (c) => {
  const organizationId = c.get("organization").id;

  const db = createD1(c.env.D1);

  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      useCount: templates.useCount,
    })
    .from(templates)
    .where(
      and(
        eq(templates.organizationId, organizationId),
        eq(templates.status, "active")
      )
    )
    .orderBy(templates.useCount);

  const results = rows.map((t) => ({
    templateId: t.id,
    templateName: t.name,
    docsSent: t.useCount,
    completionRate: 0,
    avgTurnaround: null,
    declineRate: 0,
  }));

  return c.json(results);
});

export default app;
