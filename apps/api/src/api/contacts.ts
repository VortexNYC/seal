import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { contacts, documents, recipients } from "../global/schema.js";
import { organizationMiddleware } from "../platform/organization-middleware.js";
import type { Variables } from "../platform/types.js";

const ContactSchema = z
  .object({
    id: z.string(),
    publicId: z.string(),
    organizationId: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    fullName: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    status: z.enum(["active", "inactive", "lead"]),
    notes: z.string().nullable().optional(),
    tags: z.array(z.string()),
    lastContactedAt: z.number().nullable().optional(),
    createdBy: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Contact");

const ContactInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(["active", "inactive", "lead"]).default("active"),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lastContactedAt: z.number().optional(),
});

const RelatedDocumentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    workflowStatus: z.string(),
    role: z.string(),
  })
  .openapi("RelatedDocument");

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  return z.array(z.string()).parse(JSON.parse(tags));
}

function contactResponse(row: {
  id: string;
  publicId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  status: string;
  notes: string | null;
  tags: string | null;
  lastContactedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.publicId,
    publicId: row.publicId,
    organizationId: row.organizationId,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    title: row.title,
    status: ContactSchema.shape.status.parse(row.status),
    notes: row.notes,
    tags: parseTags(row.tags),
    lastContactedAt: row.lastContactedAt?.getTime() ?? null,
    createdBy: row.createdBy,
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
      search: z.string().optional(),
      status: z.enum(["active", "inactive", "lead"]).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(ContactSchema) },
      },
      description: "Contacts for the active organization",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(listRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const { search, status } = c.req.valid("query");

  const db = createD1(c.env.D1);
  const conditions: (
    | ReturnType<typeof eq>
    | ReturnType<typeof or>
    | undefined
  )[] = [eq(contacts.organizationId, organizationId)];

  if (status) {
    conditions.push(eq(contacts.status, status));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        like(contacts.firstName, term),
        like(contacts.lastName, term),
        like(contacts.fullName, term),
        like(contacts.email, term),
        like(contacts.company, term)
      )
    );
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conditions))
    .orderBy(desc(contacts.updatedAt));

  return c.json(rows.map(contactResponse));
});

const byEmailRouteDef = createRoute({
  method: "get",
  path: "/{slug}/by-email",
  request: {
    query: z.object({
      email: z.string().email(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: ContactSchema.nullable() },
      },
      description: "Contact by email, if found",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(byEmailRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const { email } = c.req.valid("query");

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.email, email)
      )
    )
    .limit(1);

  return c.json(rows[0] ? contactResponse(rows[0]) : null);
});

const createRouteDef = createRoute({
  method: "post",
  path: "/{slug}",
  request: {
    body: {
      content: {
        "application/json": { schema: ContactInputSchema },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: ContactSchema } },
      description: "Contact created",
    },
    400: { description: "Invalid input" },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(createRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const now = new Date();
  const publicId = crypto.randomUUID();
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

  await db.insert(contacts).values({
    id: crypto.randomUUID(),
    publicId,
    organizationId,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    fullName,
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() ?? null,
    company: input.company?.trim() ?? null,
    title: input.title?.trim() ?? null,
    status: input.status,
    notes: input.notes?.trim() ?? null,
    tags: input.tags ? JSON.stringify(input.tags) : null,
    lastContactedAt: input.lastContactedAt
      ? new Date(input.lastContactedAt)
      : null,
    createdBy: c.get("user")!.user.id,
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.publicId, publicId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "Failed to create contact" }, 500);
  }

  return c.json(contactResponse(row), 201);
});

const relatedDocumentsRouteDef = createRoute({
  method: "get",
  path: "/{slug}/related-documents",
  request: {
    query: z.object({
      email: z.string().email(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(RelatedDocumentSchema) },
      },
      description: "Documents related to the email",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(relatedDocumentsRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const { email } = c.req.valid("query");

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: documents.id,
      publicId: documents.publicId,
      name: documents.name,
      status: documents.status,
      role: recipients.role,
    })
    .from(documents)
    .innerJoin(recipients, eq(documents.id, recipients.documentId))
    .where(
      and(
        eq(documents.organizationId, organizationId),
        eq(recipients.email, email)
      )
    )
    .orderBy(desc(documents.updatedAt));

  const results = rows.map((row) => ({
    id: row.publicId,
    name: row.name,
    workflowStatus: row.status,
    role: row.role,
  }));

  return c.json(results);
});

const getRouteDef = createRoute({
  method: "get",
  path: "/{slug}/{publicId}",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: ContactSchema } },
      description: "Contact found",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
    404: { description: "Not found" },
  },
});

