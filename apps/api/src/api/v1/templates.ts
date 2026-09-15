import { OpenAPIHono } from "@hono/zod-openapi";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  documents,
  signatureFields,
  templateFields,
  templates,
} from "../../global/schema.js";
import {
  getAuditActor,
  getAuditRequestMeta,
  writeAuditLog,
} from "../../platform/audit-log.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

type ApiTemplate = {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  use_count: number;
  field_count?: number;
};

type ApiTemplateField = {
  id: string;
  field_type: string;
  label: string;
  is_required: boolean;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: {
    placeholder?: string;
    default_value?: string;
    options?: string[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProperties(
  value: string | null
): ApiTemplateField["properties"] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return undefined;
    const properties: ApiTemplateField["properties"] = {};
    if (typeof parsed.placeholder === "string") {
      properties.placeholder = parsed.placeholder;
    }
    if (typeof parsed.default_value === "string") {
      properties.default_value = parsed.default_value;
    }
    if (
      Array.isArray(parsed.options) &&
      parsed.options.every((o) => typeof o === "string")
    ) {
      properties.options = parsed.options;
    }
    return Object.keys(properties).length > 0 ? properties : undefined;
  } catch {
    return undefined;
  }
}

function toApiTemplate(row: {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  useCount: number;
}): ApiTemplate {
  return {
    id: row.id,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    use_count: row.useCount,
  };
}

function toApiTemplateField(row: {
  id: string;
  fieldType: string;
  label: string | null;
  isRequired: boolean;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: string | null;
}): ApiTemplateField {
  const result: ApiTemplateField = {
    id: row.id,
    field_type: row.fieldType,
    label: row.label ?? "",
    is_required: row.isRequired,
    page: row.page,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
  };
  const properties = parseProperties(row.properties);
  if (properties) {
    result.properties = properties;
  }
  return result;
}

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "templates:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const query = c.req.query();
  const rawLimit = Number.parseInt(query.limit ?? `${DEFAULT_PAGE_LIMIT}`, 10);
  const limit = Number.isNaN(rawLimit)
    ? DEFAULT_PAGE_LIMIT
    : Math.min(Math.max(rawLimit, 1), MAX_PAGE_LIMIT);

  const cursor = query.cursor;
  const status = query.status;

  const db = createD1(c.env.D1);
  const conditions: SQL[] = [
    eq(templates.organizationId, organizationId),
    ne(templates.status, "deleted"),
  ];

  if (status) {
    conditions.push(eq(templates.status, status));
  }

  if (cursor) {
    const cursorRows = await db
      .select({ createdAt: templates.createdAt, id: templates.id })
      .from(templates)
      .where(eq(templates.id, cursor))
      .limit(1);
    const cursorTemplate = cursorRows[0];
    if (cursorTemplate && cursorTemplate.createdAt) {
      const cursorCondition = or(
        lt(templates.createdAt, cursorTemplate.createdAt),
        and(
          eq(templates.createdAt, cursorTemplate.createdAt),
          gt(templates.id, cursorTemplate.id)
        )
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }
  }

  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      status: templates.status,
      createdAt: templates.createdAt,
      updatedAt: templates.updatedAt,
      useCount: templates.useCount,
    })
    .from(templates)
    .where(and(...conditions))
    .orderBy(desc(templates.createdAt), desc(templates.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const resultRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? resultRows[resultRows.length - 1]?.id
    : undefined;

  const templateIds = resultRows.map((r) => r.id);
  const fieldCounts =
    templateIds.length > 0
      ? await db
          .select({
            templateId: templateFields.templateId,
            count: sql`count(*)`,
          })
          .from(templateFields)
          .where(inArray(templateFields.templateId, templateIds))
          .groupBy(templateFields.templateId)
      : [];
  const countByTemplate = new Map(
    fieldCounts.map((fc) => [fc.templateId, Number(fc.count ?? 0)])
  );

  return c.json({
    templates: resultRows.map((row) =>
      Object.assign(toApiTemplate(row), {
        field_count: countByTemplate.get(row.id) ?? 0,
      })
    ),
    has_more: hasMore,
    ...(nextCursor ? { next_cursor: nextCursor } : {}),
  });
});

