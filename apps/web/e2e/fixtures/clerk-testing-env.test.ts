import { describe, expect, it } from "vitest";

import { canUseClerkTestingHelpers } from "./clerk-testing-env";

describe("canUseClerkTestingHelpers", () => {
  it("returns true when a publishable key, testing credential, and Clerk test email are present", () => {
    expect(
      canUseClerkTestingHelpers({
        CLERK_SECRET_KEY: "sk_test_123",
        E2E_TEST_USER_EMAIL: "seal-e2e+clerk_test@example.com",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_123",
      }),
    ).toBe(true);
  });

  it("returns true when a publishable key, testing token, and Clerk test email are present", () => {
    expect(
      canUseClerkTestingHelpers({
        CLERK_TESTING_TOKEN: "testing_token",
        E2E_TEST_USER_EMAIL: "seal-e2e+clerk_test@example.com",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_123",
      }),
    ).toBe(true);
  });

  it("returns false when the publishable key is missing", () => {
    expect(
      canUseClerkTestingHelpers({
        CLERK_SECRET_KEY: "sk_test_123",
        E2E_TEST_USER_EMAIL: "seal-e2e+clerk_test@example.com",
      }),
    ).toBe(false);
  });

  it("returns false when the testing credential is missing", () => {
    expect(
      canUseClerkTestingHelpers({
        E2E_TEST_USER_EMAIL: "seal-e2e+clerk_test@example.com",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_123",
      }),
    ).toBe(false);
  });

  it("returns false when the email is not a Clerk test address", () => {
    expect(
      canUseClerkTestingHelpers({
        CLERK_SECRET_KEY: "sk_test_123",
        E2E_TEST_USER_EMAIL: "seal-e2e@example.com",
        VITE_CLERK_PUBLISHABLE_KEY: "pk_test_123",
      }),
    ).toBe(false);
  });
});
