import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { ROLE_PERMISSIONS } from "../../auth.utils";
import { listComponentRolesByOrganization } from "../../lib/componentOrgReads";
import { ensureVortexAuthSystemRoles } from "../../lib/vortexAuthOrganizations";
import { createTestContext } from "../../test.setup";

describe("ensureVortexAuthSystemRoles", () => {
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

  async function seedAndListRoles(orgId = organizationId) {
    return await t.run(async (ctx) => {
      await ensureVortexAuthSystemRoles(ctx, orgId);
      const organization = await ctx.db.get(orgId);
      if (!organization) {
        throw new Error("test organization missing");
      }
      return await listComponentRolesByOrganization(ctx, organization);
    });
  }

  test("creates the Vortex Auth system role catalog", async () => {
    const roles = await seedAndListRoles();

    expect(roles).toHaveLength(Object.keys(ROLE_PERMISSIONS).length);
    expect(roles.map((role) => role.name).toSorted()).toEqual(
      Object.keys(ROLE_PERMISSIONS).toSorted()
    );
  });

  test("component roles have the canonical permissions", async () => {
    const roles = await seedAndListRoles();

    for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const role = roles.find((candidate) => candidate.name === name);
      if (!role) {
        throw new Error(`missing role: ${name}`);
      }
      expect(role.permissions).toEqual(permissions);
      expect(role.isSystem).toBe(true);
    }
  });

  test("running twice is idempotent", async () => {
    const first = await seedAndListRoles();
    const second = await seedAndListRoles();

    expect(second).toHaveLength(first.length);
    expect(second.map((role) => role.roleId).toSorted()).toEqual(
      first.map((role) => role.roleId).toSorted()
    );
  });

  test("roles are anchored to the correct Seal organization", async () => {
    const roles = await seedAndListRoles();

    for (const role of roles) {
      expect(role.organizationId).toBe(organizationId);
    }
  });

  test("different orgs get separate component roles", async () => {
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

    const org1Roles = await seedAndListRoles(organizationId);
    const org2Roles = await seedAndListRoles(otherOrgId);

    const org1Ids = new Set(org1Roles.map((role) => role.roleId));
    for (const role of org2Roles) {
      expect(role.organizationId).toBe(otherOrgId);
      expect(org1Ids.has(role.roleId)).toBe(false);
    }
    expect(org2Roles.map((role) => role.name).toSorted()).toEqual(
      org1Roles.map((role) => role.name).toSorted()
    );
  });
});
