import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, isNull } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { folders } from "../global/schema.js";

const FolderSchema = z
  .object({
    id: z.string(),
    publicId: z.string(),
    organizationId: z.string(),
    name: z.string(),
    parentId: z.string().nullable().optional(),
    type: z.string(),
    visibility: z.string(),
    pinned: z.boolean(),
    createdBy: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Folder");

function folderResponse(folder: {
  id: string;
  publicId: string;
  organizationId: string;
  name: string;
  parentId: string | null;
  type: string;
  visibility: string;
  pinned: boolean | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: folder.id,
    publicId: folder.publicId,
    organizationId: folder.organizationId,
    name: folder.name,
    parentId: folder.parentId,
    type: folder.type,
    visibility: folder.visibility,
    pinned: Boolean(folder.pinned),
    createdBy: folder.createdBy,
    createdAt: folder.createdAt.getTime(),
    updatedAt: folder.updatedAt.getTime(),
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
      type: z.enum(["document", "template"]).default("document"),
      parentId: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(FolderSchema) } },
      description: "List folders",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(listRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { type, parentId } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const conditions = [
    eq(folders.organizationId, organizationId),
    eq(folders.type, type),
  ];

  if (parentId) {
    const parentRows = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.publicId, parentId),
          eq(folders.organizationId, organizationId)
        )
      )
      .limit(1);
    const parent = parentRows[0];
    if (parent) {
      conditions.push(eq(folders.parentId, parent.id));
    } else {
      return c.json([]);
    }
  } else {
    conditions.push(isNull(folders.parentId));
  }

  const rows = await db
    .select()
    .from(folders)
    .where(and(...conditions))
    .orderBy(desc(folders.createdAt));

  return c.json(rows.map(folderResponse));
});

export default app;
