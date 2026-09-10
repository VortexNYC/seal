import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import publicRoute from "./public.js";

describe("public API", () => {
  it("returns unknown when no CF-Connecting-IP header is present", async () => {
    const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
    app.route("/api/public", publicRoute);

    const response = await app.request("/api/public/ip");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ip: "unknown" });
  });
});
