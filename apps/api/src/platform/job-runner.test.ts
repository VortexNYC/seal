import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("JobRunner DO", () => {
  it("exposes /wake (alarm scheduling path)", async () => {
    const runner = env.JOB_RUNNER;
    if (!runner) throw new Error("JOB_RUNNER binding missing in test env");
    const stub = runner.get(runner.idFromName("debug-org"));
    const res = await stub.fetch("http://internal/wake", { method: "POST" });
    expect(res.status).toBe(202);
    const notFound = await stub.fetch("http://internal/nope");
    expect(notFound.status).toBe(404);
  });
});
