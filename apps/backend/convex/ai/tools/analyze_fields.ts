import { createTool } from "@convex-dev/agent";
import { z } from "zod";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { fieldAnalysisCache, type FieldAnalysisResult } from "../analyzeFieldsAction";
import type { SealAICtx } from "../types";

export const analyzeDocumentFields = createTool({
  description: "Analyze a PDF document and detect where form fields should be placed",
  args: z.object({
    documentId: z.string().describe("The Convex document ID"),
  }),
  handler: async (ctx: SealAICtx, args): Promise<string> => {
    const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: args.documentId as Id<"documents">,
    });
    if (!document) throw new Error("Document not found");

    // Use cached Gemini analysis — same PDF (storageId) returns cached result
    const result = (await fieldAnalysisCache.fetch(ctx, {
      storageId: document.storageId as Id<"_storage">,
    })) as FieldAnalysisResult;

    await ctx.runMutation(internal.ai.mutations.saveFieldSuggestions, {
      documentId: args.documentId as Id<"documents">,
      organizationId: ctx.organizationId,
      fields: result.fields,
      modelUsed: "gemini-3-flash",
      tokensUsed: result.tokensUsed,
      processingTimeMs: result.processingTimeMs,
    });

    const paymentCount = result.fields.filter((f) => f.fieldType === "payment").length;
    const paymentNote =
      paymentCount > 0
        ? ` (includes ${paymentCount} payment field(s) — payment terms will be auto-extracted when applied)`
        : "";

    return `Found ${result.fields.length} fields across the document.${paymentNote}`;
  },
});
