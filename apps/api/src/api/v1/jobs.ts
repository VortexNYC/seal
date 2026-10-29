import { OpenAPIHono } from "@hono/zod-openapi";

import { createD1 } from "../../global/db.js";
import { getJob, JobError, listJobs, toApiJob } from "../../platform/jobs.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import { sseResponse } from "../../platform/sse.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

/** List jobs — newest first. `?status=` filters; `?limit=` caps (≤100). */
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
  const limitParam = Number(c.req.query("limit"));
  const rows = await listJobs(db, organizationId, {
    status: c.req.query("status"),
    limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50,
  });
  return c.json({ jobs: rows.map(toApiJob) });
});

/** Poll a job's status + result. Jobs are created by long-running ops. */
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
  try {
    const job = await getJob(db, organizationId, c.req.param("id"));
    return c.json(toApiJob(job));
  } catch (err) {
    if (err instanceof JobError) {
      return c.json({ error: err.code }, err.status);
    }
    throw err;
  }
});

/**
 * SSE stream of job state — `state` events carry the full job payload on
 * every change, `:hb` heartbeats, closes on done/error. Accepts
 * `?access_token=` (EventSource can't set Authorization).
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

  const db = createD1(c.env.D1);
  const id = c.req.param("id");
  return sseResponse({
    poll: async () => {
      const job = await getJob(db, organizationId, id);
      const api = toApiJob(job);
      return {
        changed: true,
        terminal: job.status === "done" || job.status === "error",
        value: api,
      };
    },
  });
});

export default app;
