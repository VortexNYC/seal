import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, inArray } from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import { documents, recipients, signatures } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashSignature(value: string): Promise<string> {
  return sha256Hex(value);
}

type ApiSignature = {
  id: string;
  field_id: string;
  recipient_id: string;
  document_id: string;
  value?: string;
  signature_image_url?: string;
  signature_method: string;
  signed_at: string;
  ip_address?: string;
  user_agent?: string;
};

type ApiAuditEntry = {
  id: string;
  event_type: string;
  actor_email?: string;
  actor_name?: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
};

function toApiSignature(row: {
  id: string;
  fieldId: string | null;
  recipientId: string;
  documentId: string;
  value: string | null;
  signatureImageUrl: string | null;
  signatureMethod: string | null;
  signedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
}): ApiSignature {
  return {
    id: row.id,
    field_id: row.fieldId ?? "",
    recipient_id: row.recipientId,
    document_id: row.documentId,
    ...(row.value ? { value: row.value } : {}),
    ...(row.signatureImageUrl
      ? { signature_image_url: row.signatureImageUrl }
      : {}),
    signature_method: row.signatureMethod ?? "draw",
    signed_at: row.signedAt
      ? row.signedAt.toISOString()
      : new Date().toISOString(),
    ...(row.ipAddress ? { ip_address: row.ipAddress } : {}),
    ...(row.userAgent ? { user_agent: row.userAgent } : {}),
  };
}

async function verifyDocumentOwnership(
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
  if (!mcpHasScope(mcp, "signatures:read")) {
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
  if (!(await verifyDocumentOwnership(db, documentId, organizationId))) {
    return c.json({ error: "not_found" }, 404);
  }

  const rows = await db
    .select({
      id: signatures.id,
      fieldId: signatures.fieldId,
      recipientId: signatures.recipientId,
      documentId: signatures.documentId,
      value: signatures.value,
      signatureImageUrl: signatures.signatureImageUrl,
      signatureMethod: signatures.signatureMethod,
      signedAt: signatures.signedAt,
      ipAddress: signatures.ipAddress,
      userAgent: signatures.userAgent,
    })
    .from(signatures)
    .where(eq(signatures.documentId, documentId));

  return c.json({ signatures: rows.map(toApiSignature) });
});

app.get("/get", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "signatures:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const documentId = c.req.query("document_id");
  const id = c.req.query("id");
  if (!documentId || !id) {
    return c.json({ error: "missing_document_id_or_signature_id" }, 400);
  }

  const db = createD1(c.env.D1);
  if (!(await verifyDocumentOwnership(db, documentId, organizationId))) {
    return c.json({ error: "not_found" }, 404);
  }

  const rows = await db
    .select({
      id: signatures.id,
      fieldId: signatures.fieldId,
      recipientId: signatures.recipientId,
      documentId: signatures.documentId,
      value: signatures.value,
      signatureImageUrl: signatures.signatureImageUrl,
      signatureMethod: signatures.signatureMethod,
      signedAt: signatures.signedAt,
      ipAddress: signatures.ipAddress,
      userAgent: signatures.userAgent,
    })
    .from(signatures)
    .where(and(eq(signatures.id, id), eq(signatures.documentId, documentId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(toApiSignature(row));
});

app.get("/verify", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "signatures:read")) {
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
  if (!(await verifyDocumentOwnership(db, documentId, organizationId))) {
    return c.json({ error: "not_found" }, 404);
  }

  const rows = await db
    .select({
      id: signatures.id,
      recipientId: signatures.recipientId,
      value: signatures.value,
      signatureHash: signatures.signatureHash,
      signedAt: signatures.signedAt,
      signatureMethod: signatures.signatureMethod,
      ipAddress: signatures.ipAddress,
      userAgent: signatures.userAgent,
    })
    .from(signatures)
    .where(eq(signatures.documentId, documentId));

  const recipientIds = rows.map((r) => r.recipientId);
  const recipientRows =
    recipientIds.length > 0
      ? await db
          .select({
            id: recipients.id,
            email: recipients.email,
            name: recipients.name,
          })
          .from(recipients)
          .where(inArray(recipients.id, recipientIds))
      : [];
  const recipientById = new Map(
    recipientRows.map((r) => [r.id, { email: r.email, name: r.name }])
  );

  const signatureResults = await Promise.all(
    rows.map(async (row) => {
      const value = row.value ?? "";
      const computedHash = await hashSignature(value);
      const isValid = row.signatureHash
        ? computedHash === row.signatureHash
        : true;
      const recipient = recipientById.get(row.recipientId);
      return {
        id: row.id,
        recipient_email: recipient?.email ?? "",
        is_valid: isValid,
        signed_at: row.signedAt
          ? row.signedAt.toISOString()
          : new Date().toISOString(),
        signature_hash: row.signatureHash ?? computedHash,
      };
    })
  );

  const sortedHashes = signatureResults
    .map((s) => s.signature_hash)
    .toSorted()
    .join("");
  const documentHash = await sha256Hex(sortedHashes + documentId);

  const allValid = signatureResults.every((s) => s.is_valid);

  return c.json({
    is_valid: allValid,
    document_hash: documentHash,
    signatures: signatureResults,
    verification_timestamp: new Date().toISOString(),
  });
});

app.get("/audit", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "signatures:read")) {
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
  if (!(await verifyDocumentOwnership(db, documentId, organizationId))) {
    return c.json({ error: "not_found" }, 404);
  }

  const rawLimit = Number.parseInt(c.req.query("limit") ?? "20", 10);
  const limit = Number.isNaN(rawLimit)
    ? 20
    : Math.min(Math.max(rawLimit, 1), 100);

  const rows = await db
    .select({
      id: signatures.id,
      recipientId: signatures.recipientId,
      value: signatures.value,
      signatureImageUrl: signatures.signatureImageUrl,
      signatureMethod: signatures.signatureMethod,
      signedAt: signatures.signedAt,
      ipAddress: signatures.ipAddress,
      userAgent: signatures.userAgent,
    })
    .from(signatures)
    .where(eq(signatures.documentId, documentId))
    .limit(limit);

  const recipientIds = rows.map((r) => r.recipientId);
  const recipientRows =
    recipientIds.length > 0
      ? await db
          .select({
            id: recipients.id,
            email: recipients.email,
            name: recipients.name,
          })
          .from(recipients)
          .where(inArray(recipients.id, recipientIds))
      : [];
  const recipientById = new Map(
    recipientRows.map((r) => [r.id, { email: r.email, name: r.name }])
  );

  const entries: ApiAuditEntry[] = rows.map((row) => {
    const recipient = recipientById.get(row.recipientId);
    const entry: ApiAuditEntry = {
      id: row.id,
      event_type: "document.signed",
      actor_email: recipient?.email,
      actor_name: recipient?.name ?? undefined,
      timestamp: row.signedAt
        ? row.signedAt.toISOString()
        : new Date().toISOString(),
      details: {
        signature_method: row.signatureMethod ?? undefined,
      },
    };
    if (row.ipAddress) {
      entry.ip_address = row.ipAddress;
    }
    if (row.userAgent) {
      entry.user_agent = row.userAgent;
    }
    return entry;
  });

  return c.json({ entries });
});

export default app;
