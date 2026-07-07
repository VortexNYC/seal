import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/labels – updateLabel", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  async function seedLabel(overrides: {
    name?: string;
    color?: string;
    description?: string;
    organizationId?: Id<"organizations">;
  }) {
    const orgId = overrides.organizationId ?? organizationId;
    const now = BASE_TIME;

    return t.run(async (ctx) => {
      return await ctx.db.insert("labels", {
        organizationId: orgId,
        name: overrides.name ?? "Default Label",
        color: overrides.color,
        description: overrides.description,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Labels API Org",
        slug: "labels-api-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-labels",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@labels-api.com",
        name: "Owner",
        clerkId: "clerk_labels_api_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  test("updates name successfully and reflects in getLabel", async () => {
    const labelId = await seedLabel({ name: "Old Name" });

    const result = await t.mutation(internal.api.v1.labels.updateLabel, {
      userId,
      organizationId,
      labelId,
      name: "New Name",
    });

    expect(result.success).toBe(true);

    const updated = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId,
    });

    expect(updated?.name).toBe("New Name");
  });

  test("updates color successfully and reflects in getLabel", async () => {
    const labelId = await seedLabel({ name: "Status", color: "#000000" });

    await t.mutation(internal.api.v1.labels.updateLabel, {
      userId,
      organizationId,
      labelId,
      color: "#ffffff",
    });

    const updated = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId,
    });

    expect(updated?.color).toBe("#ffffff");
  });

  test("updates description successfully and reflects in getLabel", async () => {
    const labelId = await seedLabel({ name: "Task" });

    await t.mutation(internal.api.v1.labels.updateLabel, {
      userId,
      organizationId,
      labelId,
      description: "Updated description",
    });

    const updated = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId,
    });

    expect(updated?.description).toBe("Updated description");
  });

  test("returns success false when label belongs to different org", async () => {
    const labelId = await seedLabel({ name: "External", organizationId: otherOrgId });

    const result = await t.mutation(internal.api.v1.labels.updateLabel, {
      userId,
      organizationId,
      labelId,
      name: "Should Fail",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Label not found");
  });

  test("updating one field does not affect other fields", async () => {
    const labelId = await seedLabel({
      name: "Original",
      color: "#123456",
      description: "Original desc",
    });

    await t.mutation(internal.api.v1.labels.updateLabel, {
      userId,
      organizationId,
      labelId,
      name: "Changed",
    });

    const updated = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId,
    });

    expect(updated?.name).toBe("Changed");
    expect(updated?.color).toBe("#123456");
    expect(updated?.description).toBe("Original desc");
  });
});
