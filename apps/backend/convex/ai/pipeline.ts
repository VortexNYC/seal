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
import { fetchFieldAnalysisWithRetry } from "./analyzeFieldsAction";

/** Max PDF size for AI analysis (50MB — Gemini inline PDF limit). */
const MAX_AI_PDF_SIZE = 50 * 1024 * 1024;

/** Max page count for Gemini PDF analysis. */
const MAX_AI_PAGE_COUNT = 1000;

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

    // 0a. Dedup: skip if already processing (prevents parallel runs on rapid PDF replace)
    const currentDoc = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: args.documentId,
    });
    if (currentDoc?.aiProcessingStatus === "processing") {
      console.warn(`[AI Pipeline] Skipping ${args.documentId}: already processing`);
      return;
    }

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

      // 2a. Skip AI analysis for large PDFs
      if (document.fileSize > MAX_AI_PDF_SIZE) {
        console.warn(
          `[AI Pipeline] Skipping analysis for ${args.documentId}: file size ${document.fileSize} exceeds ${MAX_AI_PDF_SIZE} bytes`,
        );
        await ctx.runMutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
          documentId: args.documentId,
          status: "completed",
        });
        return;
      }

      // 2b. Skip AI analysis for very long PDFs (Gemini 1000-page limit)
      if (document.pageCount && document.pageCount > MAX_AI_PAGE_COUNT) {
        console.warn(
          `[AI Pipeline] Skipping analysis for ${args.documentId}: ${document.pageCount} pages exceeds ${MAX_AI_PAGE_COUNT} limit`,
        );
        await ctx.runMutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
          documentId: args.documentId,
          status: "completed",
        });
        return;
      }

      // 3. Run cached field analysis with retry (same storageId = cached result)
      const result = await fetchFieldAnalysisWithRetry(ctx, document.storageId as Id<"_storage">);

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
      const hasPaymentFields = result.fields.some(
        (f: { fieldType: string }) => f.fieldType === "payment",
      );
      if (hasPaymentFields && suggestionId) {
        try {
          await ctx.runAction(internal.ai.paymentExtraction.extractPaymentTermsForSuggestion, {
            documentId: args.documentId,
            organizationId: args.organizationId,
            suggestionId,
            userId: args.userId,
          });
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

      // 6. OCR fallback for scanned PDFs — if unpdf extracted no text, use Gemini
      const docForText = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
        documentId: args.documentId,
      });
      if (docForText && !docForText.extractedText?.trim()) {
        try {
          const ocrResult = await ctx.runAction(internal.ai.ocrFallback.ocrExtractText, {
            documentId: args.documentId,
          });
          if (ocrResult.charCount > 0 && args.userId) {
            await ctx.runMutation(internal.ai.usage.logAiUsage, {
              organizationId: args.organizationId,
              userId: args.userId,
              action: "ocr_fallback" as const,
              tokensUsed: ocrResult.tokensUsed,
              durationMs: ocrResult.durationMs,
              documentId: args.documentId,
              modelUsed: "gemini-3-flash",
            });
          }
        } catch (ocrError) {
          // OCR failure shouldn't block the pipeline
          console.error(`[Pipeline] OCR fallback failed for ${args.documentId}:`, ocrError);
        }
      }

      // 7. Index document for cross-document search (needs extractedText)
      try {
        await ctx.runAction(internal.ai.search.indexDocumentForSearch, {
          documentId: args.documentId,
          organizationId: args.organizationId,
        });
      } catch (searchError) {
        // Search indexing failure shouldn't block the pipeline
        console.error(`[Pipeline] Search indexing failed for ${args.documentId}:`, searchError);
      }

      // 8. Mark completed
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
