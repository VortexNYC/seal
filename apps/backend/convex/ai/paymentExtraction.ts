/**
 * Payment term extraction for the AI pipeline.
 *
 * Called by the pipeline after field analysis detects payment-type fields.
 * Extracts structured payment data from the PDF and stores it on the
 * suggestion row so it's ready when the user applies the suggestion.
 *
 * Uses the shared paymentExtractionCache so the same PDF is never extracted
 * twice — both the pipeline path and the agent tool path share one cache entry,
 * the same updated prompt, and the same retry logic.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { paymentExtractionCache } from "./tools/extract_payment_terms";

/**
 * Extract payment terms from a PDF and store on the suggestion row.
 *
 * Called by pipeline.processDocument when field analysis finds payment fields.
 * Delegates to the shared cache — same prompt, retry logic, and 24h dedup
 * as the agent tool path.
 */
export const extractPaymentTermsForSuggestion = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    suggestionId: v.id("ai_field_suggestions"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: args.documentId,
    });
    if (!document) throw new Error("Document not found");

    // Use shared cache — same storageId yields same result across pipeline and agent paths.
    // Cache miss calls extractPaymentInternal which has retry + the latest prompt.
    const extracted = await paymentExtractionCache.fetch(ctx, {
      storageId: document.storageId as Id<"_storage">,
    });

    // Store extracted payment data on the suggestion row
    await ctx.runMutation(internal.ai.pipeline_mutations.savePaymentExtractionOnSuggestion, {
      suggestionId: args.suggestionId,
      paymentExtraction: {
        lineItems: extracted.lineItems,
        currency: extracted.currency,
        paymentType: extracted.paymentType,
        dueDateTerms: extracted.dueDateTerms,
        customDueDays: extracted.customDueDays,
        lateFee: extracted.lateFee,
        recurringConfig: extracted.recurringConfig,
        installmentsConfig: extracted.installmentsConfig,
        depositBalanceConfig: extracted.depositBalanceConfig,
      },
    });

    return {
      lineItemCount: extracted.lineItems.length,
      totalCents: extracted.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPriceCents,
        0,
      ),
      currency: extracted.currency,
      paymentType: extracted.paymentType,
    };
  },
});
