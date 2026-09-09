import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { activity } from "../global/schema.js";

const ActivitySchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    action: z.string(),
    actorName: z.string(),
    targetName: z.string().nullable().optional(),
    metadata: z.string().nullable().optional(),
    timestamp: z.number(),
  })
  .openapi("Activity");

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
    metadata: row.metadata,
    timestamp: row.createdAt.getTime(),
  };
}

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

const listRouteDef = createRoute({
  method: "get",
  path: "/",
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
  const organizationId = user!.session!.activeOrganizationId!;
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
