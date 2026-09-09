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
    storageKey: z.string().nullable().optional(),
    contentType: z.string().nullable().optional(),
    size: z.number().int().nullable().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Document");

const FileSchema = z
  .object({
    storageKey: z.string(),
    contentType: z.string(),
    size: z.number().int(),
  })
  .openapi("DocumentFile");

function documentResponse(doc: {
  id: string;
  publicId: string;
  organizationId: string;
  name: string;
  status: string;
  storageKey: string | null;
  contentType: string | null;
  size: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doc.id,
    publicId: doc.publicId,
    organizationId: doc.organizationId,
    name: doc.name,
    status: doc.status,
    storageKey: doc.storageKey,
    contentType: doc.contentType,
    size: doc.size,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
  };
}

function generatePublicId() {
  return crypto.randomUUID();
}

function r2Key(organizationId: string, publicId: string) {
  return `${organizationId}/documents/${publicId}`;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return new Uint8Array(Array.from(binary, (char) => char.charCodeAt(0)));
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

  return c.json(documentResponse(doc), 201);
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

  return c.json(rows.map(documentResponse));
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

  return c.json(documentResponse(doc));
});

const uploadBodySchema = z.object({
  contentBase64: z.string().min(1),
  contentType: z.string().optional(),
});

const uploadRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/upload",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: uploadBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: FileSchema } },
      description: "Document uploaded",
    },
    404: { description: "Document not found" },
    503: { description: "Object storage not configured" },
  },
});

app.openapi(uploadRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const bucket = c.env.DOCUMENTS_BUCKET;
  if (!bucket) {
    return c.json({ error: "Object storage not configured" }, 503);
  }

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
    return c.json({ error: "Document not found" }, 404);
  }

  const bytes = base64ToBytes(input.contentBase64);
  const contentType = input.contentType || "application/octet-stream";
  const key = r2Key(organizationId, publicId);

  await bucket.put(key, bytes, { httpMetadata: { contentType } });

  await db
    .update(documents)
    .set({
      storageKey: key,
      contentType,
      size: bytes.length,
      status: "uploaded",
    })
    .where(eq(documents.id, doc.id));

  return c.json({ storageKey: key, contentType, size: bytes.length });
});

const downloadRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/download",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: { description: "Document file" },
    404: { description: "Document or file not found" },
    503: { description: "Object storage not configured" },
  },
});

app.openapi(downloadRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const bucket = c.env.DOCUMENTS_BUCKET;
  if (!bucket) {
    return c.json({ error: "Object storage not configured" }, 503);
  }

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
  if (!doc || !doc.storageKey) {
    return c.json({ error: "Document or file not found" }, 404);
  }

  const object = await bucket.get(doc.storageKey);
  if (!object || !object.body) {
    return c.json({ error: "Document or file not found" }, 404);
  }

  const headers: Record<string, string> = {
    "content-type":
      object.httpMetadata?.contentType || "application/octet-stream",
  };
  if (object.size) headers["content-length"] = String(object.size);

  return c.body(object.body, { headers });
});

export default app;
