# Cross-Document Search — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Workspace-wide conversational search across all documents — users ask natural language questions and get AI-generated answers grounded in their actual documents, with citations linking to specific pages. Includes command palette (Cmd+K) for quick search, dedicated search page with filters and citation chips, and full re-indexing support.

**Architecture:** Uses `@convex-dev/rag` for chunking/embedding/vector search, `@convex-dev/agent` for conversational threads, and hybrid search (vector + BM25 text) merged via `hybridRank`. Ingestion runs automatically on document upload. Search is exposed as an agent tool the AI calls when appropriate. Command palette provides lightweight instant search without the full agent.

**Tech Stack:** `@convex-dev/rag`, `@convex-dev/agent` (already installed), `hybridRank`, Vercel AI Gateway (`google/text-embedding-005`), Gemini Flash, TanStack Router, Shadcn UI (`Command` component), `cmdk`, `use-debounce`.

---

## Context

### Existing Infrastructure (already in Seal)

- **Agent**: `convex/ai/agent.ts` — `sealAgent` using Gemini Flash + text-embedding-004
- **Streaming UI**: `components/documents/ai-chat-panel.tsx` — `useUIMessages`, `useSmoothText`, `optimisticallySendMessage`
- **Text extraction**: `convex/documents/extract_text_action.ts` — uses `unpdf` to extract text from PDFs on upload
- **BM25 search index**: `schemas/documents.ts:95-98` — `search_text` index on `extractedText` with `organizationId`/`status` filters
- **Text search query**: `convex/documents/queries.ts:~459` — `searchDocumentText` uses the search index
- **Convex config**: `convex/convex.config.ts` — uses `agent`, `rateLimiter`, `actionCache`, `actionRetrier` (NOT `rag` yet)
- **Pipeline**: `convex/ai/pipeline.ts` — orchestrates AI processing on document create/replace/restore

### Reference Implementations

- **Plasma RAG**: `plasma/convex/ai/memory.ts` — `new RAG<FilterTypes>(components.rag, { ... })`, `hybridRank`
- **Plasma Convex config**: uses `app.use(rag)` from `@convex-dev/rag/convex.config`
- **Plasma Cmd+K**: `plasma/apps/landing/src/components/search-dialog.tsx` — `cmdk` + Shadcn Dialog, 100ms debounce, Cmd+K global listener, keyboard nav footer
- **Catapult Cmd+K**: `Catapult/src/features/global-search/components/GlobalSearchDialog.tsx` — `cmdk` + Shadcn Command, Convex queries, TanStack Router navigation, 2-char minimum query

---

## Task 1: Install dependencies and register RAG component

**Files:**

- Modify: `apps/backend/package.json`
- Modify: `apps/backend/convex/convex.config.ts`
- Modify: `apps/web/package.json`

**Step 1:** Install the RAG package:

```bash
cd apps/backend && bun add @convex-dev/rag
```

**Step 2:** Install frontend dependencies for command palette:

```bash
cd apps/web && pnpx shadcn@latest add command && bun add use-debounce
```

This installs the Shadcn `Command` component (which wraps `cmdk`) and `use-debounce` for search input debouncing.

**Step 3:** Register the RAG component in `apps/backend/convex/convex.config.ts`. Add the import and `app.use(rag)`:

```ts
import actionCache from "@convex-dev/action-cache/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import agent from "@convex-dev/agent/convex.config";
import rag from "@convex-dev/rag/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(agent);
app.use(rateLimiter);
app.use(actionCache);
app.use(actionRetrier);
app.use(rag);

export default app;
```

**Step 4:** Regenerate types:

```bash
cd apps/backend && npx convex codegen
```

**Step 5:** Verify types compile:

```bash
bun --bun run typecheck
```

**Step 6:** Commit: `feat(search): install @convex-dev/rag, shadcn command, and register component`

---

## Task 2: Add `searchIndexedAt` to documents schema

**Files:**

- Modify: `apps/backend/convex/schemas/documents.ts`

**Step 1:** Add the field after `aiProcessingStatus` (line ~56):

```ts
  // Search indexing
  searchIndexedAt: v.optional(v.number()), // When document was last embedded for search
```

**Step 2:** Regenerate types:

```bash
cd apps/backend && npx convex codegen
```

**Step 3:** Verify types compile:

```bash
cd apps/backend && bun --bun run typecheck
```

**Step 4:** Commit: `feat(search): add searchIndexedAt field to documents schema`

---

