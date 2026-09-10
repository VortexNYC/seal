import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

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

const BreadcrumbSchema = z.object({
  id: z.string(),
  name: z.string(),
});

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

const createFolderBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["document", "template"]),
  parentId: z.string().optional(),
  visibility: z.enum(["everyone", "members", "restricted"]).default("everyone"),
  pinned: z.boolean().default(false),
});

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": { schema: createFolderBodySchema },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: FolderSchema } },
      description: "Folder created",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
    404: { description: "Parent folder not found" },
  },
});

app.openapi(createRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { name, type, parentId, visibility, pinned } = c.req.valid("json");

  const db = createD1(c.env.D1);

  let parentInternalId: string | null = null;
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
    if (!parent) {
      return c.json({ error: "Parent folder not found" }, 404);
    }
    parentInternalId = parent.id;
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();

  await db.insert(folders).values({
    id,
    publicId,
    organizationId,
    name,
    type,
    parentId: parentInternalId,
    visibility,
    pinned,
    createdBy: user!.user.id,
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.organizationId, organizationId)))
    .limit(1);

  const folder = rows[0];
  if (!folder) {
    return c.json({ error: "Failed to create folder" }, 500);
  }

  let parentPublicId: string | null = null;
  if (folder.parentId) {
    const parentRows = await db
      .select({ publicId: folders.publicId })
      .from(folders)
      .where(
        and(
          eq(folders.id, folder.parentId),
          eq(folders.organizationId, organizationId)
        )
      )
      .limit(1);
    parentPublicId = parentRows[0]?.publicId ?? null;
  }

  return c.json(folderResponse({ ...folder, parentId: parentPublicId }), 201);
});

const allRouteDef = createRoute({
  method: "get",
  path: "/all",
  request: {
    query: z.object({
      type: z.enum(["document", "template"]).default("document"),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(FolderSchema) } },
      description: "All folders flat",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(allRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { type } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const folderRows = await db
    .select()
    .from(folders)
    .where(
      and(eq(folders.organizationId, organizationId), eq(folders.type, type))
    )
    .orderBy(desc(folders.createdAt));

  const parentIds = folderRows
    .map((folder) => folder.parentId)
    .filter((id): id is string => id !== null);

  const parentPublicIds = new Map<string, string>();
  if (parentIds.length > 0) {
    const parents = await db
      .select({ id: folders.id, publicId: folders.publicId })
      .from(folders)
      .where(
        and(
          eq(folders.organizationId, organizationId),
          inArray(folders.id, parentIds)
        )
      );
    for (const parent of parents) {
      parentPublicIds.set(parent.id, parent.publicId);
    }
  }

  return c.json(
    folderRows.map((folder) =>
      folderResponse({
        ...folder,
        parentId: parentPublicIds.get(folder.parentId!) ?? null,
      })
    )
  );
});

const breadcrumbsRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/breadcrumbs",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(BreadcrumbSchema) },
      },
      description: "Folder breadcrumb chain",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
    404: { description: "Folder not found" },
  },
});

app.openapi(breadcrumbsRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);

  const startRows = await db
    .select({
      id: folders.id,
      publicId: folders.publicId,
      name: folders.name,
      parentId: folders.parentId,
    })
    .from(folders)
    .where(
      and(
        eq(folders.publicId, publicId),
        eq(folders.organizationId, organizationId)
      )
    )
    .limit(1);

  const start = startRows[0];
  if (!start) {
    return c.json({ error: "Folder not found" }, 404);
  }

  const allFolders = await db
    .select({
      id: folders.id,
      publicId: folders.publicId,
      name: folders.name,
      parentId: folders.parentId,
    })
    .from(folders)
    .where(eq(folders.organizationId, organizationId));

  const folderById = new Map(allFolders.map((folder) => [folder.id, folder]));

  const breadcrumbs: { id: string; name: string }[] = [];
  let current: typeof start | undefined = start;
  let depth = 0;

  while (current && depth < 10) {
    breadcrumbs.unshift({ id: current.publicId, name: current.name });
    if (!current.parentId) break;

    current = folderById.get(current.parentId);
    depth++;
  }

  return c.json(breadcrumbs);
});

export default app;
