import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { importJobs } from "../../global/schema.js";
import { runImportJob } from "../../platform/import/runner.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

type ApiImportJob = {
  id: string;
  adapter: string;
  status: string;
  payload: unknown;
  processed_count: number;
  total_count: number | null;
  cursor: string | null;
  error: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function formatDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toApiImportJob(row: {
  id: string;
  publicId: string;
  adapter: string;
  status: string;
  payload: string;
  processedCount: number;
  totalCount: number | null;
  cursor: string | null;
  error: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): ApiImportJob {
  return {
    id: row.publicId,
    adapter: row.adapter,
    status: row.status,
    payload: (() => {
      try {
        return JSON.parse(row.payload) as unknown;
      } catch {
        return row.payload;
      }
    })(),
    processed_count: row.processedCount,
    total_count: row.totalCount,
    cursor: row.cursor,
    error: row.error,
    approved_by: row.approvedBy,
    approved_at: formatDate(row.approvedAt),
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

const createBodySchema = z.object({
  adapter: z.enum(["pdf", "docusign", "pandadoc"]),
  payload: z.object({}).passthrough().default({}),
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

  const parseResult = createBodySchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const body = parseResult.data;
  const db = createD1(c.env.D1);
  const now = new Date();

  const [inserted] = await db
    .insert(importJobs)
    .values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId,
      adapter: body.adapter,
      payload: JSON.stringify(body.payload),
      status: "pending_approval",
      processedCount: 0,
      cursor: null,
      error: null,
      approvedBy: null,
      approvedAt: null,
      createdBy: mcp.sub,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    return c.json({ error: "insert_failed" }, 500);
  }

  return c.json({ data: toApiImportJob(inserted) }, 201);
});

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
  const rows = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.organizationId, organizationId))
    .orderBy(desc(importJobs.createdAt));

  return c.json({ data: rows.map(toApiImportJob) });
});

app.get("/:publicId", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const db = createD1(c.env.D1);
  const row = await db.query.importJobs.findFirst({
    where: and(
      eq(importJobs.publicId, c.req.param("publicId")),
      eq(importJobs.organizationId, organizationId)
    ),
  });

  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json({ data: toApiImportJob(row) });
});

app.post("/:publicId/approve", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const publicId = c.req.param("publicId");
  const db = createD1(c.env.D1);

  const row = await db.query.importJobs.findFirst({
    where: and(
      eq(importJobs.publicId, publicId),
      eq(importJobs.organizationId, organizationId)
    ),
  });

  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  if (row.status !== "pending_approval") {
    return c.json({ error: "already_approved_or_running" }, 409);
  }

  await db
    .update(importJobs)
    .set({
      status: "approved",
      approvedBy: mcp.sub,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(importJobs.publicId, publicId));

  try {
    const result = await runImportJob(c.env, publicId, organizationId);
    return c.json({
      data: {
        publicId: result.publicId,
        status: result.status,
        processed_count: result.processedCount,
        total_count: result.totalCount,
        cursor: result.cursor,
        error: result.error,
      },
    });
  } catch (error) {
    await db
      .update(importJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "unknown error",
        updatedAt: new Date(),
      })
      .where(eq(importJobs.publicId, publicId));

    return c.json(
      {
        error: "import_failed",
        message: error instanceof Error ? error.message : "unknown error",
      },
      500
    );
  }
});

app.post("/:publicId/resume", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const publicId = c.req.param("publicId");
  const db = createD1(c.env.D1);

  const row = await db.query.importJobs.findFirst({
    where: and(
      eq(importJobs.publicId, publicId),
      eq(importJobs.organizationId, organizationId)
    ),
  });

  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  if (row.status === "completed" || row.status === "failed") {
    return c.json({ error: "import_not_resumable" }, 409);
  }

  try {
    const result = await runImportJob(c.env, publicId, organizationId);
    return c.json({
      data: {
        publicId: result.publicId,
        status: result.status,
        processed_count: result.processedCount,
        total_count: result.totalCount,
        cursor: result.cursor,
        error: result.error,
      },
    });
  } catch (error) {
    await db
      .update(importJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "unknown error",
        updatedAt: new Date(),
      })
      .where(eq(importJobs.publicId, publicId));

    return c.json(
      {
        error: "import_failed",
        message: error instanceof Error ? error.message : "unknown error",
      },
      500
    );
  }
});

export default app;
