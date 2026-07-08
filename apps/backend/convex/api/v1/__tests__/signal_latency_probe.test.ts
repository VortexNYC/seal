import { describe, expect, test } from "vitest";

import { createTestContext } from "../../../test.setup";

describe("api/v1/signal latency probe", () => {
  test("returns ok with no authentication", async () => {
    const t = createTestContext();

    const response = await t.fetch("/api/v1/signal/latency-probe", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });
});
