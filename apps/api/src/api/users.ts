import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, ne } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  documents as documentsTable,
  organization as organizationTable,
  user,
} from "../global/schema.js";

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
  Variables: { user: import("../platform/session.js").SessionUser | null };
}>();

app.use("/*", async (c, next) => {
  const sessionUser = c.get("user");
  if (!sessionUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

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
  const sessionUser = c.get("user");
  const db = createD1(c.env.D1);

  const rows = await db
    .select({ metadata: user.metadata })
    .from(user)
    .where(eq(user.id, sessionUser!.user.id))
    .limit(1);

  const metadata = safeParseMetadata(rows[0]?.metadata ?? null) ?? {};
  const raw = metadata.notificationPreferences;

  const parsed = notificationPreferencesSchema.safeParse(raw);
  return c.json(parsed.success ? parsed.data : notificationPreferencesSchema.parse({}));
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
  const sessionUser = c.get("user");
  const body = c.req.valid("json");
  const db = createD1(c.env.D1);

  const rows = await db
    .select({ metadata: user.metadata })
    .from(user)
    .where(eq(user.id, sessionUser!.user.id))
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
    .where(eq(user.id, sessionUser!.user.id));

  return c.json(notificationPreferencesSchema.parse(next));
});

const planLimits = {
  free: { documentsPerMonth: 10, storageBytes: 100 * 1024 * 1024 },
  pro: { documentsPerMonth: 500, storageBytes: 10 * 1024 * 1024 * 1024 },
  enterprise: { documentsPerMonth: 500, storageBytes: 10 * 1024 * 1024 * 1024 },
} as const;

function getPlanFromMetadata(
  metadata: string | null
): keyof typeof planLimits {
  const parsed = safeParseMetadata(metadata);
  if (!parsed) return "free";
  const plan =
    typeof parsed.plan === "string" ? parsed.plan.toLowerCase() : "free";
  return (plan in planLimits ? plan : "free") as keyof typeof planLimits;
}

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
  path: "/me/usage",
  responses: {
    200: {
      content: { "application/json": { schema: usageResponseSchema } },
      description: "User usage statistics",
    },
    401: { description: "Unauthorized" },
  },
});

app.openapi(usageRouteDef, async (c) => {
  const sessionUser = c.get("user");
  const db = createD1(c.env.D1);

  const userId = sessionUser!.user.id;
  const organizationId = sessionUser!.session?.activeOrganizationId;

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

  let plan: keyof typeof planLimits = "free";
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

export default app;
