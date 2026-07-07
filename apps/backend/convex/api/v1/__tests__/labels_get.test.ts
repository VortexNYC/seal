import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/labels – getLabel", () => {
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

  test("returns label by ID with all fields", async () => {
    const labelId = await seedLabel({
      name: "Bug",
      color: "#ff0000",
      description: "Software bugs",
    });

    const result = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(labelId);
    expect(result?.name).toBe("Bug");
    expect(result?.color).toBe("#ff0000");
    expect(result?.description).toBe("Software bugs");
    expect(result?.created_at).toBeDefined();
    expect(result?.updated_at).toBeDefined();
  });

  test("returns null for label in different org", async () => {
    const labelId = await seedLabel({ name: "Private", organizationId: otherOrgId });

    const result = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId,
    });

    expect(result).toBeNull();
  });

  test("returns null for nonexistent label", async () => {
    const labelId = await seedLabel({ name: "Temp" });
    await t.run(async (ctx) => {
      await ctx.db.delete(labelId);
    });

    const result = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId,
    });

    expect(result).toBeNull();
  });
});
