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
  },
  handler: async (ctx, args) => {
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
      await ctx.runMutation(internal.ai.mutations.saveFieldSuggestions, {
        documentId: args.documentId,
        organizationId: args.organizationId,
        fields: result.fields,
        modelUsed: "gemini-3-flash",
        tokensUsed: result.tokensUsed,
        processingTimeMs: result.processingTimeMs,
      });

      // 5. Save document annotations (redlining)
      if (result.annotations && result.annotations.length > 0) {
        await ctx.runMutation(internal.ai.mutations.saveDocumentAnnotations, {
          documentId: args.documentId,
          organizationId: args.organizationId,
          annotations: result.annotations,
          modelUsed: "gemini-3-flash",
          tokensUsed: result.tokensUsed,
          processingTimeMs: result.processingTimeMs,
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
