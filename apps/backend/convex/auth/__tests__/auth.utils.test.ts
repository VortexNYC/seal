import { describe, expect, test } from "vitest";

import type { Doc, Id } from "../../_generated/dataModel";
import {
  canAccessOrganization,
  canBulkExportDocuments,
  canManageDocuments,
  DOCUMENT_SIGNING_PERMISSIONS,
  getEffectivePermissions,
  getHighestPermissionLevel,
  hasPermission,
  hasRole,
  isAccountValid,
  isAdmin,
  isAdminOrOwner,
  isOwner,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
} from "../../auth.utils";

const fakeUserId = "user1" as Id<"users">;
const fakeOrgId = "org1" as Id<"organizations">;
const otherOrgId = "org2" as Id<"organizations">;

function createMockMember(
  overrides: Partial<Doc<"organization_members">> = {},
): Doc<"organization_members"> {
  return {
    userId: fakeUserId,
    organizationId: fakeOrgId,
    role: "member",
    permissions: [],
    status: "active",
    isPrimary: false,
    ...overrides,
  } as Doc<"organization_members">;
}

describe("hasPermission", () => {
  test("returns true when role grants permission", () => {
    const owner = createMockMember({ role: "owner" });
    expect(hasPermission(owner, "documents:read")).toBe(true);
  });

  test("returns true via individual permissions", () => {
    const member = createMockMember({
      role: "viewer",
      permissions: ["documents:bulk_export"],
    });
    expect(hasPermission(member, "documents:bulk_export")).toBe(true);
  });

  test("returns false when permission is missing", () => {
    const viewer = createMockMember({ role: "viewer" });
    expect(hasPermission(viewer, "documents:create")).toBe(false);
  });

  test("returns false for inactive members", () => {
    const owner = createMockMember({ role: "owner", status: "inactive" as const });
    expect(hasPermission(owner, "documents:read")).toBe(false);
  });

  test("system wildcard grants any permission", () => {
    const system = createMockMember({ role: "system" });
    expect(hasPermission(system, "anything:imaginary")).toBe(true);
  });
});

describe("hasRole", () => {
  test("owner is at or above admin", () => {
    const owner = createMockMember({ role: "owner" });
    expect(hasRole(owner, "admin")).toBe(true);
  });

  test("member is not at or above admin", () => {
    const member = createMockMember({ role: "member" });
    expect(hasRole(member, "admin")).toBe(false);
  });
});

describe("canAccessOrganization", () => {
  test("returns true when org matches", () => {
    const member = createMockMember({ organizationId: fakeOrgId });
    expect(canAccessOrganization(member, fakeOrgId)).toBe(true);
  });

  test("returns false when org does not match", () => {
    const member = createMockMember({ organizationId: fakeOrgId });
    expect(canAccessOrganization(member, otherOrgId)).toBe(false);
  });
});

describe("getEffectivePermissions", () => {
  test("combines role and individual permissions", () => {
    const member = createMockMember({
      role: "viewer",
      permissions: ["documents:bulk_export"],
    });
    const perms = getEffectivePermissions(member);
    expect(perms).toContain("documents:view");
    expect(perms).toContain("documents:bulk_export");
  });
});

describe("isAccountValid", () => {
  test("returns true for active", () => {
    expect(isAccountValid(createMockMember({ status: "active" as const }))).toBe(true);
  });

  test("returns false for inactive", () => {
    expect(isAccountValid(createMockMember({ status: "inactive" as const }))).toBe(false);
  });
});

describe("isOwner", () => {
  test("returns true for owner role", () => {
    expect(isOwner(createMockMember({ role: "owner" }))).toBe(true);
  });

  test("returns false for admin role", () => {
    expect(isOwner(createMockMember({ role: "admin" }))).toBe(false);
  });
});

describe("isAdmin", () => {
  test("returns true for admin", () => {
    expect(isAdmin(createMockMember({ role: "admin" }))).toBe(true);
  });

  test("returns true for owner", () => {
    expect(isAdmin(createMockMember({ role: "owner" }))).toBe(true);
  });

  test("returns false for member", () => {
    expect(isAdmin(createMockMember({ role: "member" }))).toBe(false);
  });
});

