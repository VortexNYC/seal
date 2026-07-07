import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/labels – deleteLabel", () => {
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

  test("deletes an existing label and getLabel returns null afterward", async () => {
    const labelId = await seedLabel({ name: "Remove Me" });

    const result = await t.mutation(internal.api.v1.labels.deleteLabel, {
      userId,
      organizationId,
      labelId,
    });

    expect(result.success).toBe(true);

    const deleted = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId,
    });

    expect(deleted).toBeNull();
  });

  test("throws when label belongs to different org", async () => {
    const labelId = await seedLabel({ name: "Other", organizationId: otherOrgId });

    await expect(
      t.mutation(internal.api.v1.labels.deleteLabel, {
        userId,
        organizationId,
        labelId,
      }),
    ).rejects.toThrow("Label not found");
  });
});
