import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { createD1 } from "../global/db.js";
import { feedback } from "../global/schema.js";
import { organizationMiddleware } from "../platform/organization-middleware.js";
import type { Variables } from "../platform/types.js";

const submitFeedbackBodySchema = z.object({
  type: z.union([z.literal("bug"), z.literal("suggestion")]),
  message: z.string().min(1),
  route: z.string().optional(),
});

const submitFeedbackResponseSchema = z.object({
  id: z.string(),
});

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

const submitRouteDef = createRoute({
  method: "post",
  path: "/{slug}",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": { schema: submitFeedbackBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: submitFeedbackResponseSchema },
      },
      description: "Feedback submitted",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(submitRouteDef, async (c) => {
  const sessionUser = c.get("user");
  const body = c.req.valid("json");
  const db = createD1(c.env.D1);

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(feedback).values({
    id,
    userId: sessionUser!.user.id,
    organizationId: c.get("organization").id,
    type: body.type,
    message: body.message,
    route: body.route ?? null,
    createdAt: now,
  });

  return c.json({ id });
});

export default app;
