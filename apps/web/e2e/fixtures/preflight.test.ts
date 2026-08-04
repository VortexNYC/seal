import { afterEach, describe, expect, test, vi } from "vitest";

import { assertAuthEnv } from "./preflight";

describe("E2E auth preflight", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("accepts the default Vortex Auth smoke user without legacy-provider-specific validation", () => {
    vi.stubEnv("E2E_TEST_USER_EMAIL", "seal-e2e@seal.nyc");
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "SealE2ePassword123!");

    expect(() => assertAuthEnv()).not.toThrow();
  });

  test("accepts legacy TEST_USER_* aliases for Vortex Auth credentials", () => {
    vi.stubEnv("E2E_TEST_USER_EMAIL", "");
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "");
    vi.stubEnv("TEST_USER_EMAIL", "seal-e2e@seal.nyc");
    vi.stubEnv("TEST_USER_PASSWORD", "SealE2ePassword123!");

    expect(() => assertAuthEnv()).not.toThrow();
  });

  test("fails only when no Vortex Auth test credentials are configured", () => {
    vi.stubEnv("E2E_TEST_USER_EMAIL", "");
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "");
    vi.stubEnv("TEST_USER_EMAIL", "");
    vi.stubEnv("TEST_USER_PASSWORD", "");

    expect(() => assertAuthEnv()).toThrow(
      "[E2E preflight] Missing required Vortex Auth test credential: E2E_TEST_USER_EMAIL or TEST_USER_EMAIL"
    );
  });
});