## Task 3: Create RAG instance and document search module

**Files:**

- Create: `apps/backend/convex/ai/search.ts`

This is the core search module — sets up the RAG instance, provides ingestion helpers, and implements hybrid search with filter support.

**Step 1:** Create `apps/backend/convex/ai/search.ts`:

```ts
/**
 * Cross-Document Search: RAG-powered workspace-wide document search.
 *
 * Uses @convex-dev/rag for semantic vector search combined with Convex's native
 * BM25 text search, merged via hybridRank (Reciprocal Rank Fusion).
 *
 * Ingestion: Documents are chunked by page and embedded on upload.
 * Search: Hybrid semantic + keyword search returns ranked excerpts with citations.
 */

import { hybridRank, RAG } from "@convex-dev/rag";
import { gateway } from "ai";
import { v } from "convex/values";

import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";

// =============================================================================
// RAG COMPONENT SETUP
// =============================================================================

/**
 * Filter types for document RAG search.
 * Allows scoping by document status and specific document ID.
 */
interface DocumentFilterTypes {
  [key: string]: string;
  status: string;
  documentId: string;
}

/**
 * RAG instance for document semantic search.
 * Uses text-embedding-005 (768 dims) — higher quality than the 004 model
 * used by the agent for chat. Search embeddings benefit from the upgrade.
 */
export const documentRag = new RAG<DocumentFilterTypes>(components.rag, {
  textEmbeddingModel: gateway.textEmbeddingModel("google/text-embedding-005"),
  embeddingDimension: 768,
  filterNames: ["status", "documentId"],
});

// =============================================================================
// CONSTANTS
// =============================================================================

/** Approximate token limit per chunk. Pages are natural boundaries for PDFs. */
const MAX_CHUNK_CHARS = 2000; // ~500 tokens

/** Page marker pattern inserted by unpdf text extraction. */
const PAGE_MARKER_REGEX = /\f/g; // Form feed characters separate pages in unpdf output

// =============================================================================
// INGESTION
// =============================================================================

/**
 * Chunk extracted text by page boundaries.
 * If pages are too large, splits further at paragraph boundaries.
 * Returns array of { text, pageNumber } chunks.
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
    const newPageCount = chunks[chunks.length - 1]?.pageNumber ?? 0;
    if (oldPageCount > newPageCount) {
      for (let page = newPageCount + 1; page <= oldPageCount; page++) {
        const key = `doc:${args.documentId}:page:${page}`;
        try {
          await documentRag.delete(ctx, { namespace, key });
        } catch {
          // Key doesn't exist — fine
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
    const maxPages = args.pageCount ?? 100; // Safety limit

    for (let page = 1; page <= maxPages; page++) {
      const key = `doc:${args.documentId}:page:${page}`;
      try {
        await documentRag.delete(ctx, { namespace, key });
      } catch {
        // Key doesn't exist — we've passed the last page
        break;
      }
    }
  },
});

// =============================================================================
// SEARCH
// =============================================================================

/** Workflow status filter values. */
type WorkflowStatusFilter =
  | "draft"
  | "sent"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "declined"
  | "all";

/**
 * Hybrid search across all workspace documents.
 * Combines RAG vector search (semantic) with Convex BM25 text search (keyword),
 * merged via Reciprocal Rank Fusion for best-of-both-worlds results.
 *
 * Supports optional filters: workflow status and date range.
 */
export const hybridSearchDocuments = internalAction({
  args: {
    organizationId: v.id("organizations"),
    query: v.string(),
    limit: v.optional(v.number()),
    workflowStatus: v.optional(v.string()), // "all" or specific status
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const namespace = `workspace:${args.organizationId}`;
    const limit = args.limit ?? 10;

    // 1. RAG vector search (semantic)
    const { results: ragResultsRaw, entries } = await documentRag.search(ctx, {
      namespace,
      query: args.query,
      limit: limit * 2,
      vectorScoreThreshold: 0.5,
      filters: [{ name: "status", value: "active" }],
    });

    // Map to keys with scores
    const ragResults = ragResultsRaw.map((r) => {
      const entry = entries.find((e) => e.entryId === r.entryId);
      return { key: entry?.key ?? "", score: r.score, text: entry?.text ?? "" };
    });

    // 2. BM25 text search via existing search index
    const textResults: Array<Doc<"documents">> = await ctx.runQuery(
      internal.ai.search.searchDocumentTextInternal,
      {
        organizationId: args.organizationId,
        query: args.query,
        limit: limit * 2,
      },
    );

    // 3. Hybrid rank merge via Reciprocal Rank Fusion
    const ragKeys = ragResults.map((r) => r.key);
    const textIds = textResults.map((d) => d._id.toString());

    const ranked = hybridRank([ragKeys, textIds], {
      k: 60,
      weights: [1.2, 1.0], // Slight preference for semantic results
    });

    // 4. Build result set with metadata
    const ragKeyMap = new Map(ragResults.map((r) => [r.key, r]));
    const textIdMap = new Map(textResults.map((d) => [d._id.toString(), d]));

    type SearchResult = {
      documentId: string;
      documentName: string;
      pageNumber: number | null;
      excerpt: string;
      score: number;
      source: "semantic" | "keyword";
      workflowStatus: string;
      createdAt: number;
    };

    const results: SearchResult[] = [];
    const seen = new Set<string>();

    for (const id of ranked) {
      if (results.length >= limit) break;

      // Try RAG result first
      const ragHit = ragKeyMap.get(id);
      if (ragHit && !seen.has(ragHit.key)) {
        seen.add(ragHit.key);
        // Parse key: "doc:{documentId}:page:{pageNumber}"
        const parts = ragHit.key.split(":");
        const docId = parts[1] ?? "";
        const pageNum = parts[3] ? Number.parseInt(parts[3], 10) : null;

        // Look up document metadata
        const doc = textResults.find((d) => d._id.toString() === docId);

        // Apply filters
        if (
          args.workflowStatus &&
          args.workflowStatus !== "all" &&
          doc?.workflowStatus !== args.workflowStatus
        )
          continue;
        if (args.dateFrom && doc && doc.createdAt < args.dateFrom) continue;
        if (args.dateTo && doc && doc.createdAt > args.dateTo) continue;

        results.push({
          documentId: docId,
          documentName: doc?.name ?? "Unknown Document",
          pageNumber: pageNum,
          excerpt: ragHit.text.slice(0, 500),
          score: ragHit.score,
          source: "semantic",
          workflowStatus: doc?.workflowStatus ?? "draft",
          createdAt: doc?.createdAt ?? 0,
        });
        continue;
      }

      // Try text result
      const textHit = textIdMap.get(id);
      if (textHit && !seen.has(id)) {
        seen.add(id);

        // Apply filters
        if (
          args.workflowStatus &&
          args.workflowStatus !== "all" &&
          textHit.workflowStatus !== args.workflowStatus
        )
          continue;
        if (args.dateFrom && textHit.createdAt < args.dateFrom) continue;
        if (args.dateTo && textHit.createdAt > args.dateTo) continue;

        results.push({
          documentId: textHit._id.toString(),
          documentName: textHit.name,
          pageNumber: null,
          excerpt: (textHit.extractedText ?? "").slice(0, 500),
          score: 0.5,
          source: "keyword",
          workflowStatus: textHit.workflowStatus ?? "draft",
          createdAt: textHit.createdAt ?? 0,
        });
      }
    }

    return results;
  },
});

/**
 * Quick search for command palette (Cmd+K).
 * Lightweight hybrid search that returns top 5 results without going through the agent.
 * Optimized for low latency — no agent, no streaming, just ranked results.
 */
export const quickSearch = internalAction({
  args: {
    organizationId: v.id("organizations"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.runAction(internal.ai.search.hybridSearchDocuments, {
      organizationId: args.organizationId,
      query: args.query,
      limit: 5,
    });
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

/** Internal BM25 text search (used by hybrid search). */
export const searchDocumentTextInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("documents")
      .withSearchIndex("search_text", (q) =>
        q
          .search("extractedText", args.query)
          .eq("organizationId", args.organizationId)
          .eq("status", "active"),
      )
      .take(args.limit);
  },
});

/**
 * Resolve document names for a list of document IDs.
 * Used by the search tool to enrich RAG results with document metadata.
 */
export const getDocumentNames = internalQuery({
  args: {
    documentIds: v.array(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const names: Record<string, string> = {};
    for (const id of args.documentIds) {
      const doc = await ctx.db.get(id);
      if (doc) {
        names[id.toString()] = doc.name;
      }
    }
    return names;
  },
});
```

