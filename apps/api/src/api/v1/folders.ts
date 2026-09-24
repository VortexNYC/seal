import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { folders } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

type ApiFolder = {
  id: string;
  name: string;
  type: "document" | "template";
  parent_id: string | null;
  visibility: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

function toApiFolder(
  row: {
    publicId: string;
    name: string;
    type: string;
    visibility: string;
    pinned: boolean | null;
    createdAt: Date;
    updatedAt: Date;
  },
  parentPublicId: string | null
): ApiFolder {
  return {
    id: row.publicId,
    name: row.name,
    type: row.type === "template" ? "template" : "document",
    parent_id: parentPublicId,
    visibility: row.visibility,
    pinned: Boolean(row.pinned),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function parentPublicIdMap(
  db: ReturnType<typeof createD1>,
  organizationId: string,
  rows: { parentId: string | null }[]
): Promise<Map<string, string>> {
  const parentIds = rows
    .map((r) => r.parentId)
    .filter((id): id is string => id !== null);
  const map = new Map<string, string>();
  if (parentIds.length === 0) return map;
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
    map.set(parent.id, parent.publicId);
  }
  return map;
}

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const query = c.req.query();
  const type = query.type === "template" ? "template" : "document";
  const parentPublicId = query.parent_id;
  const flat = query.flat === "true" || query.flat === "1";

  const db = createD1(c.env.D1);
  const conditions = [
    eq(folders.organizationId, organizationId),
    eq(folders.type, type),
  ];

  if (!flat) {
    if (parentPublicId) {
      const parentRows = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.publicId, parentPublicId),
            eq(folders.organizationId, organizationId)
          )
        )
        .limit(1);
      const parent = parentRows[0];
      if (!parent) {
        return c.json({ folders: [] });
      }
      conditions.push(eq(folders.parentId, parent.id));
    } else {
      conditions.push(isNull(folders.parentId));
    }
  }

  const rows = await db
    .select()
    .from(folders)
    .where(and(...conditions))
    .orderBy(desc(folders.createdAt));

  const parents = await parentPublicIdMap(db, organizationId, rows);
  return c.json({
    folders: rows.map((row) =>
      toApiFolder(row, row.parentId ? (parents.get(row.parentId) ?? null) : null)
    ),
  });
});

const createBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["document", "template"]).default("document"),
  parent_id: z.string().optional(),
  visibility: z
    .enum(["everyone", "members", "restricted"])
    .optional()
    .default("everyone"),
  pinned: z.boolean().optional().default(false),
});

app.post("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const parsed = createBodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { name, type, parent_id, visibility, pinned } = parsed.data;
  const db = createD1(c.env.D1);

  let parentInternalId: string | null = null;
  if (parent_id) {
    const parentRows = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.publicId, parent_id),
          eq(folders.organizationId, organizationId)
        )
      )
      .limit(1);
    const parent = parentRows[0];
    if (!parent) {
      return c.json({ error: "parent_not_found" }, 404);
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
    createdBy: mcp.sub,
    createdAt: now,
    updatedAt: now,
  });

  return c.json(
    {
      id: publicId,
      name,
      type,
      parent_id: parent_id ?? null,
      visibility,
      pinned,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    201
  );
});

app.get("/breadcrumbs", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_folder_id" }, 400);
  }

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
      and(eq(folders.publicId, id), eq(folders.organizationId, organizationId))
    )
    .limit(1);

  const start = startRows[0];
  if (!start) {
    return c.json({ error: "not_found" }, 404);
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

  const folderById = new Map(allFolders.map((f) => [f.id, f]));
  const breadcrumbs: { id: string; name: string }[] = [];
  let current: typeof start | undefined = start;
  let depth = 0;
  while (current && depth < 10) {
    breadcrumbs.unshift({ id: current.publicId, name: current.name });
    if (!current.parentId) break;
    current = folderById.get(current.parentId);
    depth++;
  }

  return c.json({ breadcrumbs });
});

export default app;
