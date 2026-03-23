import { describe, expect, test } from "vitest";

import { shouldWaitForOrganizationSync } from "./organization-sync";

describe("shouldWaitForOrganizationSync", () => {
  test("returns false until Clerk finishes loading", () => {
    expect(
      shouldWaitForOrganizationSync({
        isClerkLoaded: false,
        hasClerkActiveOrganization: true,
        hasOrganization: false,
        activeOrganizationSlug: null,
      }),
    ).toBe(false);
  });

  test("returns false when there is no active Clerk organization", () => {
    expect(
      shouldWaitForOrganizationSync({
        isClerkLoaded: true,
        hasClerkActiveOrganization: false,
        hasOrganization: false,
        activeOrganizationSlug: null,
      }),
    ).toBe(false);
  });

  test("returns true when Clerk has an active organization but Convex has not synced it yet", () => {
    expect(
      shouldWaitForOrganizationSync({
        isClerkLoaded: true,
        hasClerkActiveOrganization: true,
        hasOrganization: false,
        activeOrganizationSlug: null,
      }),
    ).toBe(true);
  });

  test("returns true when membership exists but the active organization slug still needs repair", () => {
    expect(
      shouldWaitForOrganizationSync({
        isClerkLoaded: true,
        hasClerkActiveOrganization: true,
        hasOrganization: true,
        activeOrganizationSlug: null,
      }),
    ).toBe(true);
  });

  test("returns false once Convex has the active organization slug", () => {
    expect(
      shouldWaitForOrganizationSync({
        isClerkLoaded: true,
        hasClerkActiveOrganization: true,
        hasOrganization: true,
        activeOrganizationSlug: "acme",
      }),
    ).toBe(false);
  });
});