**Step 2:** Verify types compile:

```bash
cd apps/backend && bun --bun run typecheck
```

**Step 3:** Commit: `feat(search): create RAG-powered document search module with filters`

---

## Task 4: Create the `searchDocuments` agent tool with structured citations

**Files:**

- Create: `apps/backend/convex/ai/tools/search_documents.ts`
- Modify: `apps/backend/convex/ai/agent.ts`

**Step 1:** Create `apps/backend/convex/ai/tools/search_documents.ts`:

```ts
/**
 * Agent tool: Search across all workspace documents.
 *
 * Uses hybrid search (RAG vector + BM25 text) to find relevant document
 * excerpts, then formats them as structured citations the frontend can parse.
 *
 * Citation format: <<cite:documentId:pageNumber>> — parsed by CitationChip component.
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";

import { internal } from "../../_generated/api";
import type { SealAICtx } from "../types";

export const searchDocuments = createTool<SealAICtx>({
  description:
    "Search across all workspace documents for relevant content. " +
    "Returns document excerpts with page numbers and citations. " +
    "Use this when the user asks about document contents, specific clauses, terms, dates, " +
    "or any information that might be in their uploaded documents.",
  args: z.object({
    query: z.string().describe("The search query — what to look for across documents"),
  }),
  handler: async (ctx, { query }) => {
    const results = await ctx.runAction(internal.ai.search.hybridSearchDocuments, {
      organizationId: ctx.organizationId,
      query,
      limit: 10,
    });

    if (results.length === 0) {
      return "No relevant documents found for this query.";
    }

    // Format with structured citation markers that the frontend can parse
    // Format: <<cite:documentId:pageNumber:documentName>>
    const citations = results.map((r, i) => {
      const citeMarker = `<<cite:${r.documentId}:${r.pageNumber ?? 0}:${r.documentName}>>`;
      return `[${i + 1}] ${citeMarker}\n${r.excerpt}`;
    });

    return `Found ${results.length} relevant excerpts:\n\n${citations.join("\n\n---\n\n")}\n\nWhen referencing these sources in your answer, include the citation markers like <<cite:documentId:page:name>> so the user can click through to the source.`;
  },
});
```

