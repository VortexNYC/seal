import { describe, expect, test } from "vitest";

import { shouldWaitForOrganizationSync } from "./organization-sync";

describe("shouldWaitForOrganizationSync", () => {
  test("returns false until auth finishes loading", () => {
    expect(
      shouldWaitForOrganizationSync({
        isAuthLoaded: false,
        hasActiveOrganization: true,
        hasOrganization: false,
        activeOrganizationSlug: null,
        hasAttemptedRecovery: false,
      })
    ).toBe(false);
  });

  test("returns false when there is no active organization", () => {
    expect(
      shouldWaitForOrganizationSync({
        isAuthLoaded: true,
        hasActiveOrganization: false,
        hasOrganization: false,
        activeOrganizationSlug: null,
        hasAttemptedRecovery: false,
      })
    ).toBe(false);
  });

  test("returns true when auth has an active organization but the app has not synced it yet", () => {
    expect(
      shouldWaitForOrganizationSync({
        isAuthLoaded: true,
        hasActiveOrganization: true,
        hasOrganization: false,
        activeOrganizationSlug: null,
        hasAttemptedRecovery: false,
      })
    ).toBe(true);
  });

  test("returns true when membership exists but the active organization slug still needs repair", () => {
    expect(
      shouldWaitForOrganizationSync({
        isAuthLoaded: true,
        hasActiveOrganization: true,
        hasOrganization: true,
        activeOrganizationSlug: null,
        hasAttemptedRecovery: false,
      })
    ).toBe(true);
  });

  test("returns false once the app has the active organization slug", () => {
    expect(
      shouldWaitForOrganizationSync({
        isAuthLoaded: true,
        hasActiveOrganization: true,
        hasOrganization: true,
        activeOrganizationSlug: "acme",
        hasAttemptedRecovery: false,
      })
    ).toBe(false);
  });

  test("returns false after recovery has already been attempted", () => {
    expect(
      shouldWaitForOrganizationSync({
        isAuthLoaded: true,
        hasActiveOrganization: true,
        hasOrganization: false,
        activeOrganizationSlug: null,
        hasAttemptedRecovery: true,
      })
    ).toBe(false);
  });
});
