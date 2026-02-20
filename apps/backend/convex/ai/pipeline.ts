/**
 * Automatic AI document processing pipeline.
 *
 * Scheduled by document mutations (create, replace PDF, restore version).
 * Downloads the PDF → runs Gemini field analysis (cached) → saves suggestions.
 * Also indexes document text for cross-document search.
 * Payment extraction is triggered later when suggestions are applied.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { fieldAnalysisCache, type FieldAnalysisResult } from "./analyzeFieldsAction";

export const processDocument = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // 0. Check if AI is enabled for this workspace
    const aiSettings = await ctx.runQuery(internal.organizations.queries.getAiSettingsInternal, {
      organizationId: args.organizationId,
    });
    if (!aiSettings.aiEnabled) return;

    // 1. Mark processing
    await ctx.runMutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
      documentId: args.documentId,
      status: "processing",
    });

    try {
      // 2. Get the document to find storageId
      const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
        documentId: args.documentId,
      });
      if (!document) throw new Error("Document not found");

      // 3. Run cached field analysis (same storageId = cached result)
      const result = (await fieldAnalysisCache.fetch(ctx, {
        storageId: document.storageId as Id<"_storage">,
      })) as FieldAnalysisResult;

      // 4. Save field suggestions (dismisses existing pending ones internally)
      const suggestionId = await ctx.runMutation(internal.ai.mutations.saveFieldSuggestions, {
        documentId: args.documentId,
        organizationId: args.organizationId,
        fields: result.fields,
        modelUsed: "gemini-3-flash",
        tokensUsed: result.tokensUsed,
        processingTimeMs: result.processingTimeMs,
      });

      // 4a. If payment fields detected, extract payment terms and embed on suggestion
      const hasPaymentFields = result.fields.some((f) => f.fieldType === "payment");
      if (hasPaymentFields && suggestionId) {
        try {
          await ctx.runAction(
            internal.ai.paymentExtraction.extractPaymentTermsForSuggestion,
            {
              documentId: args.documentId,
              organizationId: args.organizationId,
              suggestionId,
            },
          );
        } catch (paymentError) {
          // Payment extraction failure shouldn't block the rest of the pipeline
          console.error(
            `[Pipeline] Payment extraction failed for ${args.documentId}:`,
            paymentError,
          );
        }
      }

      // 4b. Log field analysis usage
      if (args.userId) {
        await ctx.runMutation(internal.ai.usage.logAiUsage, {
          organizationId: args.organizationId,
          userId: args.userId,
          action: "field_analysis" as const,
          tokensUsed: result.tokensUsed,
          durationMs: result.processingTimeMs,
          documentId: args.documentId,
          modelUsed: "gemini-3-flash",
        });
      }

      // 5. Save document annotations (redlining)
      if (result.annotations && result.annotations.length > 0) {
        await ctx.runMutation(internal.ai.mutations.saveDocumentAnnotations, {
          documentId: args.documentId,
          organizationId: args.organizationId,
          annotations: result.annotations,
          modelUsed: "gemini-3-flash",
          tokensUsed: result.tokensUsed,
          processingTimeMs: result.processingTimeMs,
          forceOverrideDismissal: true,
        });
      }

      // 5b. Log redlining usage
      if (result.annotations && result.annotations.length > 0 && args.userId) {
        await ctx.runMutation(internal.ai.usage.logAiUsage, {
          organizationId: args.organizationId,
          userId: args.userId,
          action: "redlining" as const,
          tokensUsed: result.tokensUsed,
          durationMs: result.processingTimeMs,
          documentId: args.documentId,
          modelUsed: "gemini-3-flash",
        });
      }

      // 6. Index document for cross-document search (needs extractedText)
      try {
        await ctx.runAction(internal.ai.search.indexDocumentForSearch, {
          documentId: args.documentId,
          organizationId: args.organizationId,
        });
      } catch (searchError) {
        // Search indexing failure shouldn't block the pipeline
        console.error(`[Pipeline] Search indexing failed for ${args.documentId}:`, searchError);
      }

      // 7. Mark completed
      await ctx.runMutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId: args.documentId,
        status: "completed",
      });
    } catch (error) {
      // Mark failed but don't crash — this is background processing
      await ctx.runMutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
        documentId: args.documentId,
        status: "failed",
      });
      console.error(`AI pipeline failed for document ${args.documentId}:`, error);
    }
  },
});