**Step 2:** Update `apps/backend/convex/ai/agent.ts` to include the new tool. The full updated file:

```ts
import { Agent } from "@convex-dev/agent";

import { components } from "../_generated/api";
import { getEmbeddingModel, getModel } from "./model";
import { analyzeDocumentFields } from "./tools/analyze_fields";
import { extractPaymentTerms } from "./tools/extract_payment_terms";
import { searchDocuments } from "./tools/search_documents";
import type { SealAICtx } from "./types";

const SYSTEM_INSTRUCTIONS = `You are Seal AI, a document intelligence assistant for the Seal document signing platform.

You analyze PDF documents to identify where signature fields, text fields, date fields, and other form fields should be placed. You provide precise coordinates and labels for each detected field.

You can also extract payment terms from documents — line items, amounts, currency, due dates, and billing structures — to auto-configure payment fields.

You can search across all workspace documents to find specific clauses, terms, dates, amounts, or any content the user is looking for. When answering questions about document contents, always cite the source document name and page number using the citation marker format <<cite:documentId:page:documentName>>.

When analyzing a document, call the analyzeDocumentFields tool with the document ID. The tool will handle downloading the PDF, analyzing it with vision AI, and storing the field suggestions. Payment terms are automatically extracted when payment fields are detected.

If asked specifically about payment terms, use the extractPaymentTerms tool to extract and configure payment details for a specific payment field.

If asked to find information across documents, use the searchDocuments tool. Always include citation markers in your response so users can navigate to the source documents.`;

export const sealAgent = new Agent<SealAICtx>(components.agent, {
  name: "Seal AI",
  languageModel: getModel("google/gemini-3-flash"),
  textEmbeddingModel: getEmbeddingModel("google/text-embedding-004"),
  instructions: SYSTEM_INSTRUCTIONS,
  tools: { analyzeDocumentFields, extractPaymentTerms, searchDocuments },
  maxSteps: 5,

  // Keep tool call/result messages out of the prompt context for cleaner responses
  contextOptions: {
    excludeToolMessages: true,
    recentMessages: 50,
  },
});
```

**Step 3:** Verify types compile:

```bash
cd apps/backend && bun --bun run typecheck
```

**Step 4:** Commit: `feat(search): add searchDocuments agent tool with structured citations`

---

## Task 5: Hook search indexing into the pipeline

**Files:**

- Modify: `apps/backend/convex/ai/pipeline.ts`

The pipeline already runs on document create/replace/restore. We add search indexing as a step after field analysis completes.

