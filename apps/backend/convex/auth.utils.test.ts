import { describe, expect, test } from "vitest";

import type { Doc, Id } from "./_generated/dataModel";
import { hasAllPermissions, hasPermission } from "./auth.utils";

// ---------------------------------------------------------------------------
// Factory helper — creates minimal mock organization_member docs for testing
// ---------------------------------------------------------------------------
let idCounter = 0;
function makeMember(
  overrides: Partial<Doc<"organization_members">> = {},
): Doc<"organization_members"> {
  idCounter++;
  return {
    _id: `member_${idCounter}` as Id<"organization_members">,
    _creationTime: Date.now(),
    userId: `user_${idCounter}` as Id<"users">,
    organizationId: `org_${idCounter}` as Id<"organizations">,
    role: "member",
    status: "active",
    isPrimary: false,
    ...overrides,
  } as Doc<"organization_members">;
}

// ---------------------------------------------------------------------------
// hasAllPermissions
// ---------------------------------------------------------------------------
describe("hasAllPermissions", () => {
  test("returns true when member has all required permissions", () => {
    const member = makeMember({
      permissions: ["documents:view", "documents:edit"],
    });
    expect(hasAllPermissions(member, ["documents:view", "documents:edit"])).toBe(true);
  });

  test("returns false when member is missing one permission", () => {
    const member = makeMember({
      role: "viewer",
      permissions: ["documents:view"],
    });
    expect(hasAllPermissions(member, ["documents:view", "documents:create"])).toBe(false);
  });

  test("returns true for empty permissions list", () => {
    const member = makeMember();
    expect(hasAllPermissions(member, [])).toBe(true);
  });

  test("returns true for wildcard/system role granting all permissions", () => {
    const member = makeMember({ role: "system" });
    expect(hasAllPermissions(member, ["documents:delete", "org:manage", "api:create"])).toBe(true);
  });

  test("returns true for admin role with all requested permissions via role grants", () => {
    const member = makeMember({ role: "admin" });
    expect(hasAllPermissions(member, ["documents:view", "documents:create"])).toBe(true);
  });

  test("returns false for viewer missing a requested create permission", () => {
    const member = makeMember({ role: "viewer" });
    expect(hasAllPermissions(member, ["documents:view", "documents:create"])).toBe(false);
  });

  test("reuses hasPermission behavior for inactive members", () => {
    const member = makeMember({
      status: "inactive",
      permissions: ["documents:view", "documents:edit"],
    });
    expect(hasAllPermissions(member, ["documents:view"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Ensure existing hasPermission behavior is not regressed
// ---------------------------------------------------------------------------
describe("hasPermission", () => {
  test("existing behavior: exact match via individual permissions", () => {
    const member = makeMember({
      permissions: ["templates:create"],
    });
    expect(hasPermission(member, "templates:create")).toBe(true);
  });

  test("existing behavior: missing permission returns false", () => {
    const member = makeMember();
    expect(hasPermission(member, "org:manage")).toBe(false);
  });
});
