import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

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

export default app;
