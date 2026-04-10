import { defineTable } from "convex/server";
import { v } from "convex/values";

import { dueDateTermsTuple, paymentTypeTuple } from "./payment_field_configs";
import { fieldTypeTuple } from "./signature_fields";

/**
 * Validator for AI-extracted payment terms, stored on payment-type suggestions.
 * Populated during the pipeline so configs are ready when the user applies them.
 */
export const paymentExtractionValidator = v.object({
  lineItems: v.array(
    v.object({
      description: v.string(),
      quantity: v.number(),
      unitPriceCents: v.number(),
    }),
  ),
  currency: v.string(),
  paymentType: paymentTypeTuple,
  dueDateTerms: dueDateTermsTuple,
  customDueDays: v.optional(v.number()),
  customDueDate: v.optional(v.string()),
  lateFee: v.optional(
    v.object({
      type: v.union(v.literal("percentage"), v.literal("fixed")),
      amount: v.number(),
      gracePeriodDays: v.number(),
    }),
  ),
  recurringConfig: v.optional(
    v.object({
      interval: v.union(v.literal("week"), v.literal("month"), v.literal("year")),
      intervalCount: v.number(),
    }),
  ),
  installmentsConfig: v.optional(
    v.object({
      count: v.number(),
      interval: v.union(v.literal("week"), v.literal("month")),
    }),
  ),
  depositBalanceConfig: v.optional(
    v.object({
      depositPercent: v.number(),
      balanceDueDays: v.number(),
    }),
  ),
});

export const aiFieldSuggestionsTable = defineTable({
  documentId: v.id("documents"),
  organizationId: v.id("organizations"),
  fields: v.array(
    v.object({
      fieldType: fieldTypeTuple,
      page: v.number(),
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number(),
      label: v.string(),
      confidence: v.number(),
      isRequired: v.boolean(),
    }),
  ),
  modelUsed: v.string(),
  tokensUsed: v.number(),
  processingTimeMs: v.number(),
  status: v.union(v.literal("pending"), v.literal("applied"), v.literal("dismissed")),
  // AI-extracted payment terms, populated during pipeline for payment-type fields
  paymentExtraction: v.optional(paymentExtractionValidator),
})
  .index("by_document", ["documentId"])
  .index("by_document_status", ["documentId", "status"])
  .index("by_organization", ["organizationId"]);