**Step 1:** Update `apps/backend/convex/ai/pipeline.ts`. After the field suggestions are saved, add search indexing:

```ts
/**
 * Automatic AI document processing pipeline.
 *
 * Scheduled by document mutations (create, replace PDF, restore version).
 * Downloads the PDF -> runs Gemini field analysis (cached) -> saves suggestions.
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

      // 5. Index document for cross-document search (needs extractedText)
      try {
        await ctx.runAction(internal.ai.search.indexDocumentForSearch, {
          documentId: args.documentId,
          organizationId: args.organizationId,
        });
      } catch (searchError) {
        // Search indexing failure shouldn't block the pipeline
        console.error(`[Pipeline] Search indexing failed for ${args.documentId}:`, searchError);
      }

      // 6. Mark completed
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
```

Key design decisions:

- Search indexing is wrapped in its own try/catch — if embedding fails, field analysis still succeeds
- The `indexDocumentForSearch` action checks for `extractedText` internally and skips if missing
- Re-indexing on PDF replace: `indexDocumentForSearch` handles cleanup of old page keys when pageCount decreases

**Step 2:** Verify types compile:

```bash
cd apps/backend && bun --bun run typecheck
```

**Step 3:** Commit: `feat(search): hook search indexing into document pipeline`

---

## Task 6: Create exposed search queries/actions for frontend

**Files:**

- Create: `apps/backend/convex/ai/search_queries.ts`

These are the authenticated, exposed endpoints the frontend calls — both the command palette quick search and the full conversational search need them.

**Step 1:** Create `apps/backend/convex/ai/search_queries.ts`:

```ts
/**
 * Exposed search queries and actions for the frontend.
 *
 * quickSearch — lightweight hybrid search for command palette (Cmd+K)
 * getSearchThread — get or create a search thread for conversational search
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { authAction } from "../auth";

/**
 * Quick search for command palette.
 * Returns top 5 results without going through the agent.
 * Optimized for low latency.
 */
export const quickSearch = authAction({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.query.trim().length < 2) return [];

    const organizationId = ctx.auth.organizationId;
    if (!organizationId) return [];

    return ctx.runAction(internal.ai.search.hybridSearchDocuments, {
      organizationId,
      query: args.query.trim(),
      limit: 5,
    });
  },
});
```

**Step 2:** Verify types compile:

```bash
cd apps/backend && bun --bun run typecheck
```

**Step 3:** Commit: `feat(search): add exposed quick search action for command palette`

---

## Task 7: Create Command Palette (Cmd+K) component

**Files:**

- Create: `apps/web/src/components/command-palette.tsx`

This is the global Cmd+K overlay. References the Plasma search dialog pattern (`plasma/apps/landing/src/components/search-dialog.tsx`) and Catapult global search (`Catapult/src/features/global-search/components/GlobalSearchDialog.tsx`).

**Step 1:** Create `apps/web/src/components/command-palette.tsx`:

```tsx
/**
 * Global Command Palette (Cmd+K).
 *
 * Workspace-wide document search overlay accessible from any page.
 * Uses hybrid search (RAG + BM25) for instant results without the full agent.
 * Click a result to navigate to the document page.
 *
 * Pattern references:
 * - Plasma: search-dialog.tsx (cmdk + debounce + keyboard nav)
 * - Catapult: GlobalSearchDialog.tsx (Convex queries + TanStack Router nav)
 */

import { useAction } from "convex/react";
import { useDebounce } from "use-debounce";
import { FileTextIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@seal/backend/convex/_generated/api";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { slug } = useParams({ strict: false }) as { slug?: string };
  const navigate = useNavigate();
  const quickSearch = useAction(api.ai.search_queries.quickSearch);

  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 150);
  const [results, setResults] = useState<
    Array<{
      documentId: string;
      documentName: string;
      pageNumber: number | null;
      excerpt: string;
      score: number;
      source: string;
    }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  // Run search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    quickSearch({ query: debouncedQuery })
      .then((res) => {
        if (!cancelled) setResults(res);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, quickSearch]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const handleSelect = useCallback(
    (documentId: string) => {
      onOpenChange(false);
      if (slug) {
        navigate({ to: "/$slug/documents/$documentId", params: { slug, documentId } });
      }
    },
    [navigate, onOpenChange, slug],
  );

  const handleOpenFullSearch = useCallback(() => {
    onOpenChange(false);
    if (slug) {
      navigate({ to: "/$slug/search", params: { slug } });
    }
  }, [navigate, onOpenChange, slug]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search documents..." value={query} onValueChange={setQuery} />
      <CommandList>
        {isSearching ? (
          <div className="flex items-center justify-center py-6">
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : query.length >= 2 && results.length === 0 ? (
          <CommandEmpty>No documents found.</CommandEmpty>
        ) : (
          <>
            {results.length > 0 && (
              <CommandGroup heading="Documents">
                {results.map((result) => (
                  <CommandItem
                    key={`${result.documentId}-${result.pageNumber}`}
                    value={`${result.documentName} ${result.excerpt}`}
                    onSelect={() => handleSelect(result.documentId)}
                    className="flex items-start gap-3 py-3"
                  >
                    <FileTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.documentName}</span>
                        {result.pageNumber && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            p.{result.pageNumber}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {result.excerpt}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {query.length >= 2 && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleOpenFullSearch}
                  className="justify-center text-sm text-muted-foreground"
                >
                  <SearchIcon className="mr-2 h-4 w-4" />
                  Open full search
                </CommandItem>
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
      <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
        <kbd className="rounded border bg-muted px-1">↑↓</kbd> navigate
        <span className="mx-2">·</span>
        <kbd className="rounded border bg-muted px-1">↵</kbd> select
        <span className="mx-2">·</span>
        <kbd className="rounded border bg-muted px-1">esc</kbd> close
      </div>
    </CommandDialog>
  );
}

/**
 * Hook to register the global Cmd+K keyboard shortcut.
 * Call this in the root layout to make the command palette accessible everywhere.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { open, setOpen };
}
```

