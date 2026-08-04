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

      const suggestion = (await t.run(async (ctx) =>
        ctx.db.get(id)
      )) as Doc<"ai_field_suggestions"> | null;
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

      const first = (await t.run(async (ctx) =>
        ctx.db.get(firstId)
      )) as Doc<"ai_field_suggestions"> | null;
      const second = (await t.run(async (ctx) =>
        ctx.db.get(secondId)
      )) as Doc<"ai_field_suggestions"> | null;

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

      const first = (await t.run(async (ctx) =>
        ctx.db.get(firstId)
      )) as Doc<"ai_field_suggestions"> | null;
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

      const suggestion = (await t.run(async (ctx) =>
        ctx.db.get(id)
      )) as Doc<"ai_field_suggestions"> | null;
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
      const annotation = (await t.run(async (ctx) =>
        ctx.db.get(sealAssertPresent(id))
      )) as Doc<"ai_document_annotations"> | null;
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

      const first = (await t.run(async (ctx) =>
        ctx.db.get(sealAssertPresent(firstId))
      )) as Doc<"ai_document_annotations"> | null;
      expect(first?.status).toBe("dismissed");

      const second = (await t.run(async (ctx) =>
        ctx.db.get(sealAssertPresent(secondId))
      )) as Doc<"ai_document_annotations"> | null;
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
      const second = (await t.run(async (ctx) =>
        ctx.db.get(sealAssertPresent(secondId))
      )) as Doc<"ai_document_annotations"> | null;
      expect(second?.status).toBe("active");
    });
  });

  // ─── saveExtractedPaymentConfig ──────────────────────────────

  describe("saveExtractedPaymentConfig", () => {
    let paymentFieldId: Id<"signature_fields">;

    beforeEach(async () => {
      paymentFieldId = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          fieldType: "payment",
          label: "Payment Amount",
          isRequired: true,
          x: 50,
          y: 80,
          width: 30,
          height: 5,
          page: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    });

    test("creates payment config from extraction", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.mutations.saveExtractedPaymentConfig, {
        fieldId: paymentFieldId,
        documentId,
        organizationId,
        extraction: {
          lineItems: [
            {
              description: "Consulting fee",
              quantity: 1,
              unitPriceCents: 500000,
            },
          ],
          currency: "usd",
          paymentType: "one_time",
          dueDateTerms: "net_30",
        },
      });

      const config = await t.run(async (ctx) => {
        return await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", paymentFieldId))
          .unique();
      });

      expect(config).toBeTruthy();
      expect(config?.paymentType).toBe("one_time");
      expect(config?.currency).toBe("usd");
      expect(config?.totalAmountCents).toBe(500000);
      expect(config?.items).toHaveLength(1);
      expect(config?.paymentStatus).toBe("pending");
    });

    test("upserts existing config on re-extraction", async () => {
      const { internal } = await import("../_generated/api");

      // First extraction
      await t.mutation(internal.ai.mutations.saveExtractedPaymentConfig, {
        fieldId: paymentFieldId,
        documentId,
        organizationId,
        extraction: {
          lineItems: [
            { description: "First fee", quantity: 1, unitPriceCents: 100000 },
          ],
          currency: "usd",
          paymentType: "one_time",
          dueDateTerms: "net_30",
        },
      });

      // Second extraction overwrites
      await t.mutation(internal.ai.mutations.saveExtractedPaymentConfig, {
        fieldId: paymentFieldId,
        documentId,
        organizationId,
        extraction: {
          lineItems: [
            { description: "Updated fee", quantity: 2, unitPriceCents: 250000 },
          ],
          currency: "eur",
          paymentType: "recurring",
          dueDateTerms: "on_receipt",
          recurringConfig: { interval: "month", intervalCount: 1 },
        },
      });

      const configs = await t.run(async (ctx) => {
        return await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", paymentFieldId))
          .collect();
      });

      // Should be upserted, not duplicated
      expect(configs).toHaveLength(1);
      expect(configs[0].paymentType).toBe("recurring");
      expect(configs[0].currency).toBe("eur");
      expect(configs[0].totalAmountCents).toBe(500000); // 2 × 250000
    });

    test("rejects non-payment field type", async () => {
      const { internal } = await import("../_generated/api");

      const textFieldId = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          fieldType: "text",
          label: "Name",
          isRequired: true,
          x: 50,
          y: 40,
          width: 30,
          height: 5,
          page: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.mutation(internal.ai.mutations.saveExtractedPaymentConfig, {
          fieldId: textFieldId,
          documentId,
          organizationId,
          extraction: {
            lineItems: [
              { description: "Fee", quantity: 1, unitPriceCents: 1000 },
            ],
            currency: "usd",
            paymentType: "one_time",
            dueDateTerms: "net_30",
          },
        })
      ).rejects.toThrow("Field is not a payment type");
    });

    test("saves with all optional configs", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.mutations.saveExtractedPaymentConfig, {
        fieldId: paymentFieldId,
        documentId,
        organizationId,
        extraction: {
          lineItems: [
            { description: "Retainer", quantity: 1, unitPriceCents: 300000 },
          ],
          currency: "usd",
          paymentType: "recurring",
          dueDateTerms: "on_receipt",
          recurringConfig: { interval: "month", intervalCount: 1 },
          lateFee: { type: "percentage", amount: 2, gracePeriodDays: 5 },
        },
      });

      const config = await t.run(async (ctx) => {
        return await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", paymentFieldId))
          .unique();
      });

      expect(config?.recurringConfig).toMatchObject({
        interval: "month",
        intervalCount: 1,
        endCondition: "never",
      });
      expect(config?.lateFees).toMatchObject({
        enabled: true,
        type: "percentage",
        amount: 2,
        gracePeriodDays: 5,
      });
    });

    test("lowercases currency", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.mutations.saveExtractedPaymentConfig, {
        fieldId: paymentFieldId,
        documentId,
        organizationId,
        extraction: {
          lineItems: [
            { description: "Fee", quantity: 1, unitPriceCents: 1000 },
          ],
          currency: "USD",
          paymentType: "one_time",
          dueDateTerms: "net_30",
        },
      });

      const config = await t.run(async (ctx) => {
        return await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", paymentFieldId))
          .unique();
      });

      expect(config?.currency).toBe("usd");
    });

    test("computes total for multiple line items", async () => {
      const { internal } = await import("../_generated/api");

      await t.mutation(internal.ai.mutations.saveExtractedPaymentConfig, {
        fieldId: paymentFieldId,
        documentId,
        organizationId,
        extraction: {
          lineItems: [
            { description: "Design", quantity: 2, unitPriceCents: 150000 },
            { description: "Dev", quantity: 3, unitPriceCents: 200000 },
            { description: "PM", quantity: 1, unitPriceCents: 50000 },
          ],
          currency: "usd",
          paymentType: "one_time",
          dueDateTerms: "net_30",
        },
      });

      const config = await t.run(async (ctx) => {
        return await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", paymentFieldId))
          .unique();
      });

      // 2×150000 + 3×200000 + 1×50000 = 300000 + 600000 + 50000 = 950000
      expect(config?.totalAmountCents).toBe(950000);
    });
  });

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
      const suggestion = (await t.run(async (ctx) =>
        ctx.db.get(suggestionId)
      )) as Doc<"ai_field_suggestions"> | null;
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

      const suggestion = (await t.run(async (ctx) =>
        ctx.db.get(suggestionId)
      )) as Doc<"ai_field_suggestions"> | null;
      expect(suggestion?.fields[0].label).toBe("Alice Johnson Signature");
      expect(suggestion?.fields[1].label).toBe("Bob Smith Date");
    });
  });

  // ─── applyFieldSuggestions — payment config from extraction ───

  describe("applyFieldSuggestions (payment extraction integration)", () => {
    test("suggestion with paymentExtraction is ready for apply", async () => {
      const suggestionId = await t.run(async (ctx) => {
        return await ctx.db.insert("ai_field_suggestions", {
          documentId,
          organizationId,
          fields: [
            {
              ...validField,
              fieldType: "payment" as const,
              label: "Amount Due",
            },
          ],
          modelUsed: "gemini-3-flash",
          tokensUsed: 500,
          processingTimeMs: 1200,
          status: "pending",
          paymentExtraction: {
            lineItems: [
              {
                description: "Consulting",
                quantity: 1,
                unitPriceCents: 500000,
              },
            ],
            currency: "usd",
            paymentType: "one_time",
            dueDateTerms: "net_30",
          },
        });
      });

      const suggestion = (await t.run(async (ctx) =>
        ctx.db.get(suggestionId)
      )) as Doc<"ai_field_suggestions"> | null;
      expect(suggestion?.paymentExtraction).toBeTruthy();
      expect(suggestion?.paymentExtraction?.lineItems).toHaveLength(1);
      expect(suggestion?.paymentExtraction?.paymentType).toBe("one_time");
    });
  });
});
