import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("listLabels", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let adminUserId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Labels Test Org",
        slug: "labels-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    adminUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@labels-test.com",
        name: "Admin User",
        clerkId: "clerk_labels_admin",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("organization_members", {
        userId: adminUserId,
        organizationId,
        role: "admin",
        status: "active",
        isPrimary: false,
      });
    });
  });

  test("returns empty array when no labels exist", async () => {
    const labels = await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .query(api.labels.queries.listLabels, {
        organizationId,
      });

    expect(labels).toEqual([]);
  });

  test("returns labels sorted alphabetically by name", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("labels", {
        organizationId,
        name: "Zebra",
        color: "#000000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("labels", {
        organizationId,
        name: "Apple",
        color: "#ff0000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("labels", {
        organizationId,
        name: "Mango",
        color: "#ffa500",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const labels = await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .query(api.labels.queries.listLabels, {
        organizationId,
      });

    expect(labels.length).toBe(3);
    expect(labels.map((l: (typeof labels)[number]) => l.name)).toEqual([
      "Apple",
      "Mango",
      "Zebra",
    ]);
  });

  test("only returns labels for the requested organization", async () => {
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
      await ctx.db.insert("labels", {
        organizationId,
        name: "Org Label",
        color: "#000000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("labels", {
        organizationId: otherOrgId,
        name: "Other Label",
        color: "#ffffff",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const labels = await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .query(api.labels.queries.listLabels, {
        organizationId,
      });

    expect(labels.length).toBe(1);
    expect(labels[0].name).toBe("Org Label");
  });

  test("throws 'No access to this organization' when user is not a member", async () => {
    const strangerOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Stranger Org",
        slug: "stranger-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    const strangerUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "stranger@labels-test.com",
        name: "Stranger User",
        clerkId: "clerk_labels_stranger",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: strangerOrgId,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("organization_members", {
        userId: strangerUserId,
        organizationId: strangerOrgId,
        role: "member",
        status: "active",
        isPrimary: false,
      });
    });

    await expect(
      t
        .withIdentity({ subject: "clerk_labels_stranger" })
        .query(api.labels.queries.listLabels, {
          organizationId,
        }),
    ).rejects.toThrow("No access to this organization");
  });
});
