import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { documents, recipients } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

type ApiRecipient = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  order?: number;
  signed_at?: string;
  viewed_at?: string;
  declined_at?: string;
  decline_reason?: string;
};

function formatDate(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDeclineReason(signatureData: string | null): string | undefined {
  if (!signatureData) return undefined;
  try {
    const parsed = JSON.parse(signatureData) as unknown;
    if (isRecord(parsed) && typeof parsed.declineReason === "string") {
      return parsed.declineReason;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function toApiRecipient(row: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  order: number | null;
  status: string;
  viewedAt: Date | null;
  signedAt: Date | null;
  approvedAt: Date | null;
  declinedAt: Date | null;
  signatureData: string | null;
}): ApiRecipient {
  const declineReason = parseDeclineReason(row.signatureData);
  const signedAt = row.signedAt ?? row.approvedAt ?? undefined;
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? "",
    role: row.role,
    status: row.status,
    ...(row.order !== null && row.order !== undefined
      ? { order: row.order }
      : {}),
    ...(row.viewedAt ? { viewed_at: formatDate(row.viewedAt) } : {}),
    ...(signedAt ? { signed_at: formatDate(signedAt) } : {}),
    ...(row.declinedAt ? { declined_at: formatDate(row.declinedAt) } : {}),
    ...(declineReason ? { decline_reason: declineReason } : {}),
  };
}

async function requireDocumentInOrganization(
  db: ReturnType<typeof createD1>,
  documentId: string,
  organizationId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);
  return rows.length > 0;
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

  const documentId = c.req.query("document_id");
  if (!documentId) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const allowed = await requireDocumentInOrganization(
    db,
    documentId,
    organizationId
  );
  if (!allowed) {
    return c.json({ error: "not_found" }, 404);
  }

  const rows = await db
    .select({
      id: recipients.id,
      email: recipients.email,
      name: recipients.name,
      role: recipients.role,
      order: recipients.order,
      status: recipients.status,
      viewedAt: recipients.viewedAt,
      signedAt: recipients.signedAt,
      approvedAt: recipients.approvedAt,
      declinedAt: recipients.declinedAt,
      signatureData: recipients.signatureData,
    })
    .from(recipients)
    .where(eq(recipients.documentId, documentId));

  return c.json({ recipients: rows.map(toApiRecipient) });
});

app.get("/get", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const query = c.req.query();
  const documentId = query.document_id;
  const id = query.id;
  if (!documentId || !id) {
    return c.json({ error: "missing_document_id_or_recipient_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const allowed = await requireDocumentInOrganization(
    db,
    documentId,
    organizationId
  );
  if (!allowed) {
    return c.json({ error: "not_found" }, 404);
  }

  const rows = await db
    .select({
      id: recipients.id,
      email: recipients.email,
      name: recipients.name,
      role: recipients.role,
      order: recipients.order,
      status: recipients.status,
      viewedAt: recipients.viewedAt,
      signedAt: recipients.signedAt,
      approvedAt: recipients.approvedAt,
      declinedAt: recipients.declinedAt,
      signatureData: recipients.signatureData,
    })
    .from(recipients)
    .where(and(eq(recipients.documentId, documentId), eq(recipients.id, id)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(toApiRecipient(row));
});

const createRecipientSchema = z.object({
  document_id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["signer", "viewer", "approver"]).default("signer"),
  order: z.number().int().nonnegative().optional(),
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

  const rawBody: unknown = await c.req.json();
  const parsed = createRecipientSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { document_id, email, name, role, order } = parsed.data;

  const db = createD1(c.env.D1);
  const documentRows = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, document_id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  const document = documentRows[0];
  if (!document) {
    return c.json({ error: "not_found" }, 404);
  }
  if (document.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  const recipientId = crypto.randomUUID();
  await db.insert(recipients).values({
    id: recipientId,
    publicId: crypto.randomUUID(),
    documentId: document_id,
    email,
    name,
    role,
    order: order ?? 0,
    status: "pending",
  });

  const rows = await db
    .select({
      id: recipients.id,
      email: recipients.email,
      name: recipients.name,
      role: recipients.role,
      order: recipients.order,
      status: recipients.status,
      viewedAt: recipients.viewedAt,
      signedAt: recipients.signedAt,
      approvedAt: recipients.approvedAt,
      declinedAt: recipients.declinedAt,
      signatureData: recipients.signatureData,
    })
    .from(recipients)
    .where(eq(recipients.id, recipientId))
    .limit(1);

  return c.json(toApiRecipient(rows[0]!));
});

const updateRecipientSchema = z.object({
  document_id: z.string(),
  id: z.string(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(["signer", "viewer", "approver"]).optional(),
  order: z.number().int().nonnegative().optional(),
});

app.post("/update", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = updateRecipientSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { document_id, id, email, name, role, order } = parsed.data;

  const db = createD1(c.env.D1);
  const documentRows = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, document_id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  const document = documentRows[0];
  if (!document) {
    return c.json({ error: "not_found" }, 404);
  }
  if (document.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  const updateValues: {
    email?: string;
    name?: string;
    role?: string;
    order?: number;
  } = {};
  if (email !== undefined) updateValues.email = email;
  if (name !== undefined) updateValues.name = name;
  if (role !== undefined) updateValues.role = role;
  if (order !== undefined) updateValues.order = order;

  await db
    .update(recipients)
    .set(updateValues)
    .where(
      and(eq(recipients.id, id), eq(recipients.documentId, document_id))
    );

  const rows = await db
    .select({
      id: recipients.id,
      email: recipients.email,
      name: recipients.name,
      role: recipients.role,
      order: recipients.order,
      status: recipients.status,
      viewedAt: recipients.viewedAt,
      signedAt: recipients.signedAt,
      approvedAt: recipients.approvedAt,
      declinedAt: recipients.declinedAt,
      signatureData: recipients.signatureData,
    })
    .from(recipients)
    .where(and(eq(recipients.id, id), eq(recipients.documentId, document_id)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(toApiRecipient(row));
});

const recipientIdSchema = z.object({
  document_id: z.string(),
  id: z.string(),
});

app.post("/delete", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = recipientIdSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { document_id, id } = parsed.data;

  const db = createD1(c.env.D1);
  const documentRows = await db
    .select({ status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, document_id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  const document = documentRows[0];
  if (!document) {
    return c.json({ error: "not_found" }, 404);
  }
  if (document.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  await db
    .delete(recipients)
    .where(and(eq(recipients.id, id), eq(recipients.documentId, document_id)));

  return c.json({ success: true });
});

app.post("/remind", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = recipientIdSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { document_id, id } = parsed.data;

  const db = createD1(c.env.D1);
  const documentRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, document_id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  if (documentRows.length === 0) {
    return c.json({ error: "not_found" }, 404);
  }

  const rows = await db
    .select({ id: recipients.id, status: recipients.status })
    .from(recipients)
    .where(and(eq(recipients.id, id), eq(recipients.documentId, document_id)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  if (row.status !== "pending") {
    return c.json({ error: "recipient_not_pending" }, 400);
  }

  return c.json({ success: true });
});

export default app;
