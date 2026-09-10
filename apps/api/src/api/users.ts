import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { user } from "../global/schema.js";

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

export default app;