app.openapi(getRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.publicId, publicId),
        eq(contacts.organizationId, organizationId)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "Contact not found" }, 404);
  }

  return c.json(contactResponse(row));
});

const updateRouteDef = createRoute({
  method: "patch",
  path: "/{slug}/{publicId}",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: ContactInputSchema.partial() },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ContactSchema } },
      description: "Contact updated",
    },
    400: { description: "Invalid input" },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
    404: { description: "Not found" },
  },
});

app.openapi(updateRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const { publicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const existingRows = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.publicId, publicId),
        eq(contacts.organizationId, organizationId)
      )
    )
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    return c.json({ error: "Contact not found" }, 404);
  }

  const firstName =
    input.firstName !== undefined ? input.firstName.trim() : existing.firstName;
  const lastName =
    input.lastName !== undefined ? input.lastName.trim() : existing.lastName;
  const fullName = `${firstName} ${lastName}`.trim();

  const updateValues: Record<string, unknown> = {
    firstName,
    lastName,
    fullName,
    updatedAt: new Date(),
  };

  if (input.email !== undefined) {
    updateValues.email = input.email.trim().toLowerCase();
  }
  if (input.phone !== undefined) {
    updateValues.phone = input.phone.trim() || null;
  }
  if (input.company !== undefined) {
    updateValues.company = input.company.trim() || null;
  }
  if (input.title !== undefined) {
    updateValues.title = input.title.trim() || null;
  }
  if (input.status !== undefined) {
    updateValues.status = input.status;
  }
  if (input.notes !== undefined) {
    updateValues.notes = input.notes.trim() || null;
  }
  if (input.tags !== undefined) {
    updateValues.tags =
      input.tags.length > 0 ? JSON.stringify(input.tags) : null;
  }
  if (input.lastContactedAt !== undefined) {
    updateValues.lastContactedAt = input.lastContactedAt
      ? new Date(input.lastContactedAt)
      : null;
  }

  await db
    .update(contacts)
    .set(updateValues)
    .where(eq(contacts.id, existing.id));

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, existing.id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "Failed to update contact" }, 500);
  }

  return c.json(contactResponse(row));
});

const deleteRouteDef = createRoute({
  method: "delete",
  path: "/{slug}/{publicId}",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    204: { description: "Contact deleted" },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
    404: { description: "Not found" },
  },
});

app.openapi(deleteRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const existingRows = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.publicId, publicId),
        eq(contacts.organizationId, organizationId)
      )
    )
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    return c.json({ error: "Contact not found" }, 404);
  }

  await db.delete(contacts).where(eq(contacts.id, existing.id));
  return c.body(null, 204);
});

const bulkDeleteRouteDef = createRoute({
  method: "post",
  path: "/{slug}/bulk-delete",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ ids: z.array(z.string()) }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              id: z.string(),
              success: z.boolean(),
            })
          ),
        },
      },
      description: "Bulk delete results",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(bulkDeleteRouteDef, async (c) => {
  const organizationId = c.get("organization").id;
  const { ids } = c.req.valid("json");

  const db = createD1(c.env.D1);
  const rows = await db
    .select({ id: contacts.id, publicId: contacts.publicId })
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, organizationId),
        inArray(contacts.publicId, ids)
      )
    );

  const foundIds = new Set(rows.map((row) => row.publicId));
  const results = ids.map((id) => ({ id, success: foundIds.has(id) }));

  if (rows.length > 0) {
    const internalIds = rows.map((row) => row.id);
    await db.delete(contacts).where(inArray(contacts.id, internalIds));
  }

  return c.json(results);
});

export default app;
