import { describe, expect, it } from "vitest";

import {
  getExpandedPermissions,
  getPermissionsByDomain,
  getRoleInfo,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isValidPermission,
  PERMISSIONS,
  ROLE_TEMPLATES,
} from "./permissions";

describe("hasPermission", () => {
  it("returns true for exact match", () => {
    expect(hasPermission(["documents:view", "documents:edit"], "documents:view")).toBe(true);
  });

  it("returns false when permission is missing", () => {
    expect(hasPermission(["documents:view"], "documents:edit")).toBe(false);
  });

  it("returns true for global wildcard", () => {
    expect(hasPermission(["*"], "documents:delete")).toBe(true);
    expect(hasPermission(["*"], "system:super")).toBe(true);
  });

  it("returns true for domain wildcard", () => {
    expect(hasPermission(["documents:*"], "documents:view")).toBe(true);
    expect(hasPermission(["documents:*"], "documents:delete")).toBe(true);
  });

  it("domain wildcard does not match other domains", () => {
    expect(hasPermission(["documents:*"], "templates:view")).toBe(false);
  });

  it("returns false for empty permissions array", () => {
    expect(hasPermission([], "documents:view")).toBe(false);
  });

  it("wildcard * does not partially match permission strings", () => {
    // "doc*" should NOT match "documents:view" — only exact "*" or "domain:*"
    expect(hasPermission(["doc*"], "documents:view")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true when user has one of required permissions", () => {
    expect(hasAnyPermission(["documents:view"], ["documents:view", "documents:edit"])).toBe(true);
  });

  it("returns false when user has none of required permissions", () => {
    expect(hasAnyPermission(["contacts:view"], ["documents:view", "documents:edit"])).toBe(false);
  });

  it("works with wildcards", () => {
    expect(hasAnyPermission(["documents:*"], ["documents:edit", "templates:view"])).toBe(true);
  });

  it("returns false for empty required permissions", () => {
    // Array.some on empty array returns false
    expect(hasAnyPermission(["documents:view"], [])).toBe(false);
  });
});

describe("hasAllPermissions", () => {
  it("returns true when user has all required permissions", () => {
    expect(
      hasAllPermissions(["documents:view", "documents:edit"], ["documents:view", "documents:edit"]),
    ).toBe(true);
  });

  it("returns false when user is missing one", () => {
    expect(hasAllPermissions(["documents:view"], ["documents:view", "documents:edit"])).toBe(false);
  });

  it("domain wildcard satisfies all permissions in that domain", () => {
    expect(
      hasAllPermissions(["documents:*"], ["documents:view", "documents:edit", "documents:delete"]),
    ).toBe(true);
  });

  it("returns true for empty required permissions", () => {
    // Array.every on empty array returns true
    expect(hasAllPermissions(["documents:view"], [])).toBe(true);
  });
});

describe("getExpandedPermissions", () => {
  it("owner role expands to all permissions", () => {
    const expanded = getExpandedPermissions("owner");
    const allPermissions = Object.keys(PERMISSIONS);
    expect(expanded).toHaveLength(allPermissions.length);
    for (const perm of allPermissions) {
      expect(expanded).toContain(perm);
    }
  });

  it("admin role includes all documents permissions", () => {
    const expanded = getExpandedPermissions("admin");
    expect(expanded).toContain("documents:view");
    expect(expanded).toContain("documents:create");
    expect(expanded).toContain("documents:edit");
    expect(expanded).toContain("documents:delete");
    expect(expanded).toContain("documents:share");
    expect(expanded).toContain("documents:export");
  });

  it("admin role does not include billing or system permissions", () => {
    const expanded = getExpandedPermissions("admin");
    expect(expanded).not.toContain("organization:billing");
    expect(expanded).not.toContain("system:super");
    expect(expanded).not.toContain("system:maintenance");
  });

  it("viewer role is read-only", () => {
    const expanded = getExpandedPermissions("viewer");
    // Viewer should only have :view and :read permissions
    for (const perm of expanded) {
      expect(perm).toMatch(/:(view|read)$/);
    }
  });

  it("member role has create but not delete for documents", () => {
    const expanded = getExpandedPermissions("member");
    expect(expanded).toContain("documents:create");
    expect(expanded).toContain("documents:edit");
    expect(expanded).not.toContain("documents:delete");
  });

  it("returns sorted permissions", () => {
    const expanded = getExpandedPermissions("admin");
    const sorted = [...expanded].sort();
    expect(expanded).toEqual(sorted);
  });
});

describe("isValidPermission", () => {
  it("returns true for valid permissions", () => {
    expect(isValidPermission("documents:view")).toBe(true);
    expect(isValidPermission("system:super")).toBe(true);
  });

  it("returns false for invalid permissions", () => {
    expect(isValidPermission("fake:permission")).toBe(false);
    expect(isValidPermission("")).toBe(false);
    expect(isValidPermission("documents")).toBe(false);
  });
});

describe("getPermissionsByDomain", () => {
  it("groups permissions by domain", () => {
    const byDomain = getPermissionsByDomain();
    expect(byDomain.documents).toBeDefined();
    expect(byDomain.templates).toBeDefined();
    expect(byDomain.organization).toBeDefined();
  });

  it("each domain entry has key and description", () => {
    const byDomain = getPermissionsByDomain();
    for (const entry of byDomain.documents!) {
      expect(entry.key).toMatch(/^documents:/);
      expect(typeof entry.description).toBe("string");
    }
  });

  it("covers all permissions", () => {
    const byDomain = getPermissionsByDomain();
    const totalEntries = Object.values(byDomain).reduce((sum, arr) => sum + arr.length, 0);
    expect(totalEntries).toBe(Object.keys(PERMISSIONS).length);
  });
});

describe("getRoleInfo", () => {
  it("returns name and description for each role", () => {
    for (const role of Object.keys(ROLE_TEMPLATES) as Array<keyof typeof ROLE_TEMPLATES>) {
      const info = getRoleInfo(role);
      expect(info.name).toBeTruthy();
      expect(info.description).toBeTruthy();
    }
  });
});
