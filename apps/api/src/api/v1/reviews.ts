import { OpenAPIHono } from "@hono/zod-openapi";

import { createD1 } from "../../global/db.js";
import { createJob, JobError, wakeJobRunner } from "../../platform/jobs.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import {
  getReviewMatrix,
  createReviewMatrix,
  listReviewMatrices,
  ReviewMatrixError,
  writeReviewCells,
} from "../../platform/review-matrix-store.js";
import {
  ZReviewCellsWrite,
  ZReviewMatrixCreate,
} from "../../platform/review-matrix.js";
import { getReviewPack } from "../../platform/review-packs.js";
import { sseResponse } from "../../platform/sse.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

function errorResponse(
  c: {
    json: (body: Record<string, unknown>, status: 400 | 403 | 404) => Response;
  },
  err: unknown
): Response {
  if (err instanceof ReviewMatrixError || err instanceof JobError) {
    return c.json(
      {
        error: err.code,
        ...(err instanceof ReviewMatrixError && err.details
          ? { details: err.details }
          : {}),
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
    // Pack expansion — explicit columns/model override the pack's defaults.
    let columns = parsed.data.columns;
    let model = parsed.data.model;
    if (parsed.data.pack_id) {
      const pack = await getReviewPack(db, organizationId, parsed.data.pack_id);
      if (!pack) {
        return c.json({ error: "pack_not_found" }, 404);
      }
      columns = columns ?? pack.columns;
      model = model ?? pack.model ?? undefined;
    }
    if (!columns || columns.length === 0) {
      return c.json(
        { error: "validation_error", details: { columns: "required" } },
        400
      );
    }
    if (!model) {
      return c.json(
        { error: "validation_error", details: { model: "required" } },
        400
      );
    }

    const matrix = await createReviewMatrix(db, {
      organizationId,
      ownerId: mcp.sub,
      input: { ...parsed.data, columns, model },
    });
    return c.json(matrix, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

/** List matrices (summary rows — no cell fan-out). */
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
  const matrices = await listReviewMatrices(db, organizationId);
  return c.json({ matrices });
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

/**
 * Enqueue a generation job. Generation can be minutes-long across rows ×
 * columns — the JobRunner DO drains it asynchronously; poll the job (or
 * the matrix) for status.
 */
/**
 * Agent-authored cell results — the caller's own model reasons over the
 * row's parsed text and posts answers; Seal grounds each quote against the
 * stored text (ungrounded quotes collapse to not_found) and flips the
 * matrix to ready once every cell resolves. Seal runs no inference here.
 */
app.patch("/:id/cells", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const body = await c.req.json();
  const parsed = ZReviewCellsWrite.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "validation_error", details: parsed.error.flatten() },
      400
    );
  }

  try {
    const result = await writeReviewCells(
      c.env,
      organizationId,
      c.req.param("id"),
      parsed.data.cells,
      parsed.data.model_used
    );
    return c.json(result);
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
    // Guard: matrix must exist + belong to this org before we queue work.
    await getReviewMatrix(db, organizationId, id);
    const job = await createJob(db, {
      organizationId,
      type: "review-generate",
      payload: { matrixId: id },
    });
    await wakeJobRunner(c.env, organizationId);
    return c.json({ job_id: job.publicId, status: job.status }, 202);
  } catch (err) {
    return errorResponse(c, err);
  }
});

/**
 * SSE stream of matrix state — `state` events carry compact cell updates
 * ({id, status, flag, summary?}) on every change; closes when the matrix
 * leaves the `generating` state. `?access_token=` supported.
 */
app.get("/:id/stream", async (c) => {
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
  return sseResponse({
    poll: async () => {
      const matrix = await getReviewMatrix(db, organizationId, id);
      return {
        changed: true,
        terminal: matrix.status !== "generating",
        value: {
          id: matrix.id,
          status: matrix.status,
          cells: matrix.rows.flatMap((row) =>
            row.cells.map((cell) => ({
              id: cell.id,
              row_id: cell.row_id,
              column_index: cell.column_index,
              status: cell.status,
              flag: cell.flag,
              summary: cell.summary,
            }))
          ),
        },
      };
    },
  });
});

export default app;
