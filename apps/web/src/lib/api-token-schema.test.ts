import { describe, expect, test } from "vitest";

import { createdApiTokenSchema } from "./api-client";

describe("createdApiTokenSchema", () => {
  const base = {
    id: "tok_1",
    publicId: "tk_abc",
    name: "CI",
    scopes: ["read", "write"],
    token: "seal_tk_abc_deadbeef",
    createdAt: "2026-09-23T19:00:00.000Z",
  };

  test("accepts create payloads that omit lastUsedAt/revokedAt", () => {
    // Matches the live POST /tokens body before #696 (keys absent → undefined).
    const parsed = createdApiTokenSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  test("accepts explicit null lastUsedAt/revokedAt", () => {
    const parsed = createdApiTokenSchema.safeParse({
      ...base,
      lastUsedAt: null,
      revokedAt: null,
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects a create payload missing the one-time token", () => {
    const { token: _token, ...withoutToken } = base;
    const parsed = createdApiTokenSchema.safeParse(withoutToken);
    expect(parsed.success).toBe(false);
  });
});
