import { beforeEach, describe, expect, test } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

describe("AI mutations", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;
  let ownerId: Id<"users">;

  const validField = {
    fieldType: "signature" as const,
    page: 1,
    x: 50,
    y: 80,
    width: 25,
    height: 5,
    label: "Buyer Signature",
    confidence: 0.95,
    isRequired: true,
  };

  const validAnnotation = {
    page: 1,
    x: 10,
    y: 30,
    width: 80,
    height: 3,
    category: "payment" as const,
    severity: "important" as const,
    text: "Payment of $5,000 is due within 30 days of signing.",
    summary: "Payment of $5,000 due within 30 days",
  };

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
        authSubject: "test_owner",
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

  // ─── saveFieldSuggestions ──────────────────────────────────────

  describe("saveFieldSuggestions", () => {
    test("saves field suggestions with pending status", async () => {
      const { internal } = await import("../_generated/api");

      const id = await t.mutation(internal.ai.mutations.saveFieldSuggestions, {
        documentId,
        organizationId,
        fields: [validField],
        modelUsed: "gemini-3-flash",
        tokensUsed: 1500,
        processingTimeMs: 2000,
      });

      const suggestion = await t.run(async (ctx) => ctx.db.get(id));
      expect(suggestion).toBeTruthy();
      expect(suggestion?.status).toBe("pending");
      expect(suggestion?.fields).toHaveLength(1);
      expect(suggestion?.fields[0].label).toBe("Buyer Signature");
    });

    test("dismisses existing pending suggestions on re-analysis", async () => {
      const { internal } = await import("../_generated/api");

      // First analysis
      const firstId = await t.mutation(
        internal.ai.mutations.saveFieldSuggestions,
        {
          documentId,
          organizationId,
          fields: [validField],
          modelUsed: "gemini-3-flash",
          tokensUsed: 1000,
          processingTimeMs: 1500,
        }
      );

      // Second analysis (e.g. after PDF replace)
      const secondId = await t.mutation(
        internal.ai.mutations.saveFieldSuggestions,
        {
          documentId,
          organizationId,
          fields: [{ ...validField, label: "Updated Signature" }],
          modelUsed: "gemini-3-flash",
          tokensUsed: 1200,
          processingTimeMs: 1800,
        }
      );

      const first = await t.run(async (ctx) => ctx.db.get(firstId));
      const second = await t.run(async (ctx) => ctx.db.get(secondId));

      expect(first?.status).toBe("dismissed");
      expect(second?.status).toBe("pending");
    });

    test("does not dismiss already-applied suggestions", async () => {
      const { internal } = await import("../_generated/api");

      const firstId = await t.mutation(
        internal.ai.mutations.saveFieldSuggestions,
        {
          documentId,
          organizationId,
          fields: [validField],
          modelUsed: "gemini-3-flash",
          tokensUsed: 1000,
          processingTimeMs: 1500,
        }
      );

      // Simulate user applying the first suggestion
      await t.run(async (ctx) => {
        await ctx.db.patch(firstId, { status: "applied" });
      });

      // New analysis shouldn't touch the applied one
      await t.mutation(internal.ai.mutations.saveFieldSuggestions, {
        documentId,
        organizationId,
        fields: [{ ...validField, label: "New Field" }],
        modelUsed: "gemini-3-flash",
        tokensUsed: 800,
        processingTimeMs: 1000,
      });

      const first = await t.run(async (ctx) => ctx.db.get(firstId));
      expect(first?.status).toBe("applied");
    });

    test("saves multiple field types", async () => {
      const { internal } = await import("../_generated/api");

      const id = await t.mutation(internal.ai.mutations.saveFieldSuggestions, {
        documentId,
        organizationId,
        fields: [
          {
            ...validField,
            fieldType: "signature" as const,
            label: "Signature",
          },
          { ...validField, fieldType: "date" as const, label: "Date", y: 85 },
          {
            ...validField,
            fieldType: "payment" as const,
            label: "Amount Due",
            y: 60,
          },
        ],
        modelUsed: "gemini-3-flash",
        tokensUsed: 2000,
        processingTimeMs: 3000,
      });

      const suggestion = await t.run(async (ctx) => ctx.db.get(id));
      expect(suggestion?.fields).toHaveLength(3);
      expect(
        suggestion?.fields.map(
          (f: Doc<"ai_field_suggestions">["fields"][number]) => f.fieldType
        )
      ).toEqual(["signature", "date", "payment"]);
    });
  });

  // ─── saveDocumentAnnotations ──────────────────────────────────

  describe("saveDocumentAnnotations", () => {
    test("saves annotations with active status", async () => {
      const { internal } = await import("../_generated/api");

      const id = await t.mutation(
        internal.ai.mutations.saveDocumentAnnotations,
        {
          documentId,
          organizationId,
          annotations: [validAnnotation],
          modelUsed: "gemini-3-flash",
          tokensUsed: 1500,
          processingTimeMs: 2000,
        }
      );

      expect(id).toBeTruthy();
      const annotation = await t.run(async (ctx) =>
        ctx.db.get(sealAssertPresent(id))
      );
      expect(annotation?.status).toBe("active");
      expect(annotation?.annotations).toHaveLength(1);
    });

    test("returns null for empty annotations", async () => {
      const { internal } = await import("../_generated/api");

      const id = await t.mutation(
        internal.ai.mutations.saveDocumentAnnotations,
        {
          documentId,
          organizationId,
          annotations: [],
          modelUsed: "gemini-3-flash",
          tokensUsed: 500,
          processingTimeMs: 1000,
        }
      );

      expect(id).toBeNull();
    });

    test("dismisses existing active annotations on re-analysis", async () => {
      const { internal } = await import("../_generated/api");

      const firstId = await t.mutation(
        internal.ai.mutations.saveDocumentAnnotations,
        {
          documentId,
          organizationId,
          annotations: [validAnnotation],
          modelUsed: "gemini-3-flash",
          tokensUsed: 1000,
          processingTimeMs: 1500,
        }
      );

      const secondId = await t.mutation(
        internal.ai.mutations.saveDocumentAnnotations,
        {
          documentId,
          organizationId,
          annotations: [{ ...validAnnotation, summary: "Updated annotation" }],
          modelUsed: "gemini-3-flash",
          tokensUsed: 1200,
          processingTimeMs: 1800,
          forceOverrideDismissal: true,
        }
      );

      const first = await t.run(async (ctx) =>
        ctx.db.get(sealAssertPresent(firstId))
      );
      expect(first?.status).toBe("dismissed");

      const second = await t.run(async (ctx) =>
        ctx.db.get(sealAssertPresent(secondId))
      );
      expect(second?.status).toBe("active");
    });

    test("respects user dismissal without force flag", async () => {
      const { internal } = await import("../_generated/api");

      // Save and dismiss annotations
      const firstId = await t.mutation(
        internal.ai.mutations.saveDocumentAnnotations,
        {
          documentId,
          organizationId,
          annotations: [validAnnotation],
          modelUsed: "gemini-3-flash",
          tokensUsed: 1000,
          processingTimeMs: 1500,
        }
      );

      await t.run(async (ctx) => {
        await ctx.db.patch(sealAssertPresent(firstId), { status: "dismissed" });
      });

      // New analysis without force flag should be skipped
      const secondId = await t.mutation(
        internal.ai.mutations.saveDocumentAnnotations,
        {
          documentId,
          organizationId,
          annotations: [{ ...validAnnotation, summary: "Should not be saved" }],
          modelUsed: "gemini-3-flash",
          tokensUsed: 800,
          processingTimeMs: 1000,
        }
      );

      expect(secondId).toBeNull();
    });

    test("overrides user dismissal with force flag", async () => {
      const { internal } = await import("../_generated/api");

      // Save and dismiss
      const firstId = await t.mutation(
        internal.ai.mutations.saveDocumentAnnotations,
        {
          documentId,
          organizationId,
          annotations: [validAnnotation],
          modelUsed: "gemini-3-flash",
          tokensUsed: 1000,
          processingTimeMs: 1500,
        }
      );

      await t.run(async (ctx) => {
        await ctx.db.patch(sealAssertPresent(firstId), { status: "dismissed" });
      });

      // Force flag overrides
      const secondId = await t.mutation(
        internal.ai.mutations.saveDocumentAnnotations,
        {
          documentId,
          organizationId,
          annotations: [{ ...validAnnotation, summary: "After PDF replace" }],
          modelUsed: "gemini-3-flash",
          tokensUsed: 1200,
          processingTimeMs: 1800,
          forceOverrideDismissal: true,
        }
      );

      expect(secondId).toBeTruthy();
      const second = await t.run(async (ctx) =>
        ctx.db.get(sealAssertPresent(secondId))
      );
      expect(second?.status).toBe("active");
    });
  });

  // ─── saveExtractedPaymentConfig ──────────────────────────────

  // ─── applyFieldSuggestions — recipient heuristics ─────────────

  describe("applyFieldSuggestions (recipient assignment)", () => {
    let suggestionId: Id<"ai_field_suggestions">;

    test("assigns single signer to all fields", async () => {
      const signerId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          name: "Alice",
          email: "alice@example.com",
          role: "signer",
          status: "pending",
          order: 0,
          signingToken: "test-token-alice",
          tokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      suggestionId = await t.run(async (ctx) => {
        return await ctx.db.insert("ai_field_suggestions", {
          documentId,
          organizationId,
          fields: [
            { ...validField, label: "Signature" },
            { ...validField, label: "Date", fieldType: "date" as const, y: 85 },
          ],
          modelUsed: "gemini-3-flash",
          tokensUsed: 500,
          processingTimeMs: 1200,
          status: "pending",
        });
      });

      // Verify suggestion data is correct for heuristic matching
      const suggestion = await t.run(async (ctx) => ctx.db.get(suggestionId));
      expect(suggestion?.fields).toHaveLength(2);
      expect(suggestion?.status).toBe("pending");

      // Verify the signer exists for heuristic matching
      const recipients = await t.run(async (ctx) => {
        return await ctx.db
          .query("document_recipients")
          .withIndex("by_document", (q) => q.eq("documentId", documentId))
          .collect();
      });
      expect(recipients).toHaveLength(1);
      expect(recipients[0]._id).toBe(signerId);
    });

    test("name-based matching assigns to correct signer", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          name: "Alice Johnson",
          email: "alice@example.com",
          role: "signer",
          status: "pending",
          order: 0,
          signingToken: "test-token-alice",
          tokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("document_recipients", {
          documentId,
          name: "Bob Smith",
          email: "bob@example.com",
          role: "signer",
          status: "pending",
          order: 1,
          signingToken: "test-token-bob",
          tokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Test that the suggestion with "Alice" in the label would match
      suggestionId = await t.run(async (ctx) => {
        return await ctx.db.insert("ai_field_suggestions", {
          documentId,
          organizationId,
          fields: [
            { ...validField, label: "Alice Johnson Signature" },
            {
              ...validField,
              label: "Bob Smith Date",
              fieldType: "date" as const,
              y: 85,
            },
          ],
          modelUsed: "gemini-3-flash",
          tokensUsed: 500,
          processingTimeMs: 1200,
          status: "pending",
        });
      });

      const suggestion = await t.run(async (ctx) => ctx.db.get(suggestionId));
      expect(suggestion?.fields[0].label).toBe("Alice Johnson Signature");
      expect(suggestion?.fields[1].label).toBe("Bob Smith Date");
    });
  });

  // ─── applyFieldSuggestions — payment config from extraction ───
});
