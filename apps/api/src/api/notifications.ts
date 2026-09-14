import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, desc, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { notifications } from "../global/schema.js";
import { organizationMiddleware } from "../platform/organization-middleware.js";
import type { Variables } from "../platform/types.js";

const EmailStatusSchema = z
  .union([
    z.literal("pending"),
    z.literal("sent"),
    z.literal("failed"),
    z.literal("not_applicable"),
  ])
  .openapi("NotificationEmailStatus");

const NotificationTypeSchema = z.union([
  z.literal("document_shared"),
  z.literal("access_revoked"),
  z.literal("access_updated"),
  z.literal("ownership_transferred"),
  z.literal("document_signed"),
  z.literal("document_completed"),
  z.literal("signature_requested"),
  z.literal("reminder"),
  z.literal("sharing_disabled"),
  z.literal("bulk_access_revoked"),
]);

const NotificationDataSchema = z.record(z.string(), z.unknown());

const NotificationSchema = z
  .object({
    _id: z.string(),
    userId: z.string(),
    organizationId: z.string(),
    type: NotificationTypeSchema,
    data: NotificationDataSchema,
    read: z.boolean(),
    readAt: z.number().optional(),
    emailStatus: EmailStatusSchema.optional(),
    emailSentAt: z.number().optional(),
    emailAttempts: z.number().int().optional(),
    lastEmailError: z.string().optional(),
    emailMessageId: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Notification");

function notificationResponse(row: {
  id: string;
  publicId: string;
  userId: string;
  organizationId: string;
  type: string;
  data: string;
  read: boolean | number;
  readAt: Date | null;
  emailStatus: string | null;
  emailSentAt: Date | null;
  emailAttempts: number | null;
  lastEmailError: string | null;
  emailMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    _id: row.publicId,
    userId: row.userId,
    organizationId: row.organizationId,
    type: row.type,
    data: NotificationDataSchema.parse(JSON.parse(row.data)),
    read: Boolean(row.read),
    readAt: row.readAt ? row.readAt.getTime() : undefined,
    emailStatus: row.emailStatus ?? undefined,
    emailSentAt: row.emailSentAt ? row.emailSentAt.getTime() : undefined,
    emailAttempts: row.emailAttempts ?? undefined,
    lastEmailError: row.lastEmailError ?? undefined,
    emailMessageId: row.emailMessageId ?? undefined,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use("/*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.use("/:slug/*", organizationMiddleware);

const listRouteDef = createRoute({
  method: "get",
  path: "/{slug}",
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(NotificationSchema) } },
      description: "List notifications",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(listRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = c.get("organization").id;
  const userId = user!.user.id;
  const { limit = 20 } = c.req.valid("query");

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.userId, userId)
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return c.json(rows.map(notificationResponse));
});

const unreadCountRouteDef = createRoute({
  method: "get",
  path: "/{slug}/unread-count",
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ count: z.number().int() }) },
      },
      description: "Unread notification count",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(unreadCountRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = c.get("organization").id;
  const userId = user!.user.id;

  const db = createD1(c.env.D1);
  const result = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      )
    );

  return c.json({ count: result[0]?.count ?? 0 });
});

const markAsReadRouteDef = createRoute({
  method: "post",
  path: "/{slug}/{publicId}/read",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: NotificationSchema } },
      description: "Notification marked as read",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
    404: { description: "Notification not found" },
  },
});

app.openapi(markAsReadRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = c.get("organization").id;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const existingRows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.publicId, publicId),
        eq(notifications.organizationId, organizationId),
        eq(notifications.userId, userId)
      )
    )
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    return c.json({ error: "Notification not found" }, 404);
  }

  if (!existing.read) {
    await db
      .update(notifications)
      .set({ read: true, readAt: new Date() })
      .where(eq(notifications.id, existing.id));
  }

  const updatedRows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, existing.id))
    .limit(1);

  const updated = updatedRows[0];
  if (!updated) {
    return c.json({ error: "Failed to mark as read" }, 500);
  }

  return c.json(notificationResponse(updated));
});

const markAllReadRouteDef = createRoute({
  method: "post",
  path: "/{slug}/read-all",
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ count: z.number().int() }) },
      },
      description: "Notifications marked as read",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(markAllReadRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = c.get("organization").id;
  const userId = user!.user.id;

  const db = createD1(c.env.D1);
  const unreadRows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      )
    );

  if (unreadRows.length > 0) {
    await db
      .update(notifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.organizationId, organizationId),
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        )
      );
  }

  return c.json({ count: unreadRows.length });
});

export default app;
