import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/templates", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  async function seedTemplate(overrides: {
    name?: string;
    description?: string;
    status?: "active" | "archived" | "deleted";
    pageCount?: number;
    organizationId?: Id<"organizations">;
    storageId?: string;
  }) {
    const orgId = overrides.organizationId ?? organizationId;
    const now = BASE_TIME;

    return t.run(async (ctx) => {
      return await ctx.db.insert("templates", {
        organizationId: orgId,
        createdBy: userId,
        name: overrides.name ?? "Test Template",
        description: overrides.description,
        status: overrides.status ?? "active",
        pageCount: overrides.pageCount,
        storageId: overrides.storageId ?? "storage_test_template",
        fileSize: 1024,
        fileType: "application/pdf",
        useCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Templates API Org",
        slug: "templates-api-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-templates",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@templates-api.com",
        name: "Owner",
        authSubject: "templates_api_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // listTemplates
  // =========================================================================

  describe("listTemplates", () => {
    test("returns empty list when no templates exist", async () => {
      const result = await t.query(internal.api.v1.templates.listTemplates, {
        userId,
        organizationId,
      });

      expect(result.templates).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    test("includes page_count in template responses", async () => {
      await seedTemplate({ name: "Template A", pageCount: 5 });
      await seedTemplate({ name: "Template B", pageCount: 12 });

      const result = await t.query(internal.api.v1.templates.listTemplates, {
        userId,
        organizationId,
      });

      expect(result.templates).toHaveLength(2);
      expect(result.templates[0]?.page_count).toBe(12);
      expect(result.templates[1]?.page_count).toBe(5);
    });

    test("page_count is undefined when not set on template", async () => {
      await seedTemplate({ name: "No Page Count" });

      const result = await t.query(internal.api.v1.templates.listTemplates, {
        userId,
        organizationId,
      });

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0]?.page_count).toBeUndefined();
    });

    test("returns only templates for the org", async () => {
      await seedTemplate({ name: "My Template" });
      await seedTemplate({ name: "Other Template", organizationId: otherOrgId });

      const result = await t.query(internal.api.v1.templates.listTemplates, {
        userId,
        organizationId,
      });

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0]?.name).toBe("My Template");
    });

    test("filters by status", async () => {
      await seedTemplate({ name: "Active", status: "active" });
      await seedTemplate({ name: "Archived", status: "archived" });

      const result = await t.query(internal.api.v1.templates.listTemplates, {
        userId,
        organizationId,
        status: "archived",
      });

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0]?.name).toBe("Archived");
    });

    test("respects limit and returns hasMore=true", async () => {
      for (let i = 0; i < 5; i++) {
        await seedTemplate({ name: `Template ${i}` });
      }

      const result = await t.query(internal.api.v1.templates.listTemplates, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(result.templates).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    test("caps limit at 100", async () => {
      const result = await t.query(internal.api.v1.templates.listTemplates, {
        userId,
        organizationId,
        limit: 500,
      });

      expect(result.templates).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  // =========================================================================
  // getTemplate
  // =========================================================================

  describe("getTemplate", () => {
    test("returns template with page_count", async () => {
      const templateId = await seedTemplate({
        name: "My Template",
        description: "A test template",
        pageCount: 42,
      });

      const result = await t.query(internal.api.v1.templates.getTemplate, {
        userId,
        organizationId,
        templateId,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(templateId);
      expect(result?.name).toBe("My Template");
      expect(result?.page_count).toBe(42);
    });

    test("page_count is undefined when not set", async () => {
      const templateId = await seedTemplate({ name: "No Pages" });

      const result = await t.query(internal.api.v1.templates.getTemplate, {
        userId,
        organizationId,
        templateId,
      });

      expect(result?.page_count).toBeUndefined();
    });

    test("returns null for template in different org", async () => {
      const templateId = await seedTemplate({
        name: "Other Template",
        organizationId: otherOrgId,
      });

      const result = await t.query(internal.api.v1.templates.getTemplate, {
        userId,
        organizationId,
        templateId,
      });

      expect(result).toBeNull();
    });

    test("responses include field_count", async () => {
      const templateId = await seedTemplate({ name: "With Fields" });

      const result = await t.query(internal.api.v1.templates.getTemplate, {
        userId,
        organizationId,
        templateId,
      });

      expect(result?.field_count).toBe(0);
    });
  });
});
