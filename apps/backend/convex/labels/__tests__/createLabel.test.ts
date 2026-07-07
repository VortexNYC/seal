import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("createLabel", () => {
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

  test("creates a label with name and color", async () => {
    const result = await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .mutation(api.labels.mutations.createLabel, {
        name: "Urgent",
        color: "#ff0000",
      });

    expect(result.id).toBeDefined();

    const label = (await t.run(async (ctx) => {
      return await ctx.db.get(result.id);
    })) as Doc<"labels"> | null;

    expect(label).not.toBeNull();
    expect(label!.name).toBe("Urgent");
    expect(label!.color).toBe("#ff0000");
    expect(label!.organizationId).toEqual(organizationId);
    expect(label!.createdBy).toEqual(adminUserId);
  });

  test("creates a label without color", async () => {
    const result = await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .mutation(api.labels.mutations.createLabel, {
        name: "Normal",
      });

    const label = (await t.run(async (ctx) => {
      return await ctx.db.get(result.id);
    })) as Doc<"labels"> | null;

    expect(label).not.toBeNull();
    expect(label!.name).toBe("Normal");
    expect(label!.color).toBeUndefined();
  });

  test("rejects empty name (whitespace-only)", async () => {
    await expect(
      t
        .withIdentity({ subject: "clerk_labels_admin" })
        .mutation(api.labels.mutations.createLabel, {
          name: "   ",
        }),
    ).rejects.toThrow("Label name cannot be empty");
  });

  test("label is associated with the correct organization and user", async () => {
    const result = await t
      .withIdentity({ subject: "clerk_labels_admin" })
      .mutation(api.labels.mutations.createLabel, {
        name: "Billing",
        color: "#00ff00",
      });

    const label = (await t.run(async (ctx) => {
      return await ctx.db.get(result.id);
    })) as Doc<"labels"> | null;

    expect(label).not.toBeNull();
    expect(label!.organizationId).toEqual(organizationId);
    expect(label!.createdBy).toEqual(adminUserId);
    expect(label!.name).toBe("Billing");
    expect(label!.color).toBe("#00ff00");
    expect(label!.createdAt).toBeDefined();
    expect(label!.updatedAt).toBeDefined();
  });
});
