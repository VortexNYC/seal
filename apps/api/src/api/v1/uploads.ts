import { OpenAPIHono } from "@hono/zod-openapi";

import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import { createUploadToken, verifyUploadToken } from "./upload-token.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

app.post("/generate-url", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const token = await createUploadToken(c.env, {
    userId: mcp.sub,
    organizationId,
  });
  if (!token) {
    return c.json({ error: "server_error" }, 503);
  }

  const origin = new URL(c.req.url).origin;
  const uploadUrl = `${origin}/api/v1/uploads?token=${encodeURIComponent(token)}`;
  return c.json({ upload_url: uploadUrl });
});

app.post("/", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "missing_token" }, 401);
  }

  const payload = await verifyUploadToken(c.env, token);
  if (!payload) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const body = c.req.raw.body;
  if (!body) {
    return c.json({ error: "empty_body" }, 400);
  }

  const contentType =
    c.req.header("content-type") ?? "application/octet-stream";
  const storageId = `uploads/${crypto.randomUUID()}`;

  await c.env.DOCUMENTS_BUCKET.put(storageId, body, {
    httpMetadata: { contentType },
    customMetadata: {
      organizationId: payload.organizationId,
      uploadedBy: payload.sub,
    },
  });

  return c.json({ storageId });
});

export default app;
