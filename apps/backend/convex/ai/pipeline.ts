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
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { fetchFieldAnalysisWithRetry } from "./analyzeFieldsAction";

/** Max PDF size for AI analysis (50MB — Gemini inline PDF limit). */
const MAX_AI_PDF_SIZE = 50 * 1024 * 1024;

/** Max page count for Gemini PDF analysis. */
const MAX_AI_PAGE_COUNT = 1000;

type ProcessDocumentArgs = {
  documentId: Id<"documents">;
  organizationId: Id<"organizations">;
  userId?: Id<"users">;
};

type FieldAnalysisResult = Awaited<ReturnType<typeof fetchFieldAnalysisWithRetry>>;
type InternalDocument = Doc<"documents">;

async function setProcessingStatus(
  ctx: ActionCtx,
  documentId: Id<"documents">,
  status: "processing" | "completed" | "failed",
): Promise<void> {
  await ctx.runMutation(internal.ai.pipeline_mutations.setAiProcessingStatus, {
    documentId,
    status,
  });
}

async function shouldProcessDocument(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  documentId: Id<"documents">,
): Promise<boolean> {
  const aiSettings = await ctx.runQuery(internal.organizations.queries.getAiSettingsInternal, {
    organizationId,
  });
  if (!aiSettings.aiEnabled) {
    return false;
  }

  const currentDoc = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
    documentId,
  });
  if (currentDoc?.aiProcessingStatus === "processing") {
    console.warn(`[AI Pipeline] Skipping ${documentId}: already processing`);
    return false;
  }

  return true;
}

async function getProcessableDocument(
  ctx: ActionCtx,
  documentId: Id<"documents">,
): Promise<InternalDocument> {
  const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
    documentId,
  });
  if (!document) {
    throw new Error("Document not found");
  }
  return document;
}

async function shouldSkipAnalysis(
  ctx: ActionCtx,
  document: InternalDocument,
  documentId: Id<"documents">,
): Promise<boolean> {
  if (document.fileSize > MAX_AI_PDF_SIZE) {
    console.warn(
      `[AI Pipeline] Skipping analysis for ${documentId}: file size ${document.fileSize} exceeds ${MAX_AI_PDF_SIZE} bytes`,
    );
    await setProcessingStatus(ctx, documentId, "completed");
    return true;
  }

  if (document.pageCount && document.pageCount > MAX_AI_PAGE_COUNT) {
    console.warn(
      `[AI Pipeline] Skipping analysis for ${documentId}: ${document.pageCount} pages exceeds ${MAX_AI_PAGE_COUNT} limit`,
    );
    await setProcessingStatus(ctx, documentId, "completed");
    return true;
  }

  return false;
}

async function logAiUsage(
  ctx: ActionCtx,
  args: ProcessDocumentArgs,
  action: "field_analysis" | "redlining" | "ocr_fallback",
  usage: { tokensUsed: number; durationMs: number },
): Promise<void> {
  if (!args.userId) {
    return;
  }

  await ctx.runMutation(internal.ai.usage.logAiUsage, {
    organizationId: args.organizationId,
    userId: args.userId,
    action,
    tokensUsed: usage.tokensUsed,
    durationMs: usage.durationMs,
    documentId: args.documentId,
    modelUsed: "gemini-3-flash",
  });
}

async function maybeExtractPaymentTerms(
  ctx: ActionCtx,
  args: ProcessDocumentArgs,
  result: FieldAnalysisResult,
  suggestionId: Id<"ai_field_suggestions"> | null,
): Promise<void> {
  const hasPaymentFields = result.fields.some(
    (field: { fieldType: string }) => field.fieldType === "payment",
  );
  if (!hasPaymentFields || !suggestionId) {
    return;
  }

  try {
    await ctx.runAction(internal.ai.paymentExtraction.extractPaymentTermsForSuggestion, {
      documentId: args.documentId,
      organizationId: args.organizationId,
      suggestionId,
      userId: args.userId,
    });
  } catch (paymentError) {
    console.error(`[Pipeline] Payment extraction failed for ${args.documentId}:`, paymentError);
  }
}

async function maybeSaveAnnotations(
  ctx: ActionCtx,
  args: ProcessDocumentArgs,
  result: FieldAnalysisResult,
): Promise<void> {
  if (!result.annotations || result.annotations.length === 0) {
    return;
  }

  await ctx.runMutation(internal.ai.mutations.saveDocumentAnnotations, {
    documentId: args.documentId,
    organizationId: args.organizationId,
    annotations: result.annotations,
    modelUsed: "gemini-3-flash",
    tokensUsed: result.tokensUsed,
    processingTimeMs: result.processingTimeMs,
    forceOverrideDismissal: true,
  });

  await logAiUsage(ctx, args, "redlining", {
    tokensUsed: result.tokensUsed,
    durationMs: result.processingTimeMs,
  });
}

async function maybeRunOcrFallback(ctx: ActionCtx, args: ProcessDocumentArgs): Promise<void> {
  const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
    documentId: args.documentId,
  });
  if (!document || document.extractedText?.trim()) {
    return;
  }

  try {
    const ocrResult = await ctx.runAction(internal.ai.ocrFallback.ocrExtractText, {
      documentId: args.documentId,
    });
    if (ocrResult.charCount > 0) {
      await logAiUsage(ctx, args, "ocr_fallback", {
        tokensUsed: ocrResult.tokensUsed,
        durationMs: ocrResult.durationMs,
      });
    }
  } catch (ocrError) {
    console.error(`[Pipeline] OCR fallback failed for ${args.documentId}:`, ocrError);
  }
}

async function safeIndexDocumentForSearch(
  ctx: ActionCtx,
  documentId: Id<"documents">,
  organizationId: Id<"organizations">,
): Promise<void> {
  try {
    await ctx.runAction(internal.ai.search.indexDocumentForSearch, {
      documentId,
      organizationId,
    });
  } catch (searchError) {
    console.error(`[Pipeline] Search indexing failed for ${documentId}:`, searchError);
  }
}

async function runDocumentProcessing(ctx: ActionCtx, args: ProcessDocumentArgs): Promise<void> {
  const document = await getProcessableDocument(ctx, args.documentId);
  if (await shouldSkipAnalysis(ctx, document, args.documentId)) {
    return;
  }

  const result = await fetchFieldAnalysisWithRetry(ctx, document.storageId as Id<"_storage">);
  const suggestionId = await ctx.runMutation(internal.ai.mutations.saveFieldSuggestions, {
    documentId: args.documentId,
    organizationId: args.organizationId,
    fields: result.fields,
    modelUsed: "gemini-3-flash",
    tokensUsed: result.tokensUsed,
    processingTimeMs: result.processingTimeMs,
  });

  await maybeExtractPaymentTerms(ctx, args, result, suggestionId);
  await logAiUsage(ctx, args, "field_analysis", {
    tokensUsed: result.tokensUsed,
    durationMs: result.processingTimeMs,
  });
  await maybeSaveAnnotations(ctx, args, result);
  await maybeRunOcrFallback(ctx, args);
  await safeIndexDocumentForSearch(ctx, args.documentId, args.organizationId);
}

export const processDocument = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!(await shouldProcessDocument(ctx, args.organizationId, args.documentId))) {
      return;
    }

    await setProcessingStatus(ctx, args.documentId, "processing");

    try {
      await runDocumentProcessing(ctx, args);
      await setProcessingStatus(ctx, args.documentId, "completed");
    } catch (error) {
      await setProcessingStatus(ctx, args.documentId, "failed");
      console.error(`AI pipeline failed for document ${args.documentId}:`, error);
    }
  },
});
