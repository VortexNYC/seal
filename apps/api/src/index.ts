import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";

import activity from "./api/activity.js";
import analytics from "./api/analytics.js";
import contacts from "./api/contacts.js";
import documents from "./api/documents.js";
import feedback from "./api/feedback.js";
import folders from "./api/folders.js";
import notifications from "./api/notifications.js";
import organizations from "./api/organizations.js";
import publicApi from "./api/public.js";
import users from "./api/users.js";
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

app.route("/api/activity", activity);
app.route("/api/analytics", analytics);
app.route("/api/contacts", contacts);
app.route("/api/documents", documents);
app.route("/api/feedback", feedback);
app.route("/api/folders", folders);
app.route("/api/notifications", notifications);
app.route("/api/organizations", organizations);
app.route("/api/public", publicApi);
app.route("/api/users", users);

export default app;