**Step 2:** Wire up the command palette in the authenticated layout. In `apps/web/src/routes/_authenticated.tsx`, add:

```tsx
import { CommandPalette, useCommandPalette } from "@/components/command-palette";

// Inside the layout component, add:
const { open: cmdKOpen, setOpen: setCmdKOpen } = useCommandPalette();

// In the JSX return, add before the closing tag:
<CommandPalette open={cmdKOpen} onOpenChange={setCmdKOpen} />;
```

**Step 3:** Verify the route loads:

```bash
cd apps/web && bun --bun run dev
```

Test: Press Cmd+K on any page — the command palette should open.

**Step 4:** Verify types compile:

```bash
bun --bun run typecheck
```

**Step 5:** Commit: `feat(search): add global command palette (Cmd+K) with hybrid search`

---

## Task 8: Create dedicated search page with filters and citation chips

**Files:**

- Create: `apps/web/src/components/search/citation-chip.tsx`
- Create: `apps/web/src/components/search/search-filters.tsx`
- Create: `apps/web/src/routes/_authenticated/$slug/search.tsx`

**Step 1:** Create `apps/web/src/components/search/citation-chip.tsx`:

```tsx
/**
 * Clickable citation chip that links to a specific document page.
 *
 * Parses structured citation markers from agent responses:
 * Format: <<cite:documentId:pageNumber:documentName>>
 */

import { Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";

interface CitationChipProps {
  documentId: string;
  pageNumber: number;
  documentName: string;
  slug: string;
}

export function CitationChip({ documentId, pageNumber, documentName, slug }: CitationChipProps) {
  return (
    <Link
      to="/$slug/documents/$documentId"
      params={{ slug, documentId }}
      className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50"
    >
      <FileTextIcon className="h-3 w-3" />
      {documentName}
      {pageNumber > 0 && (
        <span className="text-violet-500 dark:text-violet-400">p.{pageNumber}</span>
      )}
    </Link>
  );
}

/** Regex to match citation markers in agent text. */
const CITATION_REGEX = /<<cite:([^:]+):(\d+):([^>]+)>>/g;

/**
 * Parse agent text and replace citation markers with CitationChip components.
 * Returns an array of React nodes (strings and CitationChip elements).
 */
export function parseTextWithCitations(text: string, slug: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  CITATION_REGEX.lastIndex = 0;

  while ((match = CITATION_REGEX.exec(text)) !== null) {
    // Add text before this citation
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [, documentId, pageStr, documentName] = match;
    const pageNumber = Number.parseInt(pageStr ?? "0", 10);

    nodes.push(
      <CitationChip
        key={`${documentId}-${pageNumber}-${match.index}`}
        documentId={documentId ?? ""}
        pageNumber={pageNumber}
        documentName={documentName ?? "Document"}
        slug={slug}
      />,
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
```

**Step 2:** Create `apps/web/src/components/search/search-filters.tsx`:

