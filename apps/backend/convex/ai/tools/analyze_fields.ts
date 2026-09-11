import { createTool } from "@convex-dev/agent";
import { parse } from "@vortexnyc/convex/helpers";
import { v } from "convex/values";
import { z } from "zod";

import { internal } from "../../_generated/api";
import { fieldAnalysisCache } from "../analyzeFieldsAction";
import { toActionCacheCtx } from "../component_ctx";
import type { SealAICtx } from "../types";

export const analyzeDocumentFields = createTool({
  description:
    "Analyze a PDF document and detect where form fields should be placed",
  inputSchema: z.object({
    documentId: z
      .string()
      .optional()
      .describe("The Convex document ID (uses current document if omitted)"),
  }),
  execute: async (ctx: SealAICtx, args): Promise<string> => {
    try {
      const rawDocId = args.documentId ?? ctx.documentId;
      if (!rawDocId)
        throw new Error(
          "No document ID provided and no current document context"
        );
      const docId = parse(v.id("documents"), rawDocId);

      // Rate limit expensive Gemini vision call (20 ops/min per org)
      await ctx.runMutation(
        internal.ai.rateLimiting.checkExpensiveOperationLimit,
        {
          organizationId: ctx.organizationId.toString(),
        }
      );

      const document = await ctx.runQuery(
        internal.documents.document_reads.getDocumentInternal,
        {
          documentId: docId,
        }
      );
      if (!document) throw new Error("Document not found");

      // Use cached Gemini analysis — same PDF (storageId) returns cached result
      const result = await fieldAnalysisCache.fetch(toActionCacheCtx(ctx), {
        storageId: parse(v.id("_storage"), document.storageId),
      });

      await ctx.runMutation(internal.ai.mutations.saveFieldSuggestions, {
        documentId: docId,
        organizationId: ctx.organizationId,
        fields: result.fields,
        modelUsed: "gemini-3-flash",
        tokensUsed: result.tokensUsed,
        processingTimeMs: result.processingTimeMs,
      });

      // Save document annotations (redlining) if present
      if (result.annotations && result.annotations.length > 0) {
        await ctx.runMutation(internal.ai.mutations.saveDocumentAnnotations, {
          documentId: docId,
          vortexAuthOrganizationId: ctx.vortexAuthOrganizationId,
          organizationId: ctx.organizationId,
          annotations: result.annotations,
          modelUsed: "gemini-3-flash",
          tokensUsed: result.tokensUsed,
          processingTimeMs: result.processingTimeMs,
        });
      }

      const paymentCount = result.fields.filter(
        (f) => f.fieldType === "payment"
      ).length;
      const paymentNote =
        paymentCount > 0
          ? ` (includes ${paymentCount} payment field(s) — payment terms will be auto-extracted when applied)`
          : "";
      const annotationNote =
        result.annotations && result.annotations.length > 0
          ? ` Also found ${result.annotations.length} key clauses for document insights.`
          : "";

      return `Found ${result.fields.length} fields across the document.${paymentNote}${annotationNote}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[SealAI Tool Error] analyzeDocumentFields:", msg);
      return `Error analyzing document: ${msg}`;
    }
  },
});
