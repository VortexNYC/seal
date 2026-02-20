/**
 * Cross-Document Search: RAG-powered workspace-wide document search.
 *
 * Uses @convex-dev/rag for semantic vector search combined with built-in
 * hybrid search (vector + BM25 text via Reciprocal Rank Fusion).
 *
 * Ingestion: Documents are chunked by page and embedded on upload.
 * Search: Hybrid semantic + keyword search returns ranked excerpts with citations.
 */

import { RAG } from "@convex-dev/rag";
import { gateway } from "ai";
import { v } from "convex/values";

import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";

// =============================================================================
// RAG COMPONENT SETUP
// =============================================================================

/**
 * RAG instance for document semantic search.
 * Uses text-embedding-005 (768 dims) — higher quality than the 004 model
 * used by the agent for chat. Search embeddings benefit from the upgrade.
 *
 * Filters: status (active/archived), documentId (single-doc scoping).
 */
export const documentRag = new RAG<{ status: string; documentId: string }>(components.rag, {
  textEmbeddingModel: gateway.textEmbeddingModel("google/text-embedding-005"),
  embeddingDimension: 768,
  filterNames: ["status", "documentId"],
});

// =============================================================================
// CONSTANTS
// =============================================================================

/** Approximate char limit per chunk. Pages are natural boundaries for PDFs. */
const MAX_CHUNK_CHARS = 2000; // ~500 tokens

/** Page marker pattern inserted by unpdf text extraction (form feed). */
const PAGE_MARKER_REGEX = /\f/g;

// =============================================================================
// INGESTION
// =============================================================================

/**
 * Chunk extracted text by page boundaries.
 * If pages are too large, splits further at paragraph boundaries.
 */
function chunkTextByPage(extractedText: string): Array<{ text: string; pageNumber: number }> {
  const pages = extractedText.split(PAGE_MARKER_REGEX);
  const chunks: Array<{ text: string; pageNumber: number }> = [];

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i]?.trim();
    if (!pageText) continue;

    const pageNumber = i + 1;

    if (pageText.length <= MAX_CHUNK_CHARS) {
      chunks.push({ text: pageText, pageNumber });
    } else {
      // Split large pages at paragraph boundaries
      const paragraphs = pageText.split(/\n\n+/);
      let currentChunk = "";

      for (const para of paragraphs) {
        if (currentChunk.length + para.length > MAX_CHUNK_CHARS && currentChunk.length > 0) {
          chunks.push({ text: currentChunk.trim(), pageNumber });
          currentChunk = para;
        } else {
          currentChunk += (currentChunk ? "\n\n" : "") + para;
        }
      }

      if (currentChunk.trim()) {
        chunks.push({ text: currentChunk.trim(), pageNumber });
      }
    }
  }

  return chunks;
}

/**
 * Index a document's text for search.
 * Chunks by page, embeds via RAG component, and marks the document as indexed.
 *
 * Called by the pipeline after text extraction completes.
 * Safe to re-call: RAG's add() with same key does upsert.
 */
export const indexDocumentForSearch = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // 1. Get the document to check for extractedText
    const document = await ctx.runQuery(internal.ai.search.getDocumentForIndexing, {
      documentId: args.documentId,
    });

    if (!document || !document.extractedText) {
      console.warn(`[Search] Skipping indexing for ${args.documentId}: no extracted text`);
      return;
    }

    // 2. Chunk by page
    const chunks = chunkTextByPage(document.extractedText);
    if (chunks.length === 0) {
      console.warn(`[Search] No chunks produced for ${args.documentId}`);
      return;
    }

    // 3. Determine namespace (tenant isolation)
    const namespace = `workspace:${args.organizationId}`;

    // 4. Clean up old pages that may no longer exist (PDF replace scenario)
    const oldPageCount = document.pageCount ?? 0;
    const newMaxPage = chunks[chunks.length - 1]?.pageNumber ?? 0;
    if (oldPageCount > newMaxPage) {
      const ns = await documentRag.getNamespace(ctx, { namespace });
      if (ns) {
        for (let page = newMaxPage + 1; page <= oldPageCount; page++) {
          const key = `doc:${args.documentId}:page:${page}`;
          await documentRag.deleteByKey(ctx, {
            namespaceId: ns.namespaceId,
            key,
          });
        }
      }
    }

    // 5. Add each chunk to RAG (upserts by key)
    for (const chunk of chunks) {
      const key = `doc:${args.documentId}:page:${chunk.pageNumber}`;

      await documentRag.add(ctx, {
        namespace,
        key,
        text: chunk.text,
        title: document.name,
        metadata: {
          pageNumber: chunk.pageNumber,
          documentName: document.name,
        },
        filterValues: [
          { name: "status", value: document.status },
          { name: "documentId", value: args.documentId },
        ],
      });
    }

    // 6. Mark document as indexed
    await ctx.runMutation(internal.ai.search.markDocumentIndexed, {
      documentId: args.documentId,
    });

    console.info(`[Search] Indexed ${chunks.length} chunks for document ${args.documentId}`);
  },
});

