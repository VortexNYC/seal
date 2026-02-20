import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";

describe("pipeline_mutations", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;
  let ownerId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

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

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Test Owner",
        clerkId: "clerk_test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Contract.pdf",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  // ─── setAiProcessingStatus ──────────────────────────────────────

  describe("setAiProcessingStatus", () => {
    test("sets status to pending", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId,
        status: "pending",
      });

      const doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.aiProcessingStatus).toBe("pending");
    });

    test("sets status to processing", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId,
        status: "processing",
      });

      const doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.aiProcessingStatus).toBe("processing");
    });

    test("sets status to completed", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId,
        status: "completed",
      });

      const doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.aiProcessingStatus).toBe("completed");
    });

    test("sets status to failed", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId,
        status: "failed",
      });

      const doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.aiProcessingStatus).toBe("failed");
    });

    test("updates updatedAt timestamp", async () => {
      const { internal } = await import("../_generated/api");

      const before = Date.now();
      await t.mutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId,
        status: "processing",
      });

      const doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.updatedAt).toBeGreaterThanOrEqual(before);
    });

    test("transitions through full lifecycle", async () => {
      const { internal } = await import("../_generated/api");

      // pending → processing → completed
      await t.mutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId,
        status: "pending",
      });
      let doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.aiProcessingStatus).toBe("pending");

      await t.mutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId,
        status: "processing",
      });
      doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.aiProcessingStatus).toBe("processing");

      await t.mutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId,
        status: "completed",
      });
      doc = await t.run(async (ctx) => ctx.db.get(documentId));
      expect(doc?.aiProcessingStatus).toBe("completed");
    });
  });

  // ─── savePaymentExtractionOnSuggestion ──────────────────────────

  describe("savePaymentExtractionOnSuggestion", () => {
    let suggestionId: Id<"ai_field_suggestions">;

    beforeEach(async () => {
      suggestionId = await t.run(async (ctx) => {
        return await ctx.db.insert("ai_field_suggestions", {
          documentId,
          organizationId,
          fields: [
            {
              fieldType: "payment",
              page: 1,
              x: 50,
              y: 80,
              width: 30,
              height: 5,
              label: "Payment Amount",
              confidence: 0.9,
              isRequired: true,
            },
          ],
          modelUsed: "gemini-3-flash",
          tokensUsed: 500,
          processingTimeMs: 1200,
          status: "pending",
        });
      });
    });

    test("saves payment extraction on pending suggestion", async () => {
      const { internal } = await import("../_generated/api");

      const paymentExtraction = {
        lineItems: [
          { description: "Consulting fee", quantity: 1, unitPriceCents: 500000 },
        ],
        currency: "usd",
        paymentType: "one_time" as const,
        dueDateTerms: "net_30" as const,
      };

      await t.mutation(internal.ai.pipeline_mutations.savePaymentExtractionOnSuggestion, {
        suggestionId,
        paymentExtraction,
      });

      const suggestion = await t.run(async (ctx) => ctx.db.get(suggestionId));
      expect(suggestion?.paymentExtraction).toMatchObject({
        lineItems: [{ description: "Consulting fee", unitPriceCents: 500000 }],
        currency: "usd",
        paymentType: "one_time",
      });
    });

    test("skips save if suggestion is already applied", async () => {
      const { internal } = await import("../_generated/api");

      // Mark suggestion as applied
      await t.run(async (ctx) => {
        await ctx.db.patch(suggestionId, { status: "applied" });
      });

      await t.mutation(internal.ai.pipeline_mutations.savePaymentExtractionOnSuggestion, {
        suggestionId,
        paymentExtraction: {
          lineItems: [{ description: "Fee", quantity: 1, unitPriceCents: 1000 }],
          currency: "usd",
          paymentType: "one_time" as const,
          dueDateTerms: "on_receipt" as const,
        },
      });

      const suggestion = await t.run(async (ctx) => ctx.db.get(suggestionId));
      expect(suggestion?.paymentExtraction).toBeUndefined();
    });

    test("skips save if suggestion is dismissed", async () => {
      const { internal } = await import("../_generated/api");

      await t.run(async (ctx) => {
        await ctx.db.patch(suggestionId, { status: "dismissed" });
      });

      await t.mutation(internal.ai.pipeline_mutations.savePaymentExtractionOnSuggestion, {
        suggestionId,
        paymentExtraction: {
          lineItems: [{ description: "Fee", quantity: 1, unitPriceCents: 1000 }],
          currency: "usd",
          paymentType: "one_time" as const,
          dueDateTerms: "on_receipt" as const,
        },
      });

      const suggestion = await t.run(async (ctx) => ctx.db.get(suggestionId));
      expect(suggestion?.paymentExtraction).toBeUndefined();
    });

    test("saves with optional fields", async () => {
      const { internal } = await import("../_generated/api");

      const paymentExtraction = {
        lineItems: [
          { description: "Monthly retainer", quantity: 1, unitPriceCents: 300000 },
        ],
        currency: "usd",
        paymentType: "recurring" as const,
        dueDateTerms: "on_receipt" as const,
        recurringConfig: { interval: "month" as const, intervalCount: 1 },
        lateFee: { type: "percentage" as const, amount: 2, gracePeriodDays: 5 },
      };

      await t.mutation(internal.ai.pipeline_mutations.savePaymentExtractionOnSuggestion, {
        suggestionId,
        paymentExtraction,
      });

      const suggestion = await t.run(async (ctx) => ctx.db.get(suggestionId));
      expect(suggestion?.paymentExtraction?.recurringConfig).toMatchObject({
        interval: "month",
        intervalCount: 1,
      });
      expect(suggestion?.paymentExtraction?.lateFee).toMatchObject({
        type: "percentage",
        amount: 2,
        gracePeriodDays: 5,
      });
    });
  });
});
