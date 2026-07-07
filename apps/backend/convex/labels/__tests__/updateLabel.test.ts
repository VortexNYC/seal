import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("updateLabel", () => {
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

  test("updates label name", async () => {
    const labelId = await t.run(async (ctx) => {
      return await ctx.db.insert("labels", {
        organizationId,
        name: "Original Name",
        color: "#000000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .mutation(api.labels.mutations.updateLabel, {
        labelId,
        name: "Updated Name",
      });

    const label = (await t.run(async (ctx) => {
      return await ctx.db.get(labelId);
    })) as Doc<"labels"> | null;

    expect(label).not.toBeNull();
    expect(label!.name).toBe("Updated Name");
    expect(label!.color).toBe("#000000");
  });

  test("updates label color", async () => {
    const labelId = await t.run(async (ctx) => {
      return await ctx.db.insert("labels", {
        organizationId,
        name: "Test Label",
        color: "#000000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .mutation(api.labels.mutations.updateLabel, {
        labelId,
        color: "#FF0000",
      });

    const label = (await t.run(async (ctx) => {
      return await ctx.db.get(labelId);
    })) as Doc<"labels"> | null;

    expect(label).not.toBeNull();
    expect(label!.name).toBe("Test Label");
    expect(label!.color).toBe("#FF0000");
  });

  test("updates both name and color", async () => {
    const labelId = await t.run(async (ctx) => {
      return await ctx.db.insert("labels", {
        organizationId,
        name: "Original Name",
        color: "#000000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .mutation(api.labels.mutations.updateLabel, {
        labelId,
        name: "Updated Name",
        color: "#00FF00",
      });

    const label = (await t.run(async (ctx) => {
      return await ctx.db.get(labelId);
    })) as Doc<"labels"> | null;

    expect(label).not.toBeNull();
    expect(label!.name).toBe("Updated Name");
    expect(label!.color).toBe("#00FF00");
  });

  test("rejects empty name (whitespace-only)", async () => {
    const labelId = await t.run(async (ctx) => {
      return await ctx.db.insert("labels", {
        organizationId,
        name: "Test Label",
        color: "#000000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity({ subject: "clerk_labels_admin" }).mutation(api.labels.mutations.updateLabel, {
        labelId,
        name: "   ",
      }),
    ).rejects.toThrow("Label name cannot be empty");
  });

  test('throws "Label not found" for non-existent id', async () => {
    // Create then delete a label to obtain a valid ID that no longer exists
    const labelId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("labels", {
        organizationId,
        name: "To Delete",
        color: "#000000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      t.withIdentity({ subject: "clerk_labels_admin" }).mutation(api.labels.mutations.updateLabel, {
        labelId,
        name: "New Name",
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

    const otherLabelId = await t.run(async (ctx) => {
      return await ctx.db.insert("labels", {
        organizationId: otherOrgId,
        name: "Other Label",
        color: "#000000",
        createdBy: adminUserId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity({ subject: "clerk_labels_admin" }).mutation(api.labels.mutations.updateLabel, {
        labelId: otherLabelId,
        name: "New Name",
      }),
    ).rejects.toThrow("Label not found");
  });
});
