import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import {
  acceptAllPendingForDocument,
  acceptRevision,
  createRevision,
  listRevisions,
  rejectRevision,
  RevisionError,
  ZRevisionCreate,
} from "../../platform/revisions.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

function errorResponse(
  c: {
    json: (
      body: Record<string, unknown>,
      status: 400 | 403 | 404 | 409
    ) => Response;
  },
  err: unknown
): Response {
  if (err instanceof RevisionError) {
    return c.json({ error: err.code }, err.status);
  }
  throw err;
}

/** Propose a revision (redline) anchored to a verbatim quote. */
app.post("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const parsed = ZRevisionCreate.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);

  const db = createD1(c.env.D1);
  try {
    const revision = await createRevision(c.env, db, {
      organizationId,
      input: parsed.data,
      createdBy: mcp.kind === "mcp" ? "agent" : "user",
      createdById: mcp.sub,
    });
    return c.json(revision, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

/** List revisions — optional document_id + status filters. */
app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const status = c.req.query("status");
  const db = createD1(c.env.D1);
  const revisions = await listRevisions(
    db,
    organizationId,
    c.req.query("document_id") || undefined,
    status === "pending" || status === "accepted" || status === "rejected"
      ? status
      : undefined
  );
  return c.json({ revisions });
});

/** Accept — applies the edit and materializes a derived draft document. */
/** Accept every pending revision on a document → one derived doc. */
app.post("/accept-all", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }
  const parsed = z
    .object({
      document_id: z.string().min(1),
      output: z.enum(["pdf", "docx"]).optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);
  const db = createD1(c.env.D1);
  try {
    const result = await acceptAllPendingForDocument(
      c.env,
      db,
      organizationId,
      parsed.data.document_id,
      { output: parsed.data.output === "docx" ? "docx" : "pdf" }
    );
    return c.json(result);
  } catch (err) {
    if (err instanceof RevisionError) {
      return c.json({ error: err.code }, err.status);
    }
    throw err;
  }
});

app.post("/:id/accept", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }
  const db = createD1(c.env.D1);
  try {
    const output = c.req.query("output");
    const revision = await acceptRevision(
      c.env,
      db,
      organizationId,
      c.req.param("id"),
      { output: output === "docx" ? "docx" : "pdf" }
    );
    return c.json(revision);
  } catch (err) {
    return errorResponse(c, err);
  }
});

app.post("/:id/reject", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }
  const db = createD1(c.env.D1);
  try {
    const revision = await rejectRevision(
      db,
      organizationId,
      c.req.param("id")
    );
    return c.json(revision);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default app;
