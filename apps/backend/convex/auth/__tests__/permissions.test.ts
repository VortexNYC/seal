import { describe, expect, test } from "vitest";

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
} from "../permissions";

import type { PermissionKey } from "../permissions";

const allPermissionKeys = Object.keys(PERMISSIONS) as PermissionKey[];

describe("hasPermission", () => {
  test("exact match returns true", () => {
    expect(hasPermission(["documents:view", "documents:edit"], "documents:view")).toBe(true);
  });

  test("global wildcard '*' grants any permission", () => {
    expect(hasPermission(["*"], "documents:view")).toBe(true);
    expect(hasPermission(["*"], "organization:billing")).toBe(true);
    expect(hasPermission(["*"], "system:super")).toBe(true);
  });

  test("domain wildcard 'documents:*' grants documents:view but not templates:view", () => {
    const perms = ["documents:*"];
    expect(hasPermission(perms, "documents:view")).toBe(true);
    expect(hasPermission(perms, "documents:create")).toBe(true);
    expect(hasPermission(perms, "documents:delete")).toBe(true);
    expect(hasPermission(perms, "templates:view")).toBe(false);
    expect(hasPermission(perms, "organization:view")).toBe(false);
  });

  test("returns false when permission is not present", () => {
    expect(hasPermission(["documents:view"], "documents:edit")).toBe(false);
    expect(hasPermission([], "documents:view")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  test("returns true if at least one matches", () => {
    expect(
      hasAnyPermission(["documents:view", "templates:view"], ["documents:edit", "templates:view"]),
    ).toBe(true);
  });

  test("returns false if none match", () => {
    expect(
      hasAnyPermission(["documents:view"], ["documents:edit", "templates:create"]),
    ).toBe(false);
  });
});

describe("hasAllPermissions", () => {
  test("returns true only if all match", () => {
    expect(
      hasAllPermissions(
        ["documents:view", "documents:edit", "templates:view"],
        ["documents:view", "documents:edit"],
      ),
    ).toBe(true);
  });

  test("returns false if one is missing", () => {
    expect(
      hasAllPermissions(["documents:view", "templates:view"], ["documents:view", "documents:edit"]),
    ).toBe(false);
  });
});

describe("getExpandedPermissions", () => {
  test("owner returns ALL permissions since owner has ['*']", () => {
    const ownerPerms = getExpandedPermissions("owner");
    const sortedAllKeys = [...allPermissionKeys].sort();
    expect(ownerPerms).toEqual(sortedAllKeys);
    expect(ownerPerms).toHaveLength(allPermissionKeys.length);
  });

  test("admin includes all documents:* and templates:* but NOT organization:billing", () => {
    const adminPerms = getExpandedPermissions("admin");

    // All document permissions present
    for (const key of allPermissionKeys.filter((k) => k.startsWith("documents:"))) {
      expect(adminPerms).toContain(key);
    }

    // All template permissions present
    for (const key of allPermissionKeys.filter((k) => k.startsWith("templates:"))) {
      expect(adminPerms).toContain(key);
    }

    // organization:billing is NOT included
    expect(adminPerms).not.toContain("organization:billing");
  });

  test("viewer does NOT include documents:create or documents:edit", () => {
    const viewerPerms = getExpandedPermissions("viewer");
    expect(viewerPerms).not.toContain("documents:create");
    expect(viewerPerms).not.toContain("documents:edit");
    expect(viewerPerms).toContain("documents:view");
    expect(viewerPerms).toContain("organization:view");
  });

  test("returns a sorted array", () => {
    for (const role of Object.keys(ROLE_TEMPLATES) as Array<keyof typeof ROLE_TEMPLATES>) {
      const perms = getExpandedPermissions(role);
      const sorted = [...perms].sort();
      expect(perms).toEqual(sorted);
    }
  });
});

describe("isValidPermission", () => {
  test("returns true for valid permissions", () => {
    expect(isValidPermission("documents:view")).toBe(true);
    expect(isValidPermission("organization:billing")).toBe(true);
    expect(isValidPermission("system:super")).toBe(true);
  });

  test("returns false for invalid permissions", () => {
    expect(isValidPermission("fake:permission")).toBe(false);
    expect(isValidPermission("")).toBe(false);
    expect(isValidPermission("documents")).toBe(false);
    expect(isValidPermission("*")).toBe(false);
  });
});

describe("getPermissionsByDomain", () => {
  test("returns object with domain keys, each containing array of {key, description}", () => {
    const byDomain = getPermissionsByDomain();

    // Should have known domains
    expect(byDomain).toHaveProperty("organization");
    expect(byDomain).toHaveProperty("documents");
    expect(byDomain).toHaveProperty("templates");
    expect(byDomain).toHaveProperty("settings");
    expect(byDomain).toHaveProperty("users");
    expect(byDomain).toHaveProperty("audit");
    expect(byDomain).toHaveProperty("system");

    // Each entry has key and description
    for (const [domain, entries] of Object.entries(byDomain)) {
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry).toHaveProperty("key");
        expect(entry).toHaveProperty("description");
        expect(entry.key).toMatch(new RegExp(`^${domain}:`));
        expect(typeof entry.description).toBe("string");
      }
    }
  });

  test("total entries across all domains equals total permissions count", () => {
    const byDomain = getPermissionsByDomain();
    const totalEntries = Object.values(byDomain).reduce((sum, entries) => sum + entries.length, 0);
    expect(totalEntries).toBe(allPermissionKeys.length);
  });
});

describe("getRoleInfo", () => {
  test("returns correct name and description for each role", () => {
    const ownerInfo = getRoleInfo("owner");
    expect(ownerInfo.name).toBe("Owner");
    expect(ownerInfo.description).toBe("Full access to all features including billing");

    const adminInfo = getRoleInfo("admin");
    expect(adminInfo.name).toBe("Administrator");
    expect(adminInfo.description).toBe("Manage all operations except billing");

    const memberInfo = getRoleInfo("member");
    expect(memberInfo.name).toBe("Member");
    expect(memberInfo.description).toBe("Create and edit content");

    const viewerInfo = getRoleInfo("viewer");
    expect(viewerInfo.name).toBe("Viewer");
    expect(viewerInfo.description).toBe("Read-only access to most features");
  });
});
