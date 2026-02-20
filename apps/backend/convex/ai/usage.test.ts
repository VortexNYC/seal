import { register as registerAggregate } from "@convex-dev/aggregate/test";
import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";

describe("AI usage tracking", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;
  let documentId: Id<"documents">;

  beforeEach(async () => {
    t = createTestContext();
    registerAggregate(t, "aiUsageAggregate");

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "user@test.com",
        name: "Test User",
        clerkId: "clerk_test_user",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Doc.pdf",
        ownerId: userId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  // ─── logAiUsage ──────────────────────────────────────

  describe("logAiUsage", () => {
    test("logs field_analysis action", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.usage.logAiUsage, {
        organizationId,
        userId,
        action: "field_analysis",
        tokensUsed: 1500,
        durationMs: 2000,
        documentId,
        modelUsed: "gemini-3-flash",
      });

      const logs = await t.run(async (ctx) => {
        return await ctx.db.query("ai_usage_log").collect();
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        organizationId,
        userId,
        action: "field_analysis",
        tokensUsed: 1500,
        durationMs: 2000,
        modelUsed: "gemini-3-flash",
      });
    });

    test("logs all supported action types", async () => {
      const { internal } = await import("../_generated/api");

      const actions = [
        "field_analysis",
        "payment_extraction",
        "redlining",
        "search",
        "chat",
        "ocr_fallback",
      ] as const;

      for (const action of actions) {
        await t.mutation(internal.ai.usage.logAiUsage, {
          organizationId,
          userId,
          action,
          tokensUsed: 100,
          durationMs: 50,
          modelUsed: "gemini-3-flash",
        });
      }

      const logs = await t.run(async (ctx) => {
        return await ctx.db.query("ai_usage_log").collect();
      });

      expect(logs).toHaveLength(actions.length);
      const loggedActions = logs.map((l) => l.action).sort();
      expect(loggedActions).toEqual([...actions].sort());
    });

    test("estimates cost for gemini-3-flash", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.usage.logAiUsage, {
        organizationId,
        userId,
        action: "field_analysis",
        tokensUsed: 1_000_000, // 1M tokens
        durationMs: 5000,
        modelUsed: "gemini-3-flash",
      });

      const log = await t.run(async (ctx) => {
        return await ctx.db.query("ai_usage_log").first();
      });

      // gemini-3-flash: $0.10 per 1M tokens
      expect(log?.estimatedCostUsd).toBeCloseTo(0.1, 5);
    });

    test("estimates cost for unknown model with default rate", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.usage.logAiUsage, {
        organizationId,
        userId,
        action: "chat",
        tokensUsed: 1_000_000,
        durationMs: 3000,
        modelUsed: "some-future-model",
      });

      const log = await t.run(async (ctx) => {
        return await ctx.db.query("ai_usage_log").first();
      });

      // Default: $0.10 per 1M tokens
      expect(log?.estimatedCostUsd).toBeCloseTo(0.1, 5);
    });

    test("sets createdAt timestamp", async () => {
      const { internal } = await import("../_generated/api");
      const before = Date.now();

      await t.mutation(internal.ai.usage.logAiUsage, {
        organizationId,
        userId,
        action: "search",
        tokensUsed: 200,
        durationMs: 100,
        modelUsed: "gemini-3-flash",
      });

      const log = await t.run(async (ctx) => {
        return await ctx.db.query("ai_usage_log").first();
      });

      expect(log?.createdAt).toBeGreaterThanOrEqual(before);
    });

    test("documentId is optional", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.usage.logAiUsage, {
        organizationId,
        userId,
        action: "chat",
        tokensUsed: 500,
        durationMs: 1000,
        modelUsed: "gemini-3-flash",
      });

      const log = await t.run(async (ctx) => {
        return await ctx.db.query("ai_usage_log").first();
      });

      expect(log?.documentId).toBeUndefined();
    });

    test("logs multiple entries for same document", async () => {
      const { internal } = await import("../_generated/api");

      // Simulate pipeline: field_analysis + redlining + payment_extraction
      await t.mutation(internal.ai.usage.logAiUsage, {
        organizationId,
        userId,
        action: "field_analysis",
        tokensUsed: 1500,
        durationMs: 2000,
        documentId,
        modelUsed: "gemini-3-flash",
      });

      await t.mutation(internal.ai.usage.logAiUsage, {
        organizationId,
        userId,
        action: "redlining",
        tokensUsed: 1500,
        durationMs: 2000,
        documentId,
        modelUsed: "gemini-3-flash",
      });

      await t.mutation(internal.ai.usage.logAiUsage, {
        organizationId,
        userId,
        action: "payment_extraction",
        tokensUsed: 800,
        durationMs: 1500,
        documentId,
        modelUsed: "gemini-3-flash",
      });

      const logs = await t.run(async (ctx) => {
        return await ctx.db.query("ai_usage_log").collect();
      });

      expect(logs).toHaveLength(3);
      const totalTokens = logs.reduce((sum, l) => sum + l.tokensUsed, 0);
      expect(totalTokens).toBe(3800);
    });
  });
});