app.get("/get", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "templates:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const query = c.req.query();
  const id = query.id;
  const includeFields =
    query.include_fields === "true" || query.include_fields === "1";
  if (!id) {
    return c.json({ error: "missing_template_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      status: templates.status,
      createdAt: templates.createdAt,
      updatedAt: templates.updatedAt,
      useCount: templates.useCount,
    })
    .from(templates)
    .where(
      and(
        eq(templates.id, id),
        eq(templates.organizationId, organizationId),
        ne(templates.status, "deleted")
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  const response: ApiTemplate & { fields?: ApiTemplateField[] } =
    toApiTemplate(row);

  if (includeFields) {
    const fieldRows = await db
      .select({
        id: templateFields.id,
        fieldType: templateFields.fieldType,
        label: templateFields.label,
        isRequired: templateFields.isRequired,
        page: templateFields.page,
        x: templateFields.x,
        y: templateFields.y,
        width: templateFields.width,
        height: templateFields.height,
        properties: templateFields.properties,
      })
      .from(templateFields)
      .where(eq(templateFields.templateId, id));
    response.fields = fieldRows.map(toApiTemplateField);
  }

  const fieldCount = await db
    .select({ count: sql`count(*)` })
    .from(templateFields)
    .where(eq(templateFields.templateId, id));
  response.field_count = Number(fieldCount[0]?.count ?? 0);

  return c.json(response);
});

app.get("/fields", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "templates:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_template_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const templateRows = await db
    .select({ id: templates.id })
    .from(templates)
    .where(
      and(
        eq(templates.id, id),
        eq(templates.organizationId, organizationId),
        ne(templates.status, "deleted")
      )
    )
    .limit(1);

  if (templateRows.length === 0) {
    return c.json({ error: "not_found" }, 404);
  }

  const fieldRows = await db
    .select({
      id: templateFields.id,
      fieldType: templateFields.fieldType,
      label: templateFields.label,
      isRequired: templateFields.isRequired,
      page: templateFields.page,
      x: templateFields.x,
      y: templateFields.y,
      width: templateFields.width,
      height: templateFields.height,
      properties: templateFields.properties,
    })
    .from(templateFields)
    .where(eq(templateFields.templateId, id));

  return c.json({ fields: fieldRows.map(toApiTemplateField) });
});

const createTemplateSchema = z.object({
  document_id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
});

app.post("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "templates:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = createTemplateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { document_id, name, description } = parsed.data;

  const db = createD1(c.env.D1);
  const docRows = await db
    .select({
      id: documents.id,
      organizationId: documents.organizationId,
      name: documents.name,
      storageKey: documents.storageKey,
      contentType: documents.contentType,
      size: documents.size,
      pageCount: documents.pageCount,
      status: documents.status,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, document_id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }

  if (!doc.storageKey || doc.size === null || doc.size === undefined) {
    return c.json({ error: "document_missing_storage" }, 400);
  }

  const templateId = crypto.randomUUID();
  await db.insert(templates).values({
    id: templateId,
    publicId: crypto.randomUUID(),
    organizationId,
    createdBy: mcp.sub,
    name,
    description,
    sourceDocumentId: document_id,
    storageKey: doc.storageKey,
    contentType: doc.contentType ?? "application/octet-stream",
    size: doc.size,
    pageCount: doc.pageCount,
    status: "active",
  });

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "template.create",
      resourceType: "template",
      resourceId: templateId,
      metadata: { sourceDocumentId: document_id },
      ...getAuditRequestMeta(c),
    });
  }

  const sourceFields = await db
    .select({
      fieldType: signatureFields.fieldType,
      label: signatureFields.label,
      isRequired: signatureFields.isRequired,
      x: signatureFields.x,
      y: signatureFields.y,
      width: signatureFields.width,
      height: signatureFields.height,
      page: signatureFields.page,
      properties: signatureFields.properties,
    })
    .from(signatureFields)
    .where(eq(signatureFields.documentId, document_id));

  if (sourceFields.length > 0) {
    await db.insert(templateFields).values(
      sourceFields.map((field) => ({
        id: crypto.randomUUID(),
        publicId: crypto.randomUUID(),
        templateId,
        fieldType: field.fieldType,
        label: field.label,
        isRequired: field.isRequired,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        page: field.page,
        properties: field.properties,
      }))
    );
  }

  return c.json({ id: templateId });
});

const updateTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

app.put("/update", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "templates:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = updateTemplateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { id, name, description, status } = parsed.data;

  const db = createD1(c.env.D1);
  const updateValues: {
    name?: string;
    description?: string | null;
    status?: string;
  } = {};
  if (name !== undefined) updateValues.name = name;
  if (description !== undefined) updateValues.description = description ?? null;
  if (status !== undefined) updateValues.status = status;

  await db
    .update(templates)
    .set(updateValues)
    .where(
      and(
        eq(templates.id, id),
        eq(templates.organizationId, organizationId),
        ne(templates.status, "deleted")
      )
    );

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "template.update",
      resourceType: "template",
      resourceId: id,
      metadata: { fields: Object.keys(updateValues) },
      ...getAuditRequestMeta(c),
    });
  }

  return c.json({ success: true });
});

app.delete("/delete", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "templates:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_template_id" }, 400);
  }

  const db = createD1(c.env.D1);
  await db
    .update(templates)
    .set({ status: "deleted" })
    .where(
      and(eq(templates.id, id), eq(templates.organizationId, organizationId))
    );

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "template.delete",
      resourceType: "template",
      resourceId: id,
      metadata: {},
      ...getAuditRequestMeta(c),
    });
  }

  return c.json({ success: true });
});

const useTemplateSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

app.post("/use", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = useTemplateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { id, title, description } = parsed.data;

  const db = createD1(c.env.D1);
  const templateRows = await db
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      storageKey: templates.storageKey,
      contentType: templates.contentType,
      size: templates.size,
      pageCount: templates.pageCount,
    })
    .from(templates)
    .where(
      and(
        eq(templates.id, id),
        eq(templates.organizationId, organizationId),
        eq(templates.status, "active")
      )
    )
    .limit(1);

  const template = templateRows[0];
  if (!template) {
    return c.json({ error: "not_found" }, 404);
  }

  if (
    !template.storageKey ||
    template.size === null ||
    template.size === undefined
  ) {
    return c.json({ error: "template_missing_storage" }, 400);
  }

  const documentId = crypto.randomUUID();
  const now = new Date();
  await db.insert(documents).values({
    id: documentId,
    publicId: crypto.randomUUID(),
    organizationId,
    ownerId: mcp.sub,
    name: title ?? template.name,
    description: description ?? template.description,
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    storageKey: template.storageKey,
    contentType: template.contentType ?? "application/octet-stream",
    size: template.size,
    pageCount: template.pageCount,
    createdAt: now,
    updatedAt: now,
  });

  const templateFieldRows = await db
    .select({
      id: templateFields.id,
      fieldType: templateFields.fieldType,
      label: templateFields.label,
      isRequired: templateFields.isRequired,
      x: templateFields.x,
      y: templateFields.y,
      width: templateFields.width,
      height: templateFields.height,
      page: templateFields.page,
      properties: templateFields.properties,
    })
    .from(templateFields)
    .where(eq(templateFields.templateId, id));

  if (templateFieldRows.length > 0) {
    await db.insert(signatureFields).values(
      templateFieldRows.map((field) => ({
        id: crypto.randomUUID(),
        publicId: crypto.randomUUID(),
        documentId,
        templateFieldId: field.id,
        fieldType: field.fieldType,
        label: field.label ?? "",
        isRequired: field.isRequired,
        isMainSignature: false,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        page: field.page,
        properties: field.properties,
      }))
    );
  }

  await db
    .update(templates)
    .set({ useCount: sql`${templates.useCount} + 1` })
    .where(eq(templates.id, id));

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "template.use",
      resourceType: "template",
      resourceId: id,
      metadata: { documentId },
      ...getAuditRequestMeta(c),
    });
  }

  return c.json({ id: documentId });
});

export default app;
