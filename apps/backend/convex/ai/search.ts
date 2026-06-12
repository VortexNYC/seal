/**
 * Cross-Document Search: RAG-powered workspace-wide document search.
 *
 * Uses @convex-dev/rag for semantic vector search combined with built-in
 * hybrid search (vector + BM25 text via Reciprocal Rank Fusion).
 *
 * Ingestion: Documents are chunked by page and embedded on upload.
 * Search: Hybrid semantic + keyword search returns ranked excerpts with citations.
 */

import { ActionCache, type ActionCacheConfig } from "@convex-dev/action-cache";
import { RAG } from "@convex-dev/rag";
import { gateway } from "ai";
import type { FunctionReference } from "convex/server";
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

type RagSearchEntry = {
  key?: string;
  metadata?: { pageNumber?: number; documentName?: string };
  title?: string;
  text: string;
};

type SearchIndexDocument = Pick<
  Doc<"documents">,
  "_id" | "name" | "status" | "extractedText" | "pageCount"
>;

type SearchFilterDocument = Pick<Doc<"documents">, "_id" | "workflowStatus" | "createdAt">;

const searchIndexDocumentValidator = v.union(
  v.object({
    _id: v.id("documents"),
    name: v.string(),
    status: v.string(),
    extractedText: v.optional(v.string()),
    pageCount: v.optional(v.number()),
  }),
  v.null(),
);

const searchFilterDocumentValidator = v.object({
  _id: v.id("documents"),
  workflowStatus: v.optional(v.string()),
  createdAt: v.number(),
});

function hasSearchFilters(args: {
  workflowStatus?: string;
  dateFrom?: number;
  dateTo?: number;
}): boolean {
  return Boolean(
    (args.workflowStatus && args.workflowStatus !== "all") || args.dateFrom || args.dateTo,
  );
}

function extractDocumentIds(entries: RagSearchEntry[]): Id<"documents">[] {
  const ids = new Set(
    entries.map((entry) => entry.key?.split(":")[1]).filter((id): id is string => Boolean(id)),
  );

  return [...ids] as unknown as Id<"documents">[];
}

function matchesSearchFilters(
  document: SearchFilterDocument,
  args: {
    workflowStatus?: string;
    dateFrom?: number;
    dateTo?: number;
  },
): boolean {
  if (
    args.workflowStatus &&
    args.workflowStatus !== "all" &&
    document.workflowStatus !== args.workflowStatus
  ) {
    return false;
  }
  if (args.dateFrom && document.createdAt < args.dateFrom) {
    return false;
  }
  if (args.dateTo && document.createdAt > args.dateTo) {
    return false;
  }
  return true;
}

function buildSearchResults(entries: RagSearchEntry[], limit: number): SearchResult[] {
  const results: SearchResult[] = [];

  for (const entry of entries) {
    if (results.length >= limit) {
      break;
    }

    const parts = entry.key?.split(":") ?? [];
    const documentId = parts[1] ?? "";
    const pageNumber = parts[3] ? Number.parseInt(parts[3], 10) : 0;
    const metadata = entry.metadata;

    results.push({
      documentId,
      documentName: metadata?.documentName ?? entry.title ?? "Unknown Document",
      pageNumber: metadata?.pageNumber ?? pageNumber,
      excerpt: entry.text.slice(0, 500),
      score: 0,
    });
  }

  return results;
}

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
      filters: [{ name: "status", value: "active" }],
    });

    let filtered = entries as RagSearchEntry[];
    if (hasSearchFilters(args)) {
      const docs = await ctx.runQuery(internal.ai.search.getDocumentsByIds, {
        documentIds: extractDocumentIds(filtered),
      });
      const docMap = new Map(
        docs.map((document: SearchFilterDocument) => [document._id.toString(), document]),
      );

      filtered = filtered.filter((entry) => {
        const documentId = entry.key?.split(":")[1];
        if (!documentId) {
          return false;
        }

        const document = docMap.get(documentId);
        if (!document) {
          return false;
        }

        return matchesSearchFilters(document, args);
      });
    }

    return buildSearchResults(filtered, limit);
  },
});

// =============================================================================
// SEARCH CACHE — avoids re-embedding identical queries within a session
// =============================================================================

type SearchAction = FunctionReference<
  "action",
  "internal",
  {
    organizationId: Id<"organizations">;
    query: string;
    limit?: number;
    workflowStatus?: string;
    dateFrom?: number;
    dateTo?: number;
  },
  SearchResult[]
>;

/** Cache for search queries — keyed on org + query + filters, 1-hour TTL.
 *  Same user asking "find GDPR" twice in a session hits cache on second call. */
export const searchCache: ActionCache<SearchAction> = new ActionCache(components.actionCache, {
  action: internal.ai.search.hybridSearchDocuments,
  name: "documentSearch-v1",
  ttl: 60 * 60 * 1000, // 1 hour
} as ActionCacheConfig<SearchAction>);

// =============================================================================
// HELPER QUERIES/MUTATIONS
// =============================================================================

/** Get document data needed for indexing (internal only). */
export const getDocumentForIndexing = internalQuery({
  args: { documentId: v.id("documents") },
  returns: searchIndexDocumentValidator,
  handler: async (ctx, args): Promise<SearchIndexDocument | null> => {
    const document = await ctx.db.get(args.documentId);
    if (document === null) {
      return null;
    }

    return {
      _id: document._id,
      name: document.name,
      status: document.status,
      extractedText: document.extractedText,
      pageCount: document.pageCount,
    };
  },
});

/** Get multiple documents by IDs for post-filtering. */
export const getDocumentsByIds = internalQuery({
  args: { documentIds: v.array(v.id("documents")) },
  returns: v.array(searchFilterDocumentValidator),
  handler: async (ctx, args): Promise<SearchFilterDocument[]> => {
    const docs: SearchFilterDocument[] = [];
    for (const id of args.documentIds) {
      const doc = await ctx.db.get(id);
      if (doc) {
        docs.push({
          _id: doc._id,
          workflowStatus: doc.workflowStatus,
          createdAt: doc.createdAt,
        });
      }
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
