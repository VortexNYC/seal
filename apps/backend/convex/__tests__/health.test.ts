import { describe, expect, test } from "vitest";

import { handleHealthCheck } from "../http";

describe("handleHealthCheck", () => {
  test("returns 200 with status ok and ISO timestamp", async () => {
    const response = await handleHealthCheck();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
  });
});