/**
 * Remove a document's chunks from the search index.
 * Called when a document is deleted or archived.
 */
export const removeDocumentFromIndex = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    pageCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const namespace = `workspace:${args.organizationId}`;
    const ns = await documentRag.getNamespace(ctx, { namespace });
    if (!ns) return;

    const maxPages = args.pageCount ?? 100;
    for (let page = 1; page <= maxPages; page++) {
      const key = `doc:${args.documentId}:page:${page}`;
      await documentRag.deleteByKey(ctx, {
        namespaceId: ns.namespaceId,
        key,
      });
    }
  },
});

// =============================================================================
// SEARCH
// =============================================================================

export type SearchResult = {
  documentId: string;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  score: number;
};

/**
 * Hybrid search across all workspace documents.
 *
 * Uses RAG's built-in hybrid mode (vector + BM25 text merged via RRF).
 * Supports optional filters: workflow status and date range applied post-search.
 */
export const hybridSearchDocuments = internalAction({
  args: {
    organizationId: v.id("organizations"),
    query: v.string(),
    limit: v.optional(v.number()),
    workflowStatus: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SearchResult[]> => {
    const namespace = `workspace:${args.organizationId}`;
    const limit = args.limit ?? 10;

    // Use RAG's built-in hybrid search (vector + BM25 + RRF)
    const { entries } = await documentRag.search(ctx, {
      namespace,
      query: args.query,
      limit: limit * 2, // Over-fetch to allow for post-filtering
      searchType: "hybrid",
      vectorWeight: 1.2, // Slight preference for semantic matches
      textWeight: 1.0,
      vectorScoreThreshold: 0.3,
      filters: [{ name: "status", value: "active" }],
    });

    // Post-filter by workflow status and date range if specified
    const needsFilter =
      (args.workflowStatus && args.workflowStatus !== "all") || args.dateFrom || args.dateTo;

    let filtered = entries;
    if (needsFilter) {
      // Extract unique document IDs from results
      const docIdStrings = [
        ...new Set(entries.map((e) => e.key?.split(":")[1]).filter((id): id is string => !!id)),
      ];

      const docIds = docIdStrings as unknown as Id<"documents">[];
      const docs = await ctx.runQuery(internal.ai.search.getDocumentsByIds, {
        documentIds: docIds,
      });

      const docMap = new Map(docs.map((d) => [d._id.toString(), d]));

      filtered = entries.filter((e) => {
        const docId = e.key?.split(":")[1];
        if (!docId) return false;
        const doc = docMap.get(docId);
        if (!doc) return false;

        if (
          args.workflowStatus &&
          args.workflowStatus !== "all" &&
          doc.workflowStatus !== args.workflowStatus
        )
          return false;
        if (args.dateFrom && doc.createdAt < args.dateFrom) return false;
        if (args.dateTo && doc.createdAt > args.dateTo) return false;

        return true;
      });
    }

    // Build result set
    const results: SearchResult[] = [];
    for (const entry of filtered) {
      if (results.length >= limit) break;

      // Parse key: "doc:{documentId}:page:{pageNumber}"
      const parts = entry.key?.split(":") ?? [];
      const docId = parts[1] ?? "";
      const pageNum = parts[3] ? Number.parseInt(parts[3], 10) : 0;

      const metadata = entry.metadata as { pageNumber?: number; documentName?: string } | undefined;

      results.push({
        documentId: docId,
        documentName: metadata?.documentName ?? entry.title ?? "Unknown Document",
        pageNumber: metadata?.pageNumber ?? pageNum,
        excerpt: entry.text.slice(0, 500),
        score: 0,
      });
    }

    return results;
  },
});

// =============================================================================
// HELPER QUERIES/MUTATIONS
// =============================================================================

/** Get document data needed for indexing (internal only). */
export const getDocumentForIndexing = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.documentId);
  },
});

/** Get multiple documents by IDs for post-filtering. */
export const getDocumentsByIds = internalQuery({
  args: { documentIds: v.array(v.id("documents")) },
  handler: async (ctx, args) => {
    const docs: Doc<"documents">[] = [];
    for (const id of args.documentIds) {
      const doc = await ctx.db.get(id);
      if (doc) docs.push(doc);
    }
    return docs;
  },
});

/** Mark document as search-indexed. */
export const markDocumentIndexed = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      searchIndexedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
