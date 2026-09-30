import { OpenAPIHono } from "@hono/zod-openapi";

import { createD1 } from "../../global/db.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import {
  createReviewPack,
  deleteReviewPack,
  getReviewPack,
  listReviewPacks,
  ReviewPackError,
  ZReviewPackCreate,
} from "../../platform/review-packs.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

function errorResponse(
  c: { json: (body: Record<string, unknown>, status: 400 | 404) => Response },
  err: unknown
): Response {
  if (err instanceof ReviewPackError) {
    return c.json({ error: err.code }, err.status);
  }
  throw err;
}

/** List packs — builtins + org-authored. */
app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }
  const db = createD1(c.env.D1);
  return c.json({ packs: await listReviewPacks(db, organizationId) });
});

app.get("/:id", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }
  const db = createD1(c.env.D1);
  const pack = await getReviewPack(db, organizationId, c.req.param("id"));
  if (!pack) return c.json({ error: "not_found" }, 404);
  return c.json(pack);
});

/** Create an org-authored pack. */
app.post("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }
  const parsed = ZReviewPackCreate.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);
  const db = createD1(c.env.D1);
  const pack = await createReviewPack(db, organizationId, parsed.data);
  return c.json(pack, 201);
});

app.delete("/:id", async (c) => {
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
    await deleteReviewPack(db, organizationId, c.req.param("id"));
    return c.json({ deleted: true });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default app;
