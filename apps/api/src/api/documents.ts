import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq, and, desc } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { documents } from "../global/schema.js";

const DocumentSchema = z
  .object({
    id: z.string(),
    publicId: z.string(),
    organizationId: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Document");

function generatePublicId() {
  return crypto.randomUUID();
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

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ name: z.string().min(1) }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: DocumentSchema } },
      description: "Document created",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(createRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { name } = c.req.valid("json");

  const db = createD1(c.env.D1);
  const publicId = generatePublicId();
  const now = new Date();

  await db.insert(documents).values({
    id: crypto.randomUUID(),
    publicId,
    organizationId,
    name,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = rows[0];
  if (!doc) {
    return c.json({ error: "Failed to create document" }, 500);
  }

  return c.json(
    {
      id: doc.id,
      publicId: doc.publicId,
      organizationId: doc.organizationId,
      name: doc.name,
      status: doc.status,
      createdAt: doc.createdAt.getTime(),
      updatedAt: doc.updatedAt.getTime(),
    },
    201
  );
});

const listRouteDef = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(DocumentSchema) },
      },
      description: "List documents",
    },
  },
});

app.openapi(listRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.organizationId, organizationId))
    .orderBy(desc(documents.createdAt));

  return c.json(
    rows.map((doc) => ({
      id: doc.id,
      publicId: doc.publicId,
      organizationId: doc.organizationId,
      name: doc.name,
      status: doc.status,
      createdAt: doc.createdAt.getTime(),
      updatedAt: doc.updatedAt.getTime(),
    }))
  );
});

const getRouteDef = createRoute({
  method: "get",
  path: "/{publicId}",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: DocumentSchema } },
      description: "Document found",
    },
    404: { description: "Not found" },
  },
});

app.openapi(getRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = rows[0];
  if (!doc) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({
    id: doc.id,
    publicId: doc.publicId,
    organizationId: doc.organizationId,
    name: doc.name,
    status: doc.status,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
  });
});

export default app;
