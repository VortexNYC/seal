import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";

import documents from "./api/documents.js";
import { createAuth } from "./platform/auth.js";
import { getSessionUser, type SessionUser } from "./platform/session.js";

type Variables = {
  auth: ReturnType<typeof createAuth>;
  user: SessionUser | null;
};

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = c.env.ALLOWED_ORIGINS?.split(",") ?? [];
      return allowed.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

app.all("/api/auth/*", (c) => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
});

app.route("/api/documents", documents);

export default app;
