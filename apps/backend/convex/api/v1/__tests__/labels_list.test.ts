import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/labels – listLabels", () => {
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

  test("returns empty list when no labels exist", async () => {
    const result = await t.query(internal.api.v1.labels.listLabels, {
      userId,
      organizationId,
    });

    expect(result.labels).toHaveLength(0);
    expect(result.has_more).toBe(false);
    expect(result.next_cursor).toBeUndefined();
  });

  test("returns labels only for the requesting org", async () => {
    await seedLabel({ name: "Alpha" });
    await seedLabel({ name: "Beta" });
    await seedLabel({ name: "Gamma", organizationId: otherOrgId });

    const result = await t.query(internal.api.v1.labels.listLabels, {
      userId,
      organizationId,
    });

    expect(result.labels).toHaveLength(2);
    const names = result.labels.map((l) => l.name);
    expect(names).toContain("Alpha");
    expect(names).toContain("Beta");
    expect(names).not.toContain("Gamma");
  });

  test("returns full label fields", async () => {
    await seedLabel({ name: "Feature", color: "#00ff00", description: "New feature" });

    const result = await t.query(internal.api.v1.labels.listLabels, {
      userId,
      organizationId,
    });

    const label = result.labels[0];
    expect(label?.name).toBe("Feature");
    expect(label?.color).toBe("#00ff00");
    expect(label?.description).toBe("New feature");
    expect(label?.created_at).toBeDefined();
    expect(label?.updated_at).toBeDefined();
  });

  test("searches by name case-insensitively", async () => {
    await seedLabel({ name: "Urgent" });
    await seedLabel({ name: "Low Priority" });

    const result = await t.query(internal.api.v1.labels.listLabels, {
      userId,
      organizationId,
      search: "urgent",
    });

    expect(result.labels).toHaveLength(1);
    expect(result.labels[0]?.name).toBe("Urgent");
  });

  test("respects limit and returns has_more=true", async () => {
    for (let i = 0; i < 5; i++) {
      await seedLabel({ name: `Label ${i}` });
    }

    const result = await t.query(internal.api.v1.labels.listLabels, {
      userId,
      organizationId,
      limit: 2,
    });

    expect(result.labels).toHaveLength(2);
    expect(result.has_more).toBe(true);
    expect(result.next_cursor).toBeDefined();
  });

  test("cursor pagination returns next page without overlap", async () => {
    for (let i = 0; i < 5; i++) {
      await seedLabel({ name: `Page ${i}` });
    }

    const page1 = await t.query(internal.api.v1.labels.listLabels, {
      userId,
      organizationId,
      limit: 2,
    });

    expect(page1.labels).toHaveLength(2);

    const page2 = await t.query(internal.api.v1.labels.listLabels, {
      userId,
      organizationId,
      limit: 2,
      cursor: page1.next_cursor,
    });

    expect(page2.labels).toHaveLength(2);
    const page1Ids = new Set(page1.labels.map((l) => l.id));
    for (const l of page2.labels) {
      expect(page1Ids.has(l.id)).toBe(false);
    }
  });

  test("caps limit at 100", async () => {
    const result = await t.query(internal.api.v1.labels.listLabels, {
      userId,
      organizationId,
      limit: 500,
    });

    expect(result.labels).toHaveLength(0);
    expect(result.has_more).toBe(false);
  });
});
