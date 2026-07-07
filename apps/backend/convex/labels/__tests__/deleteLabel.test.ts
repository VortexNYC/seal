import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("deleteLabel", () => {
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

  test("deletes an existing label", async () => {
    const labelId = await t.run(async (ctx) => {
      return await ctx.db.insert("labels", {
        organizationId,
        name: "Urgent",
        color: "#ff0000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .mutation(api.labels.mutations.deleteLabel, {
        labelId,
      });

    expect(result.success).toBe(true);

    const label = await t.run(async (ctx) => {
      return await ctx.db.get(labelId);
    });

    expect(label).toBeNull();
  });

  test("throws 'Label not found' for non-existent id", async () => {
    const labelId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("labels", {
        organizationId,
        name: "Temporary",
        color: "#cccccc",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.withIdentity({ subject: "clerk_labels_admin" }).mutation(api.labels.mutations.deleteLabel, {
        labelId,
      }),
    ).rejects.toThrow("Label not found");
  });

  test("throws 'Label not found' for a label belonging to a different organization", async () => {
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

    const labelId = await t.run(async (ctx) => {
      return await ctx.db.insert("labels", {
        organizationId: otherOrgId,
        name: "Other Label",
        color: "#00ff00",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity({ subject: "clerk_labels_admin" }).mutation(api.labels.mutations.deleteLabel, {
        labelId,
      }),
    ).rejects.toThrow("Label not found");
  });
});