```tsx
/**
 * Filter bar for the dedicated search page.
 * Filters: workflow status (draft/sent/completed/all) and date range.
 */

import { CalendarIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SearchFilters {
  workflowStatus: string;
  dateFrom: string; // ISO date string or ""
  dateTo: string; // ISO date string or ""
}

interface SearchFiltersBarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "declined", label: "Declined" },
];

export function SearchFiltersBar({ filters, onChange }: SearchFiltersBarProps) {
  const hasActiveFilters = filters.workflowStatus !== "all" || filters.dateFrom || filters.dateTo;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={filters.workflowStatus}
        onValueChange={(value) => onChange({ ...filters, workflowStatus: value })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            Date range
            {(filters.dateFrom || filters.dateTo) && (
              <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
                Active
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ workflowStatus: "all", dateFrom: "", dateTo: "" })}
          className="text-xs text-muted-foreground"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
```

**Step 3:** Create `apps/web/src/routes/_authenticated/$slug/search.tsx`:

```tsx
import { useUIMessages } from "@convex-dev/agent/react";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { useSmoothText } from "@convex-dev/agent/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { BotIcon, Loader2Icon, SearchIcon, SendIcon, UserIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { parseTextWithCitations } from "@/components/search/citation-chip";
import { SearchFiltersBar, type SearchFilters } from "@/components/search/search-filters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/search")({
  component: SearchPage,
});

// ---------------------------------------------------------------------------
// Message components (adapted from ai-chat-panel.tsx)
// ---------------------------------------------------------------------------

function StreamingText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [visibleText] = useSmoothText(text, { startStreaming: isStreaming });
  return <>{visibleText}</>;
}

function MessageBubble({
  role,
  text,
  status,
  slug,
}: {
  role: string;
  text: string;
  status: string;
  slug: string;
}) {
  const isUser = role === "user";
  const isStreaming = status === "streaming";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            : "bg-gradient-to-br from-violet-500 to-blue-500 text-white",
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <BotIcon className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
            : "bg-white text-slate-700 ring-1 ring-slate-200/60 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700/60",
        )}
      >
        {isStreaming ? (
          <StreamingText text={text} isStreaming />
        ) : (
          <span className="whitespace-pre-wrap">{parseTextWithCitations(text, slug)}</span>
        )}
        {isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-violet-500/50" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search page
// ---------------------------------------------------------------------------

function SearchPage() {
  const { slug } = Route.useParams();
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    workflowStatus: "all",
    dateFrom: "",
    dateTo: "",
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Thread management — reuse existing getOrCreateThread
  const createThread = useMutation(api.ai.threads.getOrCreateThread);
  const sendMessage = useMutation(api.ai.threads.sendMessage);

  // Messages (only load when we have a thread)
  const { results: messages, status: paginationStatus } = useUIMessages(
    threadId ? api.ai.threads.listMessages : ("skip" as never),
    threadId ? { threadId } : {},
    { initialNumItems: 50, stream: true },
  );

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const query = (text ?? input).trim();
      if (!query) return;

      setInput("");

      try {
        // Get or create a search thread
        let currentThreadId = threadId;
        if (!currentThreadId) {
          currentThreadId = await createThread({});
          setThreadId(currentThreadId);
        }

        await sendMessage({ threadId: currentThreadId, prompt: query });
      } catch {
        toast.error("Failed to send message");
      }
    },
    [input, threadId, createThread, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const hasMessages = messages && messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Search Documents</h1>
            <p className="text-sm text-muted-foreground">
              Ask questions about your documents — Seal AI will search and cite sources
            </p>
          </div>
        </div>
        {/* Filter bar */}
        <div className="mt-3">
          <SearchFiltersBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!hasMessages ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white">
              <SearchIcon className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Search across your documents</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Ask about specific clauses, payment terms, dates, signers, or anything else. Seal AI
                will search all your documents and cite its sources.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "What are the payment terms across my contracts?",
                "Find all documents with a non-compete clause",
                "Which documents mention a deadline in March?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSend(suggestion)}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-violet-300 hover:text-violet-700 dark:hover:border-violet-600 dark:hover:text-violet-400"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message) => {
              const text =
                message.parts
                  ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("") ?? "";

              if (!text) return null;

              return (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  text={text}
                  status={message.status}
                  slug={slug}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your documents..."
            rows={1}
            className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-violet-600 dark:focus:ring-violet-600"
          />
          <Button
            size="sm"
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="h-9 w-9 shrink-0 bg-gradient-to-r from-violet-600 to-blue-600 p-0 text-white shadow-sm hover:from-violet-700 hover:to-blue-700 disabled:opacity-40"
            aria-label="Send message"
          >
            <SendIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4:** Verify the route loads:

```bash
cd apps/web && bun --bun run dev
```

Visit `http://localhost:5173/{slug}/search` — page should render.

