import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import app from "./index.js";

declare module "cloudflare:test" {
  interface ProvidedEnv extends CloudflareBindings {}
}

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

  it("rejects unauthenticated document requests", async () => {
    const res = await app.fetch(
      new Request("http://localhost:8787/api/documents"),
      env
    );
    expect(res.status).toBe(401);
  });
});
