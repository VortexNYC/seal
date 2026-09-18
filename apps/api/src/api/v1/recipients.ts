import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, ne } from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { documents, recipients } from "../../global/schema.js";
import {
  getAuditActor,
  getAuditRequestMeta,
  writeAuditLog,
} from "../../platform/audit-log.js";
import { buildSigningUrl, type EmailEnv } from "../../platform/email.js";
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
  signing_url?: string;
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

function resolveRecipientIds(
  query: Record<string, string>,
  rawBody?: unknown
): { documentId: string | null; recipientId: string | null } {
  const documentId =
    (typeof query.document_id === "string" && query.document_id.length > 0
      ? query.document_id
      : undefined) ??
    (isRecord(rawBody) && typeof rawBody.document_id === "string"
      ? rawBody.document_id
      : undefined) ??
    null;
  const recipientId =
    (typeof query.id === "string" && query.id.length > 0
      ? query.id
      : undefined) ??
    (isRecord(rawBody) && typeof rawBody.id === "string"
      ? rawBody.id
      : undefined) ??
    null;
  return { documentId, recipientId };
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

function toApiRecipient(
  row: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    order: number | null;
    status: string;
    signingToken: string | null;
    viewedAt: Date | null;
    signedAt: Date | null;
    approvedAt: Date | null;
    declinedAt: Date | null;
    signatureData: string | null;
  },
  env?: Pick<EmailEnv, "APP_URL">,
  includeSigningUrl = false
): ApiRecipient {
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
    ...(includeSigningUrl && row.signingToken && env
      ? { signing_url: buildSigningUrl(env, row.signingToken) }
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
      signingToken: recipients.signingToken,
    })
    .from(recipients)
    .where(eq(recipients.documentId, documentId));

  const includeSigningUrl = mcpHasScope(mcp, "documents:write");
  return c.json({
    recipients: rows.map((r) => toApiRecipient(r, c.env, includeSigningUrl)),
  });
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
      signingToken: recipients.signingToken,
    })
    .from(recipients)
    .where(and(eq(recipients.documentId, documentId), eq(recipients.id, id)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(
    toApiRecipient(row, c.env, mcpHasScope(mcp, "documents:write"))
  );
});

const createRecipientSchema = z.object({
  document_id: z.string().optional(),
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

  const documentId = c.req.query("document_id") ?? parsed.data.document_id;
  if (!documentId) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const { email, name, role, order } = parsed.data;

  const db = createD1(c.env.D1);
  const documentRows = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
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
    documentId,
    email,
    name,
    role,
    order: order ?? 0,
    status: "pending",
  });

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "recipient.added",
      resourceType: "recipient",
      resourceId: recipientId,
      metadata: { documentId, role },
      ...getAuditRequestMeta(c),
    });
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
      signingToken: recipients.signingToken,
    })
    .from(recipients)
    .where(eq(recipients.id, recipientId))
    .limit(1);

  return c.json(
    toApiRecipient(rows[0]!, c.env, mcpHasScope(mcp, "documents:write"))
  );
});

const updateRecipientBodySchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(["signer", "viewer", "approver"]).optional(),
  order: z.number().int().nonnegative().optional(),
});

async function handleUpdateRecipient(
  c: Context<{
    Bindings: CloudflareBindings;
    Variables: { mcp: McpAccessToken };
  }>
) {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const { documentId, recipientId } = resolveRecipientIds(
    c.req.query(),
    rawBody
  );
  if (!documentId || !recipientId) {
    return c.json({ error: "missing_document_id_or_recipient_id" }, 400);
  }

  const parsed = updateRecipientBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { email, name, role, order } = parsed.data;

  const db = createD1(c.env.D1);
  const documentRows = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
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
      and(eq(recipients.id, recipientId), eq(recipients.documentId, documentId))
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
      signingToken: recipients.signingToken,
    })
    .from(recipients)
    .where(
      and(eq(recipients.id, recipientId), eq(recipients.documentId, documentId))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "recipient.updated",
      resourceType: "recipient",
      resourceId: recipientId,
      metadata: { documentId, fields: Object.keys(updateValues) },
      ...getAuditRequestMeta(c),
    });
  }

  return c.json(
    toApiRecipient(row, c.env, mcpHasScope(mcp, "documents:write"))
  );
}

app.post("/update", async (c) => handleUpdateRecipient(c));
app.put("/update", async (c) => handleUpdateRecipient(c));

async function handleDeleteRecipient(
  c: Context<{
    Bindings: CloudflareBindings;
    Variables: { mcp: McpAccessToken };
  }>
) {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  let rawBody: unknown = undefined;
  if (c.req.method !== "DELETE") {
    try {
      rawBody = await c.req.json();
    } catch {
      // ignore empty body
    }
  }

  const { documentId, recipientId } = resolveRecipientIds(
    c.req.query(),
    rawBody
  );
  if (!documentId || !recipientId) {
    return c.json({ error: "missing_document_id_or_recipient_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const documentRows = await db
    .select({ status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
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
    .where(
      and(eq(recipients.id, recipientId), eq(recipients.documentId, documentId))
    );

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "recipient.removed",
      resourceType: "recipient",
      resourceId: recipientId,
      metadata: { documentId },
      ...getAuditRequestMeta(c),
    });
  }

  return c.json({ success: true });
}

app.post("/delete", async (c) => handleDeleteRecipient(c));
app.delete("/delete", async (c) => handleDeleteRecipient(c));

async function handleRemindRecipient(
  c: Context<{
    Bindings: CloudflareBindings;
    Variables: { mcp: McpAccessToken };
  }>
) {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  let rawBody: unknown = undefined;
  try {
    rawBody = await c.req.json();
  } catch {
    // ignore empty body
  }

  const { documentId, recipientId } = resolveRecipientIds(
    c.req.query(),
    rawBody
  );
  if (!documentId || !recipientId) {
    return c.json({ error: "missing_document_id_or_recipient_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const documentRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
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
    .where(
      and(eq(recipients.id, recipientId), eq(recipients.documentId, documentId))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  if (row.status !== "pending") {
    return c.json({ error: "recipient_not_pending" }, 400);
  }

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "recipient.reminded",
      resourceType: "recipient",
      resourceId: recipientId,
      metadata: { documentId },
      ...getAuditRequestMeta(c),
    });
  }

  return c.json({ success: true });
}

app.post("/remind", async (c) => handleRemindRecipient(c));

export default app;
