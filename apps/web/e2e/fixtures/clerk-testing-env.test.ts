import { describe, expect, it } from "vitest";

import { canUseClerkTestingHelpers } from "./clerk-testing-env";

describe("canUseClerkTestingHelpers", () => {
  it("returns true when a publishable key and secret key are present", () => {
    expect(
      canUseClerkTestingHelpers({
        CLERK_SECRET_KEY: "sk_test_123",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_123",
      }),
    ).toBe(true);
  });

  it("returns true when a publishable key and testing token are present", () => {
    expect(
      canUseClerkTestingHelpers({
        CLERK_TESTING_TOKEN: "testing_token",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_123",
      }),
    ).toBe(true);
  });

  it("returns false when the publishable key is missing", () => {
    expect(
      canUseClerkTestingHelpers({
        CLERK_SECRET_KEY: "sk_test_123",
      }),
    ).toBe(false);
  });

  it("returns false when the testing credential is missing", () => {
    expect(
      canUseClerkTestingHelpers({
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_123",
      }),
    ).toBe(false);
  });
});
