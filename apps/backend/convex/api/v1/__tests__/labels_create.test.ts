import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/labels – createLabel", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;

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

  test("creates label with required fields (name) and returns an id", async () => {
    const result = await t.mutation(internal.api.v1.labels.createLabel, {
      userId,
      organizationId,
      name: "Important",
    });

    expect(result.id).toBeDefined();

    const label = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId: result.id as Id<"labels">,
    });

    expect(label?.name).toBe("Important");
  });

  test("creates label with all optional fields (color, description)", async () => {
    const result = await t.mutation(internal.api.v1.labels.createLabel, {
      userId,
      organizationId,
      name: "Urgent",
      color: "#ff0000",
      description: "High priority items",
    });

    const label = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId: result.id as Id<"labels">,
    });

    expect(label?.name).toBe("Urgent");
    expect(label?.color).toBe("#ff0000");
    expect(label?.description).toBe("High priority items");
  });

  test("created label can be fetched via getLabel", async () => {
    const result = await t.mutation(internal.api.v1.labels.createLabel, {
      userId,
      organizationId,
      name: "Review",
      color: "#00ff00",
    });

    const fetched = await t.query(internal.api.v1.labels.getLabel, {
      userId,
      organizationId,
      labelId: result.id as Id<"labels">,
    });

    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(result.id);
    expect(fetched?.name).toBe("Review");
    expect(fetched?.color).toBe("#00ff00");
    expect(fetched?.created_at).toBeDefined();
    expect(fetched?.updated_at).toBeDefined();
  });
});
