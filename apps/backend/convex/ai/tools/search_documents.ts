/**
 * Agent tool: Search across all workspace documents.
 *
 * Uses hybrid search (RAG vector + BM25 text) to find relevant document
 * excerpts, then formats them as structured citations the frontend can parse.
 *
 * Citation format: <<cite:documentId:pageNumber:documentName>>
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";

import type { SearchResult } from "../search";
import { searchCache } from "../search";
import type { SealAICtx } from "../types";

export const searchDocuments = createTool({
  description:
    "Search across all workspace documents for relevant content. " +
    "Returns document excerpts with page numbers and citations. " +
    "Use this when the user asks about document contents, specific clauses, terms, dates, " +
    "or any information that might be in their uploaded documents.",
  args: z.object({
    query: z.string().describe("The search query — what to look for across documents"),
  }),
  handler: async (ctx: SealAICtx, { query }): Promise<string> => {
    try {
      // Use cached search — identical queries within 1 hour skip re-embedding
      const results = (await searchCache.fetch(ctx, {
        organizationId: ctx.organizationId,
        query,
        limit: 10,
      })) as SearchResult[];

      if (results.length === 0) {
        return "No relevant documents found for this query.";
      }

      // Format with structured citation markers that the frontend can parse
      const citations = results.map((r: SearchResult, i: number) => {
        const citeMarker = `<<cite:${r.documentId}:${r.pageNumber}:${r.documentName}>>`;
        return `[${i + 1}] ${citeMarker}\n${r.excerpt}`;
      });

      return [
        `Found ${results.length} relevant excerpts:`,
        "",
        citations.join("\n\n---\n\n"),
        "",
        "When referencing these sources in your answer, include the citation markers like <<cite:documentId:page:name>> so the user can click through to the source.",
      ].join("\n");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[SealAI Tool Error] searchDocuments:", msg);
      return `Error searching documents: ${msg}`;
    }
  },
});
