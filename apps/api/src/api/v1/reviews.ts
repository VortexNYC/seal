import { OpenAPIHono } from "@hono/zod-openapi";

import { createD1 } from "../../global/db.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import {
  generateReviewMatrix,
  getReviewMatrix,
  createReviewMatrix,
  ReviewMatrixError,
} from "../../platform/review-matrix-store.js";
import { ZReviewMatrixCreate } from "../../platform/review-matrix.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

function errorResponse(
  c: {
    json: (
      body: Record<string, unknown>,
      status: 400 | 403 | 404
    ) => Response;
  },
  err: unknown
): Response {
  if (err instanceof ReviewMatrixError) {
    return c.json(
      {
        error: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
      err.status
    );
  }
  throw err;
}

app.post("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const body = await c.req.json();
  const parsed = ZReviewMatrixCreate.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", details: parsed.error.flatten() },
      400
    );
  }

  const db = createD1(c.env.D1);
  try {
    const matrix = await createReviewMatrix(db, {
      organizationId,
      ownerId: mcp.sub,
      input: parsed.data,
    });
    return c.json(matrix, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
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

  const id = c.req.param("id");
  const db = createD1(c.env.D1);
  try {
    const matrix = await getReviewMatrix(db, organizationId, id);
    return c.json(matrix);
  } catch (err) {
    return errorResponse(c, err);
  }
});

app.post("/:id/generate", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.param("id");
  const db = createD1(c.env.D1);
  try {
    const matrix = await generateReviewMatrix(
      db,
      c.env,
      organizationId,
      id
    );
    return c.json(matrix);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default app;
