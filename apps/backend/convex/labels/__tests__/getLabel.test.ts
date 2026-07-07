import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("getLabel", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let adminUserId: Id<"users">;
  let clerkId: string;

  beforeEach(async () => {
    t = createTestContext();
    clerkId = "clerk_labels_admin";

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
        clerkId,
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
        isPrimary: true,
      });
    });
  });

  test("returns a label by id", async () => {
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

    const result = await t.withIdentity({ subject: clerkId }).query(api.labels.queries.getLabel, {
      labelId,
    });

    expect(result).not.toBeNull();
    expect(result.name).toBe("Urgent");
    expect(result.color).toBe("#ff0000");
    expect(result.organizationId).toEqual(organizationId);
  });

  test('throws "Label not found" for non-existent id', async () => {
    // Create a label to get a syntactically valid ID, then delete it
    const fakeLabelId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("labels", {
        organizationId,
        name: "Temp",
        color: "#000000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.withIdentity({ subject: clerkId }).query(api.labels.queries.getLabel, {
        labelId: fakeLabelId,
      }),
    ).rejects.toThrow("Label not found");
  });

  test('throws "Label not found" for a label belonging to a different organization', async () => {
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
      t.withIdentity({ subject: clerkId }).query(api.labels.queries.getLabel, {
        labelId,
      }),
    ).rejects.toThrow("Label not found");
  });
});
