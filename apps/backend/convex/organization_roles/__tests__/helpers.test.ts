import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { ROLE_TEMPLATES } from "../../auth/permissions";
import { createTestContext } from "../../test.setup";
import { seedSystemRoles } from "../helpers";

describe("seedSystemRoles", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });
  });

  test("creates 3 system roles (Administrator, Member, Viewer)", async () => {
    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, organizationId);
    });

    const roles = await t.run(async (ctx) => {
      return await ctx.db
        .query("organization_roles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    });

    expect(roles).toHaveLength(3);

    const names = roles.map((r) => r.name).sort();
    expect(names).toEqual(["Administrator", "Member", "Viewer"]);
  });

  test("Administrator role has correct permissions from admin template", async () => {
    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, organizationId);
    });

    const adminRole = await t.run(async (ctx) => {
      return await ctx.db
        .query("organization_roles")
        .withIndex("by_name", (q) => q.eq("organizationId", organizationId).eq("name", "Administrator"))
        .first();
    });

    expect(adminRole).not.toBeNull();
    expect(adminRole!.permissions).toEqual([...ROLE_TEMPLATES.admin.permissions]);
  });

  test("Member role has correct permissions from member template", async () => {
    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, organizationId);
    });

    const memberRole = await t.run(async (ctx) => {
      return await ctx.db
        .query("organization_roles")
        .withIndex("by_name", (q) => q.eq("organizationId", organizationId).eq("name", "Member"))
        .first();
    });

    expect(memberRole).not.toBeNull();
    expect(memberRole!.permissions).toEqual([...ROLE_TEMPLATES.member.permissions]);
  });

  test("Viewer role has correct permissions from viewer template", async () => {
    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, organizationId);
    });

    const viewerRole = await t.run(async (ctx) => {
      return await ctx.db
        .query("organization_roles")
        .withIndex("by_name", (q) => q.eq("organizationId", organizationId).eq("name", "Viewer"))
        .first();
    });

    expect(viewerRole).not.toBeNull();
    expect(viewerRole!.permissions).toEqual([...ROLE_TEMPLATES.viewer.permissions]);
  });

  test("all roles have type 'system'", async () => {
    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, organizationId);
    });

    const roles = await t.run(async (ctx) => {
      return await ctx.db
        .query("organization_roles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    });

    for (const role of roles) {
      expect(role.type).toBe("system");
    }
  });

  test("running twice is idempotent (does not create duplicates)", async () => {
    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, organizationId);
    });

    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, organizationId);
    });

    const roles = await t.run(async (ctx) => {
      return await ctx.db
        .query("organization_roles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    });

    expect(roles).toHaveLength(3);
  });

  test("roles are created for the correct organizationId", async () => {
    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, organizationId);
    });

    const roles = await t.run(async (ctx) => {
      return await ctx.db
        .query("organization_roles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    });

    for (const role of roles) {
      expect(role.organizationId).toBe(organizationId);
    }
  });

  test("different orgs get separate roles", async () => {
    const otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, organizationId);
    });

    await t.run(async (ctx) => {
      await seedSystemRoles(ctx.db, otherOrgId);
    });

    const org1Roles = await t.run(async (ctx) => {
      return await ctx.db
        .query("organization_roles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    });

    const org2Roles = await t.run(async (ctx) => {
      return await ctx.db
        .query("organization_roles")
        .withIndex("by_organization", (q) => q.eq("organizationId", otherOrgId))
        .collect();
    });

    expect(org1Roles).toHaveLength(3);
    expect(org2Roles).toHaveLength(3);

    // Verify IDs are distinct between orgs
    const org1Ids = new Set(org1Roles.map((r) => r._id));
    const org2Ids = new Set(org2Roles.map((r) => r._id));
    for (const id of org2Ids) {
      expect(org1Ids.has(id)).toBe(false);
    }

    // Both orgs have the same role names
    const org1Names = org1Roles.map((r) => r.name).sort();
    const org2Names = org2Roles.map((r) => r.name).sort();
    expect(org1Names).toEqual(org2Names);
  });
});
