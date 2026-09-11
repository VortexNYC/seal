import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { savedSignatures } from "../global/schema.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { user: import("../platform/session.js").SessionUser | null };
}>();

app.use("/*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

const signatureTypeSchema = z.enum(["drawn", "typed", "uploaded"]);

const savedSignatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  signatureImageUrl: z.string(),
  signatureType: signatureTypeSchema,
  fontFamily: z.string().nullable().optional(),
  isDefault: z.boolean(),
  usageCount: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

const listRoute = createRoute({
  method: "get",
  path: "/saved-signatures",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(savedSignatureSchema),
        },
      },
      description: "User's saved signatures",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
  },
});

app.openapi(listRoute, async (c) => {
  const user = c.get("user");
  const db = createD1(c.env.D1);

  const rows = await db
    .select()
    .from(savedSignatures)
    .where(eq(savedSignatures.userId, user!.user.id))
    .orderBy(desc(savedSignatures.usageCount), desc(savedSignatures.createdAt));

  return c.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      signatureImageUrl: row.signatureImageUrl,
      signatureType: signatureTypeSchema.parse(row.signatureType),
      fontFamily: row.fontFamily ?? null,
      isDefault: row.isDefault,
      usageCount: row.usageCount,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    })),
    200
  );
});

const createBodySchema = z.object({
  name: z.string().min(1),
  signatureImageUrl: z.string().min(1),
  signatureType: z.enum(["drawn", "typed", "uploaded"]),
  fontFamily: z.string().optional(),
  setAsDefault: z.boolean().optional(),
});

const createSavedSignatureRoute = createRoute({
  method: "post",
  path: "/saved-signatures",
  request: {
    body: {
      content: {
        "application/json": { schema: createBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: savedSignatureSchema },
      },
      description: "Created saved signature",
    },
    400: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Bad request",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
  },
});

app.openapi(createSavedSignatureRoute, async (c) => {
  const user = c.get("user");
  const db = createD1(c.env.D1);
  const input = c.req.valid("json");

  const existing = await db
    .select({ id: savedSignatures.id })
    .from(savedSignatures)
    .where(eq(savedSignatures.userId, user!.user.id));

  if (existing.length >= 10) {
    return c.json(
      {
        error:
          "You can only save up to 10 signatures. Please delete one to add a new one.",
      },
      400
    );
  }

  const shouldBeDefault = input.setAsDefault ?? existing.length === 0;

  if (shouldBeDefault) {
    await db
      .update(savedSignatures)
      .set({ isDefault: false })
      .where(eq(savedSignatures.userId, user!.user.id));
  }

  const id = crypto.randomUUID();
  const organizationId: string | null = null;
  const now = new Date();

  await db.insert(savedSignatures).values({
    id,
    userId: user!.user.id,
    organizationId,
    name: input.name,
    signatureImageUrl: input.signatureImageUrl,
    signatureType: input.signatureType,
    fontFamily: input.fontFamily,
    isDefault: shouldBeDefault,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  return c.json(
    {
      id,
      name: input.name,
      signatureImageUrl: input.signatureImageUrl,
      signatureType: input.signatureType,
      fontFamily: input.fontFamily ?? null,
      isDefault: shouldBeDefault,
      usageCount: 0,
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    },
    200
  );
});


const updateBodySchema = z.object({
  name: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

const updateRoute = createRoute({
  method: "patch",
  path: "/saved-signatures/:id",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: savedSignatureSchema },
      },
      description: "Updated saved signature",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
    404: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Not found",
    },
  },
});

app.openapi(updateRoute, async (c) => {
  const user = c.get("user");
  const db = createD1(c.env.D1);
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");

  const rows = await db
    .select()
    .from(savedSignatures)
    .where(
      and(eq(savedSignatures.id, id), eq(savedSignatures.userId, user!.user.id))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "Signature not found" }, 404);
  }

  if (input.isDefault === true) {
    await db
      .update(savedSignatures)
      .set({ isDefault: false })
      .where(
        and(
          eq(savedSignatures.userId, user!.user.id),
          eq(savedSignatures.isDefault, true)
        )
      );
  }

  const now = new Date();
  const update: Partial<typeof savedSignatures.$inferInsert> = {
    updatedAt: now,
  };
  if (input.name !== undefined) {
    update.name = input.name;
  }
  if (input.isDefault !== undefined) {
    update.isDefault = input.isDefault;
  }

  await db
    .update(savedSignatures)
    .set(update)
    .where(eq(savedSignatures.id, id));

  return c.json(
    {
      id,
      name: input.name ?? row.name,
      signatureImageUrl: row.signatureImageUrl,
      signatureType: signatureTypeSchema.parse(row.signatureType),
      fontFamily: row.fontFamily ?? null,
      isDefault:
        input.isDefault !== undefined ? input.isDefault : row.isDefault,
      usageCount: row.usageCount,
      createdAt: row.createdAt.getTime(),
      updatedAt: now.getTime(),
    },
    200
  );
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/saved-signatures/:id",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Deleted saved signature",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
    404: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Not found",
    },
  },
});

app.openapi(deleteRoute, async (c) => {
  const user = c.get("user");
  const db = createD1(c.env.D1);
  const { id } = c.req.valid("param");

  const rows = await db
    .select()
    .from(savedSignatures)
    .where(
      and(eq(savedSignatures.id, id), eq(savedSignatures.userId, user!.user.id))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "Signature not found" }, 404);
  }

  await db.delete(savedSignatures).where(eq(savedSignatures.id, id));

  if (row.isDefault) {
    const remaining = await db
      .select()
      .from(savedSignatures)
      .where(eq(savedSignatures.userId, user!.user.id))
      .orderBy(desc(savedSignatures.createdAt))
      .limit(1);

    if (remaining[0]) {
      await db
        .update(savedSignatures)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(savedSignatures.id, remaining[0].id));
    }
  }

  return c.json({ success: true }, 200);
});

const useRoute = createRoute({
  method: "post",
  path: "/saved-signatures/:id/use",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Usage count incremented",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
    404: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Not found",
    },
  },
});

app.openapi(useRoute, async (c) => {
  const user = c.get("user");
  const db = createD1(c.env.D1);
  const { id } = c.req.valid("param");

  const rows = await db
    .select({ usageCount: savedSignatures.usageCount })
    .from(savedSignatures)
    .where(
      and(eq(savedSignatures.id, id), eq(savedSignatures.userId, user!.user.id))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "Signature not found" }, 404);
  }

  await db
    .update(savedSignatures)
    .set({
      usageCount: row.usageCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(savedSignatures.id, id));

  return c.json({ success: true }, 200);
});

export default app;
