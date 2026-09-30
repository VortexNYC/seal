/**
 * Session-facing review routes for the web app — same store/queue as the
 * MCP surface (`/api/v1/reviews`), just session+slug auth instead of Bearer.
 * Mounted at /api/reviews — paths carry the org slug, e.g.
 * GET /api/reviews/{slug}, POST /api/reviews/{slug}, GET
 * /api/reviews/{slug}/{matrixId}/stream.
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { createJob, JobError, wakeJobRunner } from "../platform/jobs.js";
import { organizationMiddleware } from "../platform/organization-middleware.js";
import {
  createReviewMatrix,
  getReviewMatrix,
  listReviewMatrices,
  ReviewMatrixError,
} from "../platform/review-matrix-store.js";
import { ZReviewMatrixCreate } from "../platform/review-matrix.js";
import {
  createReviewPack,
  deleteReviewPack,
  getReviewPack,
  listReviewPacks,
  ReviewPackError,
  ZReviewPackCreate,
} from "../platform/review-packs.js";
import {
  acceptRevision,
  createRevision,
  listRevisions,
  rejectRevision,
  RevisionError,
  ZRevisionCreate,
} from "../platform/revisions.js";
import { sseResponse } from "../platform/sse.js";
import type { Variables } from "../platform/types.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use("/:slug/*", organizationMiddleware);
app.use("/:slug", organizationMiddleware);

function errorResponse(
  c: {
    json: (
      body: Record<string, unknown>,
      status: 400 | 403 | 404 | 409 | 422
    ) => Response;
  },
  err: unknown
): Response {
  if (
    err instanceof ReviewMatrixError ||
    err instanceof RevisionError ||
    err instanceof ReviewPackError ||
    err instanceof JobError
  ) {
    return c.json({ error: err.code }, err.status);
  }
  throw err;
}

function orgId(c: { get: (key: "organization") => { id: string } }): string {
  return c.get("organization").id;
}
function userId(c: {
  get: (key: "user") => { user: { id: string } } | null;
}): string {
  const u = c.get("user");
  return u?.user.id ?? "";
}

// ── Matrices ────────────────────────────────────────────────────────────

app.get("/:slug", async (c) => {
  const db = createD1(c.env.D1);
  const matrices = await listReviewMatrices(db, orgId(c));
  return c.json({ matrices });
});

app.post("/:slug", async (c) => {
  const parsed = ZReviewMatrixCreate.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);

  const db = createD1(c.env.D1);
  const organizationId = orgId(c);
  try {
    let columns = parsed.data.columns;
    let model = parsed.data.model;
    if (parsed.data.pack_id) {
      const pack = await getReviewPack(db, organizationId, parsed.data.pack_id);
      if (!pack) return c.json({ error: "pack_not_found" }, 404);
      columns = columns ?? pack.columns;
      model = model ?? pack.model ?? undefined;
    }
    if (!columns?.length || !model) {
      return c.json({ error: "validation_error" }, 400);
    }
    const matrix = await createReviewMatrix(db, {
      organizationId,
      ownerId: userId(c),
      input: { ...parsed.data, columns, model },
    });
    return c.json(matrix, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ── Packs ───────────────────────────────────────────────────────────────

app.get("/:slug/packs", async (c) => {
  const db = createD1(c.env.D1);
  return c.json({ packs: await listReviewPacks(db, orgId(c)) });
});

app.post("/:slug/packs", async (c) => {
  const parsed = ZReviewPackCreate.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);
  const db = createD1(c.env.D1);
  const pack = await createReviewPack(db, orgId(c), parsed.data);
  return c.json(pack, 201);
});

app.delete("/:slug/packs/:packId", async (c) => {
  const db = createD1(c.env.D1);
  try {
    await deleteReviewPack(db, orgId(c), c.req.param("packId"));
    return c.json({ deleted: true });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ── Revisions ───────────────────────────────────────────────────────────

const docIdQuery = z.object({ document_id: z.string().optional() });

app.get("/:slug/revisions", async (c) => {
  const q = docIdQuery.safeParse({ document_id: c.req.query("document_id") });
  const status = c.req.query("status");
  const db = createD1(c.env.D1);
  const revisions = await listRevisions(
    db,
    orgId(c),
    q.success ? q.data.document_id : undefined,
    status === "pending" || status === "accepted" || status === "rejected"
      ? status
      : undefined
  );
  return c.json({ revisions });
});

app.post("/:slug/revisions", async (c) => {
  const parsed = ZRevisionCreate.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);
  const db = createD1(c.env.D1);
  try {
    const revision = await createRevision(c.env, db, {
      organizationId: orgId(c),
      input: parsed.data,
      createdBy: "user",
      createdById: userId(c),
    });
    return c.json(revision, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

app.post("/:slug/revisions/:revId/accept", async (c) => {
  const db = createD1(c.env.D1);
  const output = c.req.query("output");
  try {
    const revision = await acceptRevision(
      c.env,
      db,
      orgId(c),
      c.req.param("revId"),
      { output: output === "docx" ? "docx" : "pdf" }
    );
    return c.json(revision);
  } catch (err) {
    return errorResponse(c, err);
  }
});

app.post("/:slug/revisions/:revId/reject", async (c) => {
  const db = createD1(c.env.D1);
  try {
    const revision = await rejectRevision(db, orgId(c), c.req.param("revId"));
    return c.json(revision);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default app;
app.get("/:slug/:id", async (c) => {
  const db = createD1(c.env.D1);
  try {
    return c.json(await getReviewMatrix(db, orgId(c), c.req.param("id")));
  } catch (err) {
    return errorResponse(c, err);
  }
});

app.post("/:slug/:id/generate", async (c) => {
  const db = createD1(c.env.D1);
  const organizationId = orgId(c);
  try {
    await getReviewMatrix(db, organizationId, c.req.param("id"));
    const job = await createJob(db, {
      organizationId,
      type: "review-generate",
      payload: { matrixId: c.req.param("id") },
    });
    await wakeJobRunner(c.env, organizationId);
    return c.json({ job_id: job.publicId, status: job.status }, 202);
  } catch (err) {
    return errorResponse(c, err);
  }
});

/** SSE — same snapshot shape as /api/v1/reviews/:id/stream, session auth. */
app.get("/:slug/:id/stream", async (c) => {
  const db = createD1(c.env.D1);
  const organizationId = orgId(c);
  const id = c.req.param("id");
  return sseResponse({
    poll: async () => {
      const matrix = await getReviewMatrix(db, organizationId, id);
      return {
        changed: true,
        terminal: matrix.status !== "generating" && matrix.status !== "draft",
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
