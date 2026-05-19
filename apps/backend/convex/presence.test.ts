import { describe, expect, test } from "vitest";

import { isStalePresence } from "./presence";

describe("isStalePresence", () => {
  const nowMs = 1_000_000;

  test("returns false for fresh presence", () => {
    expect(isStalePresence(nowMs - 30, nowMs, 60)).toBe(false);
  });

  test("returns true for stale presence", () => {
    expect(isStalePresence(nowMs - 90, nowMs, 60)).toBe(true);
  });

  test("returns false when exactly at threshold", () => {
    expect(isStalePresence(nowMs - 60, nowMs, 60)).toBe(false);
  });

  test("returns true for any positive gap when threshold is zero", () => {
    expect(isStalePresence(nowMs - 1, nowMs, 0)).toBe(true);
  });

  test("returns false when gap is zero and threshold is zero", () => {
    expect(isStalePresence(nowMs, nowMs, 0)).toBe(false);
  });
});
