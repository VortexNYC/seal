import { OpenAPIHono } from "@hono/zod-openapi";

import { createD1 } from "../../global/db.js";
import { getJob, JobError, toApiJob } from "../../platform/jobs.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

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

export default app;