describe("isAdminOrOwner", () => {
  test("returns true for owner", () => {
    expect(isAdminOrOwner(createMockMember({ role: "owner" }))).toBe(true);
  });

  test("returns true for admin", () => {
    expect(isAdminOrOwner(createMockMember({ role: "admin" }))).toBe(true);
  });

  test("returns false for member", () => {
    expect(isAdminOrOwner(createMockMember({ role: "member" }))).toBe(false);
  });
});

describe("getHighestPermissionLevel", () => {
  test("owner has delete level for documents", () => {
    const owner = createMockMember({ role: "owner" });
    expect(getHighestPermissionLevel(owner, "documents")).toBe("delete");
  });

  test("viewer has read level for documents", () => {
    const viewer = createMockMember({ role: "viewer" });
    expect(getHighestPermissionLevel(viewer, "documents")).toBe("read");
  });
});

describe("canManageDocuments", () => {
  test("owner can manage documents in their org", () => {
    const owner = createMockMember({ role: "owner", organizationId: fakeOrgId });
    expect(canManageDocuments(owner, fakeOrgId)).toBe(true);
  });

  test("member cannot manage documents in another org", () => {
    const member = createMockMember({ role: "member", organizationId: fakeOrgId });
    expect(canManageDocuments(member, otherOrgId)).toBe(false);
  });
});

describe("documents:bulk_export permission", () => {
  test("owner role has documents:bulk_export", () => {
    expect(ROLE_PERMISSIONS.owner).toContain("documents:bulk_export");
  });

  test("admin role has documents:bulk_export", () => {
    expect(ROLE_PERMISSIONS.admin).toContain("documents:bulk_export");
  });

  test("member role does NOT have documents:bulk_export", () => {
    expect(ROLE_PERMISSIONS.member).not.toContain("documents:bulk_export");
  });

  test("viewer role does NOT have documents:bulk_export", () => {
    expect(ROLE_PERMISSIONS.viewer).not.toContain("documents:bulk_export");
  });

  test("DOCUMENTS_BULK_EXPORT constant is defined", () => {
    expect(DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_BULK_EXPORT).toBe("documents:bulk_export");
  });
});

describe("canBulkExportDocuments", () => {
  test("owner can bulk export in their org", () => {
    const owner = createMockMember({ role: "owner", organizationId: fakeOrgId });
    expect(canBulkExportDocuments(owner, fakeOrgId)).toBe(true);
  });

  test("admin can bulk export in their org", () => {
    const admin = createMockMember({ role: "admin", organizationId: fakeOrgId });
    expect(canBulkExportDocuments(admin, fakeOrgId)).toBe(true);
  });

  test("member cannot bulk export even in their org", () => {
    const member = createMockMember({ role: "member", organizationId: fakeOrgId });
    expect(canBulkExportDocuments(member, fakeOrgId)).toBe(false);
  });

  test("viewer cannot bulk export", () => {
    const viewer = createMockMember({ role: "viewer", organizationId: fakeOrgId });
    expect(canBulkExportDocuments(viewer, fakeOrgId)).toBe(false);
  });

  test("owner cannot bulk export in a different org", () => {
    const owner = createMockMember({ role: "owner", organizationId: fakeOrgId });
    expect(canBulkExportDocuments(owner, otherOrgId)).toBe(false);
  });

  test("member with individual permission CAN bulk export in their org", () => {
    const member = createMockMember({
      role: "member",
      organizationId: fakeOrgId,
      permissions: ["documents:bulk_export"],
    });
    expect(canBulkExportDocuments(member, fakeOrgId)).toBe(true);
  });

  test("member with individual permission cannot bulk export in a different org", () => {
    const member = createMockMember({
      role: "member",
      organizationId: fakeOrgId,
      permissions: ["documents:bulk_export"],
    });
    expect(canBulkExportDocuments(member, otherOrgId)).toBe(false);
  });

  test("inactive owner cannot bulk export", () => {
    const owner = createMockMember({
      role: "owner",
      organizationId: fakeOrgId,
      status: "inactive" as const,
    });
    expect(canBulkExportDocuments(owner, fakeOrgId)).toBe(false);
  });
});

describe("ROLE_HIERARCHY", () => {
  test("system is highest", () => {
    expect(ROLE_HIERARCHY.system).toBeGreaterThan(ROLE_HIERARCHY.owner);
  });

  test("owner is higher than admin", () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
  });

  test("admin is higher than member", () => {
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.member);
  });

  test("member is higher than viewer", () => {
    expect(ROLE_HIERARCHY.member).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });
});
