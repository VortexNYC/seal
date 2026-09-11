import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { activity } from "../global/schema.js";
import type { Variables } from "../platform/types.js";
import { organizationMiddleware } from "../platform/organization-middleware.js";

const ActivityMetadataSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional();

const ActivitySchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    action: z.string(),
    actorName: z.string(),
    targetName: z.string().nullable().optional(),
    metadata: ActivityMetadataSchema,
    timestamp: z.number(),
  })
  .openapi("Activity");

function safeParseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    const result = z.record(z.string(), z.unknown()).safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function activityResponse(row: {
  id: string;
  organizationId: string;
  action: string;
  actorName: string;
  targetName: string | null;
  metadata: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    action: row.action,
    actorName: row.actorName,
    targetName: row.targetName,
    metadata: safeParseJson(row.metadata),
    timestamp: row.createdAt.getTime(),
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
      limit: z.coerce.number().int().min(1).max(100).default(10),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(ActivitySchema) },
      },
      description: "Recent activity for the active organization",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(listRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = c.get("organization").id;
  const { limit } = c.req.valid("query");

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(activity)
    .where(eq(activity.organizationId, organizationId))
    .orderBy(desc(activity.createdAt))
    .limit(limit);

  return c.json(rows.map(activityResponse));
});

export default app;
