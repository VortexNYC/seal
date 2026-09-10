import { OpenAPIHono } from "@hono/zod-openapi";
import { routeAgentRequest } from "agents";
import { cors } from "hono/cors";

import { authenticateAgentConnection } from "./agents/auth.js";
import { SealChatAgent } from "./agents/seal-chat-agent.js";
import activity from "./api/activity.js";
import ai from "./api/ai.js";
import analytics from "./api/analytics.js";
import contacts from "./api/contacts.js";
import documents from "./api/documents.js";
import feedback from "./api/feedback.js";
import folders from "./api/folders.js";
import mcpOauth, { buildAuthorizationServerMetadata } from "./api/mcp-oauth.js";
import notifications from "./api/notifications.js";
import organizations from "./api/organizations.js";
import publicApi from "./api/public.js";
import savedSignatures from "./api/saved-signatures.js";
import users from "./api/users.js";
import accountV1 from "./api/v1/account.js";
import contactsV1 from "./api/v1/contacts.js";
import documentsV1 from "./api/v1/documents.js";
import recipientsV1 from "./api/v1/recipients.js";
import uploadsV1 from "./api/v1/uploads.js";
import { createAuth } from "./platform/auth.js";
import {
  verifyMcpAccessToken,
  type McpAccessToken,
} from "./platform/mcp-auth.js";
import { getSessionUser, type SessionUser } from "./platform/session.js";

type Variables = {
  auth: ReturnType<typeof createAuth>;
  user: SessionUser | null;
  mcp?: McpAccessToken;
};

interface Env extends CloudflareBindings {
  SealChatAgent: DurableObjectNamespace<SealChatAgent>;
}

const app = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Agent WebSocket/HTTP routing runs before CORS and the auth middleware so
// that `routeAgentRequest` can handle `/agents/...` upgrades directly.
app.use("*", async (c, next) => {
  if (!c.req.path.startsWith("/agents/")) {
    return next();
  }

  const agentResponse = await routeAgentRequest(c.req.raw, c.env, {
    prefix: "agents",
    onBeforeConnect: async (req, lobby) => {
      const authResult = await authenticateAgentConnection(
        req,
        lobby.name,
        c.env
      );
      return authResult ?? req;
    },
    onBeforeRequest: async (req, lobby) => {
      const authResult = await authenticateAgentConnection(
        req,
        lobby.name,
        c.env
      );
      return authResult ?? req;
    },
  });

  if (agentResponse) {
    return agentResponse;
  }

  return next();
});

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = c.env.ALLOWED_ORIGINS?.split(",") ?? [];
      return allowed.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(async (c, next) => {
  c.set("auth", createAuth(c.env));
  c.set("user", await getSessionUser(c.env, c.req.raw));
  await next();
});

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Vortex Sign API",
    version: "0.0.1",
    description: "Agent-native e-signature platform on Cloudflare Workers.",
  },
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/.well-known/oauth-authorization-server/seal-mcp", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(buildAuthorizationServerMetadata(origin));
});

app.all("/api/auth/*", (c) => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
});

app.route("/api/activity", activity);
app.route("/api/ai", ai);
app.route("/api/analytics", analytics);
app.route("/api/contacts", contacts);
app.route("/api/documents", documents);
app.route("/api/feedback", feedback);
app.route("/api/folders", folders);
app.route("/oauth/seal-mcp", mcpOauth);
app.route("/api/notifications", notifications);
app.route("/api/organizations", organizations);
app.route("/api/public", publicApi);
app.route("/api/saved-signatures", savedSignatures);
app.route("/api/users", users);

app.use("/api/v1/*", async (c, next) => {
  if (c.req.path === "/api/v1/uploads" && c.req.method === "POST") {
    return next();
  }

  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = header.slice("Bearer ".length).trim();
  const payload = await verifyMcpAccessToken(c.env, token);
  if (!payload) {
    return c.json({ error: "unauthorized" }, 401);
  }

  c.set("mcp", payload);
  return next();
});
app.route("/api/v1/account", accountV1);
app.route("/api/v1/contacts", contactsV1);
app.route("/api/v1/documents", documentsV1);
app.route("/api/v1/recipients", recipientsV1);
app.route("/api/v1/uploads", uploadsV1);

export { SealChatAgent };

export default app;
