import { describe, expect, test } from "bun:test";

import { getAuthToken, type McpRequestExtra } from "./auth";

describe("getAuthToken", () => {
  test("returns token when valid token is present", () => {
    const extra: McpRequestExtra = {
      authInfo: { token: "valid-token-123" },
    };
    expect(getAuthToken(extra)).toBe("valid-token-123");
  });

  test("returns undefined when authInfo is missing", () => {
    const extra: McpRequestExtra = {};
    expect(getAuthToken(extra)).toBeUndefined();
  });

  test("returns undefined when token is empty string", () => {
    const extra: McpRequestExtra = {
      authInfo: { token: "" },
    };
    expect(getAuthToken(extra)).toBeUndefined();
  });

  test("returns undefined when authInfo has no token property", () => {
    const extra = {} as McpRequestExtra;
    expect(getAuthToken(extra)).toBeUndefined();
  });

  test("returns token with whitespace (does not trim)", () => {
    const extra: McpRequestExtra = {
      authInfo: { token: "  token-with-spaces  " },
    };
    expect(getAuthToken(extra)).toBe("  token-with-spaces  ");
  });
});
