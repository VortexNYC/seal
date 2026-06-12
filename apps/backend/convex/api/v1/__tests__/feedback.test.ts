import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/feedback", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  async function seedFeedback(overrides: {
    type?: "bug" | "suggestion";
    message: string;
    route?: string;
    organizationId?: Id<"organizations">;
  }) {
    const orgId = overrides.organizationId ?? organizationId;

    return t.run(async (ctx) => {
      return await ctx.db.insert("feedback", {
        userId,
        organizationId: orgId,
        type: overrides.type ?? "bug",
        message: overrides.message,
        route: overrides.route,
        createdAt: BASE_TIME,
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Feedback API Org",
        slug: "feedback-api-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-feedback",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@feedback-api.com",
        name: "Owner",
        authSubject: "feedback_api_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // listFeedback
  // =========================================================================

  describe("listFeedback", () => {
    test("returns empty list when no feedback exists", async () => {
      const result = await t.query(internal.api.v1.feedback.listFeedback, {
        userId,
        organizationId,
      });

      expect(result.feedback).toHaveLength(0);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeUndefined();
    });

    test("returns feedback for the org", async () => {
      await seedFeedback({ message: "Bug report" });
      await seedFeedback({ message: "Feature request" });
      await seedFeedback({ message: "Other org bug", organizationId: otherOrgId });

      const result = await t.query(internal.api.v1.feedback.listFeedback, {
        userId,
        organizationId,
      });

      expect(result.feedback).toHaveLength(2);
    });

    test("returns full feedback fields", async () => {
      await seedFeedback({ type: "suggestion", message: "Add dark mode", route: "/settings" });

      const result = await t.query(internal.api.v1.feedback.listFeedback, {
        userId,
        organizationId,
      });

      const feedback = result.feedback[0];
      expect(feedback?.type).toBe("suggestion");
      expect(feedback?.message).toBe("Add dark mode");
      expect(feedback?.route).toBe("/settings");
      expect(feedback?.id).toBeDefined();
      expect(feedback?.created_at).toBeDefined();
      expect(feedback?.created_by).toBe(userId);
    });

    test("filters by type", async () => {
      await seedFeedback({ type: "bug", message: "Crash on submit" });
      await seedFeedback({ type: "suggestion", message: "Add export feature" });

      const result = await t.query(internal.api.v1.feedback.listFeedback, {
        userId,
        organizationId,
        type: "suggestion",
      });

      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0]?.message).toBe("Add export feature");
    });

    test("respects limit and returns has_more=true", async () => {
      for (let i = 0; i < 5; i++) {
        await seedFeedback({ message: `Feedback ${i}` });
      }

      const result = await t.query(internal.api.v1.feedback.listFeedback, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(result.feedback).toHaveLength(2);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBeDefined();
    });

    test("cursor pagination returns next page without overlap", async () => {
      for (let i = 0; i < 5; i++) {
        await seedFeedback({ message: `Feedback ${i}` });
      }

      const page1 = await t.query(internal.api.v1.feedback.listFeedback, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(page1.feedback).toHaveLength(2);

      const page2 = await t.query(internal.api.v1.feedback.listFeedback, {
        userId,
        organizationId,
        limit: 2,
        cursor: page1.next_cursor,
      });

      expect(page2.feedback).toHaveLength(2);
      const page1Ids = new Set(page1.feedback.map((f) => f.id));
      for (const f of page2.feedback) {
        expect(page1Ids.has(f.id)).toBe(false);
      }
    });

    test("caps limit at 100", async () => {
      const result = await t.query(internal.api.v1.feedback.listFeedback, {
        userId,
        organizationId,
        limit: 500,
      });

      expect(result.feedback).toHaveLength(0);
      expect(result.has_more).toBe(false);
    });
  });

  // =========================================================================
  // getFeedback
  // =========================================================================

  describe("getFeedback", () => {
    test("returns feedback by ID", async () => {
      const feedbackId = await seedFeedback({ message: "Bug report" });

      const result = await t.query(internal.api.v1.feedback.getFeedback, {
        userId,
        organizationId,
        feedbackId,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(feedbackId);
      expect(result?.message).toBe("Bug report");
    });

    test("returns null for feedback in different org", async () => {
      const feedbackId = await seedFeedback({
        message: "Other org bug",
        organizationId: otherOrgId,
      });

      const result = await t.query(internal.api.v1.feedback.getFeedback, {
        userId,
        organizationId,
        feedbackId,
      });

      expect(result).toBeNull();
    });

    test("returns null for non-existent feedback", async () => {
      const feedbackId = await seedFeedback({ message: "Temporary" });
      await t.mutation(internal.api.v1.feedback.deleteFeedback, {
        userId,
        organizationId,
        feedbackId,
      });

      const result = await t.query(internal.api.v1.feedback.getFeedback, {
        userId,
        organizationId,
        feedbackId,
      });

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // createFeedback
  // =========================================================================

  describe("createFeedback", () => {
    test("creates feedback with required fields", async () => {
      const result = await t.mutation(internal.api.v1.feedback.createFeedback, {
        userId,
        organizationId,
        type: "bug",
        message: "Button not working",
      });

      expect(result.id).toBeDefined();

      const feedback = await t.query(internal.api.v1.feedback.getFeedback, {
        userId,
        organizationId,
        feedbackId: result.id as Id<"feedback">,
      });

      expect(feedback?.type).toBe("bug");
      expect(feedback?.message).toBe("Button not working");
      expect(feedback?.route).toBeUndefined();
    });

    test("creates feedback with optional route", async () => {
      const result = await t.mutation(internal.api.v1.feedback.createFeedback, {
        userId,
        organizationId,
        type: "suggestion",
        message: "Add dark mode",
        route: "/settings",
      });

      const feedback = await t.query(internal.api.v1.feedback.getFeedback, {
        userId,
        organizationId,
        feedbackId: result.id as Id<"feedback">,
      });

      expect(feedback?.type).toBe("suggestion");
      expect(feedback?.message).toBe("Add dark mode");
      expect(feedback?.route).toBe("/settings");
    });

    test("rejects invalid type", async () => {
      await expect(
        t.mutation(internal.api.v1.feedback.createFeedback, {
          userId,
          organizationId,
          type: "invalid" as unknown as "bug",
          message: "Test",
        }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // updateFeedback
  // =========================================================================

  describe("updateFeedback", () => {
    test("updates feedback message", async () => {
      const feedbackId = await seedFeedback({ message: "Old message" });

      const result = await t.mutation(internal.api.v1.feedback.updateFeedback, {
        userId,
        organizationId,
        feedbackId,
        message: "Updated message",
      });

      expect(result.success).toBe(true);

      const feedback = await t.query(internal.api.v1.feedback.getFeedback, {
        userId,
        organizationId,
        feedbackId,
      });

      expect(feedback?.message).toBe("Updated message");
    });

    test("updates feedback type", async () => {
      const feedbackId = await seedFeedback({ type: "bug", message: "Bug report" });

      const result = await t.mutation(internal.api.v1.feedback.updateFeedback, {
        userId,
        organizationId,
        feedbackId,
        type: "suggestion",
      });

      expect(result.success).toBe(true);

      const feedback = await t.query(internal.api.v1.feedback.getFeedback, {
        userId,
        organizationId,
        feedbackId,
      });

      expect(feedback?.type).toBe("suggestion");
    });

    test("updates feedback route", async () => {
      const feedbackId = await seedFeedback({ message: "Feedback", route: "/old" });

      const result = await t.mutation(internal.api.v1.feedback.updateFeedback, {
        userId,
        organizationId,
        feedbackId,
        route: "/new",
      });

      expect(result.success).toBe(true);

      const feedback = await t.query(internal.api.v1.feedback.getFeedback, {
        userId,
        organizationId,
        feedbackId,
      });

      expect(feedback?.route).toBe("/new");
    });

    test("returns error for feedback in different org", async () => {
      const feedbackId = await seedFeedback({
        message: "Other feedback",
        organizationId: otherOrgId,
      });

      const result = await t.mutation(internal.api.v1.feedback.updateFeedback, {
        userId,
        organizationId,
        feedbackId,
        message: "Trying to update",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Feedback not found");
    });
  });

  // =========================================================================
  // deleteFeedback
  // =========================================================================

  describe("deleteFeedback", () => {
    test("deletes an existing feedback entry", async () => {
      const feedbackId = await seedFeedback({ message: "Delete me" });

      const result = await t.mutation(internal.api.v1.feedback.deleteFeedback, {
        userId,
        organizationId,
        feedbackId,
      });

      expect(result.success).toBe(true);

      const deleted = await t.query(internal.api.v1.feedback.getFeedback, {
        userId,
        organizationId,
        feedbackId,
      });
      expect(deleted).toBeNull();
    });

    test("throws when feedback belongs to different org", async () => {
      const feedbackId = await seedFeedback({
        message: "Other delete",
        organizationId: otherOrgId,
      });

      await expect(
        t.mutation(internal.api.v1.feedback.deleteFeedback, {
          userId,
          organizationId,
          feedbackId,
        }),
      ).rejects.toThrow("Feedback not found");
    });
  });
});