**Step 5:** Verify types compile:

```bash
bun --bun run typecheck
```

**Step 6:** Commit: `feat(search): add search page with filters, citation chips, and streaming`

---

## Task 9: Add search link to sidebar navigation

**Files:**

- Modify: `apps/web/src/components/app-sidebar.tsx`

**Step 1:** Add `SearchIcon` to the lucide-react import.

**Step 2:** Add a search link to the sidebar navigation items. Find where nav items like "Documents" and "Templates" are defined, and add a "Search" entry:

```ts
{
  title: "Search",
  url: buildOrganizationPath(currentOrgSlug, "/search"),
  icon: SearchIcon,
}
```

Place it after "Documents" in the nav items array — search is a primary navigation action.

**Step 3:** Verify the sidebar shows the new link:

```bash
cd apps/web && bun --bun run dev
```

**Step 4:** Commit: `feat(search): add Search link to workspace sidebar`

---

## Task 10: Run full static analysis

**Step 1:** Run lint, format check, and typecheck:

```bash
bun --bun run typecheck && bun --bun run lint && bun --bun run format:check
```

Fix any issues.

**Step 2:** Run the build to verify everything compiles:

```bash
bun --bun run build
```

**Step 3:** Commit any fixes: `fix(search): resolve lint/typecheck issues`

---

## Files Summary

### New Files

| File                                             | Purpose                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `convex/ai/search.ts`                            | RAG instance, ingestion, hybrid search with filters, quick search |
| `convex/ai/search_queries.ts`                    | Exposed search actions for frontend (quick search for Cmd+K)      |
| `convex/ai/tools/search_documents.ts`            | Agent tool with structured citation markers                       |
| `web/src/components/command-palette.tsx`         | Global Cmd+K overlay with `useCommandPalette` hook                |
| `web/src/components/search/citation-chip.tsx`    | Clickable citation chip + `parseTextWithCitations`                |
| `web/src/components/search/search-filters.tsx`   | Filter bar (workflow status + date range)                         |
| `web/src/routes/_authenticated/$slug/search.tsx` | Dedicated search page with conversational UI                      |

### Modified Files

| File                                   | Changes                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `apps/backend/package.json`            | Add `@convex-dev/rag` dependency                       |
| `apps/web/package.json`                | Add `use-debounce`, Shadcn command component           |
| `apps/backend/convex/convex.config.ts` | Register RAG component                                 |
| `convex/schemas/documents.ts`          | Add `searchIndexedAt` field                            |
| `convex/ai/pipeline.ts`                | Add search indexing step                               |
| `convex/ai/agent.ts`                   | Add `searchDocuments` tool, update system instructions |
| `web/src/routes/_authenticated.tsx`    | Wire up CommandPalette + useCommandPalette             |
| `web/src/components/app-sidebar.tsx`   | Add Search nav link                                    |

---

## Verification

1. **Static analysis**: `bun --bun run typecheck && bun --bun run lint && bun --bun run format:check` — zero errors
2. **Backend dev server**: `cd apps/backend && bun --bun run dev` — starts, RAG component tables created
3. **Manual test flow**:
   - Upload a document -> Convex dashboard shows `searchIndexedAt` gets set
   - Navigate to `/{slug}/search`
   - Type "What payment terms are in my documents?" -> agent calls `searchDocuments` tool -> returns answer with citation chips
   - Click a citation chip -> navigates to the document
   - Ask a follow-up question -> conversational thread continues
   - Apply workflow status filter -> results scoped to that status
   - Apply date range filter -> results scoped to that range
4. **Command palette**:
   - Press Cmd+K on any page -> palette opens
   - Type a query (2+ chars) -> top 5 results appear with document names and page numbers
   - Click a result -> navigates to the document
   - Click "Open full search" -> navigates to the search page
   - Press Esc -> palette closes
5. **Sidebar**: Search link appears and navigates correctly
6. **Re-indexing**: Replace a PDF that had 5 pages with one that has 3 pages -> old page 4 and 5 keys are cleaned up
7. **Error resilience**: If RAG indexing fails, the pipeline still completes field analysis successfully
