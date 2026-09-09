import { OpenAPIHono } from "@hono/zod-openapi";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Vortex Sign API",
    version: "0.0.1",
    description: "Agent-native e-signature platform on Cloudflare Workers.",
  },
});

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
