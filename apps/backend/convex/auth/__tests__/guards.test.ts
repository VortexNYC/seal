import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import type { AuthContextWithPermissions } from "../auth.permissions";
import {
  ensureAdmin,
  ensureAdminForOrg,
  ensureAllPermissions,
  ensureAnyPermission,
  ensureOrganizationScope,
  ensureOwner,
  ensurePermission,
  ensureResourceOwner,
  ensureResourceOwnerOrAdmin,
} from "../guards";

const fakeUserId = "user123" as Id<"users">;
const fakeOrgId = "org123" as Id<"organizations">;

function createMockAuth(
  overrides: Partial<AuthContextWithPermissions> = {}
): AuthContextWithPermissions {
  const permissions = overrides.permissions ?? [];
  return {
    userId: fakeUserId,
    organizationId: fakeOrgId,
    role: "member",
    permissions,
    isOwner: false,
    isAdmin: false,
    hasPermission: (p: string) => permissions.includes(p),
    hasAnyPermission: (perms: string[]) =>
      perms.some((p) => permissions.includes(p)),
    hasAllPermissions: (perms: string[]) =>
      perms.every((p) => permissions.includes(p)),
    user: {} as AuthContextWithPermissions["user"],
    member: {} as AuthContextWithPermissions["member"],
    organization: {} as AuthContextWithPermissions["organization"],
    ...overrides,
  } as AuthContextWithPermissions;
}

describe("ensureOwner", () => {
  test("passes when isOwner is true", () => {
    const auth = createMockAuth({ isOwner: true });
    expect(() => ensureOwner(auth)).not.toThrow();
  });

  test("throws ConvexError when isOwner is false", () => {
    const auth = createMockAuth({ isOwner: false });
    expect(() => ensureOwner(auth)).toThrow(ConvexError);
  });
});

describe("ensureAdmin", () => {
  test("passes when isAdmin is true", () => {
    const auth = createMockAuth({ isAdmin: true });
    expect(() => ensureAdmin(auth)).not.toThrow();
  });

  test("throws ConvexError when isAdmin is false", () => {
    const auth = createMockAuth({ isAdmin: false });
    expect(() => ensureAdmin(auth)).toThrow(ConvexError);
  });
});

describe("ensureOrganizationScope", () => {
  test("passes when organization IDs match", () => {
    const auth = createMockAuth({ organizationId: fakeOrgId });
    expect(() => ensureOrganizationScope(auth, fakeOrgId)).not.toThrow();
  });

  test("throws ConvexError when organization IDs differ", () => {
    const auth = createMockAuth({ organizationId: fakeOrgId });
    const differentOrgId = "org456" as Id<"organizations">;
    expect(() => ensureOrganizationScope(auth, differentOrgId)).toThrow(
      ConvexError
    );
  });

  test("passes silently when targetOrgId is undefined", () => {
    const auth = createMockAuth({ organizationId: fakeOrgId });
    expect(() => ensureOrganizationScope(auth, undefined)).not.toThrow();
  });
});

describe("ensureAdminForOrg", () => {
  test("passes when admin and organization IDs match", () => {
    const auth = createMockAuth({ isAdmin: true, organizationId: fakeOrgId });
    expect(() => ensureAdminForOrg(auth, fakeOrgId)).not.toThrow();
  });

  test("throws ConvexError when not admin even if org matches", () => {
    const auth = createMockAuth({ isAdmin: false, organizationId: fakeOrgId });
    expect(() => ensureAdminForOrg(auth, fakeOrgId)).toThrow(ConvexError);
  });

  test("throws ConvexError when admin but org does not match", () => {
    const auth = createMockAuth({ isAdmin: true, organizationId: fakeOrgId });
    const differentOrgId = "org456" as Id<"organizations">;
    expect(() => ensureAdminForOrg(auth, differentOrgId)).toThrow(ConvexError);
  });
});

describe("ensurePermission", () => {
  test("passes when user has the required permission", () => {
    const auth = createMockAuth({ permissions: ["documents:delete"] });
    expect(() => ensurePermission(auth, "documents:delete")).not.toThrow();
  });

  test("throws ConvexError when user lacks the required permission", () => {
    const auth = createMockAuth({ permissions: [] });
    expect(() => ensurePermission(auth, "documents:delete")).toThrow(
      ConvexError
    );
  });
});

describe("ensureAnyPermission", () => {
  test("passes when user has at least one of the required permissions", () => {
    const auth = createMockAuth({ permissions: ["documents:edit"] });
    expect(() =>
      ensureAnyPermission(auth, ["documents:edit", "documents:delete"])
    ).not.toThrow();
  });

  test("throws ConvexError when user has none of the required permissions", () => {
    const auth = createMockAuth({ permissions: ["documents:view"] });
    expect(() =>
      ensureAnyPermission(auth, ["documents:edit", "documents:delete"])
    ).toThrow(ConvexError);
  });
});

describe("ensureAllPermissions", () => {
  test("passes when user has all required permissions", () => {
    const auth = createMockAuth({
      permissions: ["documents:edit", "documents:delete"],
    });
    expect(() =>
      ensureAllPermissions(auth, ["documents:edit", "documents:delete"])
    ).not.toThrow();
  });

  test("throws ConvexError when user is missing one permission", () => {
    const auth = createMockAuth({ permissions: ["documents:edit"] });
    expect(() =>
      ensureAllPermissions(auth, ["documents:edit", "documents:delete"])
    ).toThrow(ConvexError);
  });
});

describe("ensureResourceOwner", () => {
  test("passes when userId matches resourceOwnerId", () => {
    const auth = createMockAuth({ userId: fakeUserId });
    expect(() => ensureResourceOwner(auth, fakeUserId)).not.toThrow();
  });

  test("throws ConvexError when userId does not match resourceOwnerId", () => {
    const auth = createMockAuth({ userId: fakeUserId });
    const differentUserId = "user456" as Id<"users">;
    expect(() => ensureResourceOwner(auth, differentUserId)).toThrow(
      ConvexError
    );
  });
});

describe("ensureResourceOwnerOrAdmin", () => {
  test("passes when user is the resource owner", () => {
    const auth = createMockAuth({ userId: fakeUserId, isAdmin: false });
    expect(() => ensureResourceOwnerOrAdmin(auth, fakeUserId)).not.toThrow();
  });

  test("passes when user is an admin but not the resource owner", () => {
    const differentUserId = "user456" as Id<"users">;
    const auth = createMockAuth({ userId: fakeUserId, isAdmin: true });
    expect(() =>
      ensureResourceOwnerOrAdmin(auth, differentUserId)
    ).not.toThrow();
  });

  test("throws ConvexError when user is neither the resource owner nor an admin", () => {
    const differentUserId = "user456" as Id<"users">;
    const auth = createMockAuth({ userId: fakeUserId, isAdmin: false });
    expect(() => ensureResourceOwnerOrAdmin(auth, differentUserId)).toThrow(
      ConvexError
    );
  });
});
