import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import app from "./index.js";

describe("app", () => {
  it("returns ok from /health", async () => {
    const res = await app.fetch(
      new Request("http://localhost:8787/health"),
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ status: string }>();
    expect(body.status).toBe("ok");
  });

  it("returns 503 when APP_URL is a bare selfhost placeholder", async () => {
    const res = await app.fetch(new Request("http://localhost:8787/health"), {
      ...env,
      APP_URL: "https://seal-selfhost-web.workers.dev",
      BETTER_AUTH_URL: "https://seal-selfhost-api.shlomo-31b.workers.dev",
    });
    expect(res.status).toBe(503);
    const body = await res.json<{ status: string; error: string }>();
    expect(body.status).toBe("misconfigured");
    expect(body.error).toContain("APP_URL");
  });

  it("rejects unauthenticated document requests", async () => {
    const res = await app.fetch(
      new Request("http://localhost:8787/api/documents"),
      env
    );
    expect(res.status).toBe(401);
  });
});
