import { describe, expect, test } from "vitest";

import { healthHandler } from "../health";

describe("GET /health", () => {
  test("returns 200 with status ok and timestamp", async () => {
    const response = await healthHandler();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = (await response.json()) as { status: string; timestamp: string };
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");

    const parsed = new Date(body.timestamp);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });
});
