import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import { searchOrganization } from "../../platform/search/index.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

const querySchema = z.object({
  q: z.string().min(1),
  types: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      return value
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is "document" | "contact" | "template" =>
          ["document", "contact", "template"].includes(s)
        );
    }),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
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

  const query = c.req.query("q");
  const types = c.req.query("types");
  const limit = c.req.query("limit");

  const parseResult = querySchema.safeParse({
    q: query,
    types,
    limit,
  });

  if (!parseResult.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const { q, types: parsedTypes, limit: parsedLimit } = parseResult.data;

  const results = await searchOrganization(c.env, organizationId, mcp.sub, {
    query: q,
    types: parsedTypes,
    limit: parsedLimit,
  });

  return c.json({ data: results });
});

export default app;
