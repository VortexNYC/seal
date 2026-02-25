---
date: 2026-02-19
topic: cross-document-search
status: approved
---

# Cross-Document Search — Design

## Goal

Workspace-wide conversational search across all documents. Users ask natural language questions and get AI-generated answers grounded in their actual documents, with citations linking to specific pages.

## Architecture

### Approach: RAG Component + Tool-based Search

Uses `@convex-dev/rag` for chunking/embedding/vector search, `@convex-dev/agent` for conversational threads, and hybrid search (vector + BM25 text) merged via `hybridRank`.

### Ingestion (background, on document upload)

```
Document uploaded
  → extractedText populated (existing extract_text_action)
  → pipeline.ts runs field analysis (existing)
  → NEW: chunk extractedText by page → embed via text-embedding-005 → store in @convex-dev/rag
  → set searchIndexedAt timestamp on document
```

### Search (user-initiated)

```
User query
  → agent decides to call searchDocuments tool
  → hybrid search: RAG vector + Convex BM25 text search
  → hybridRank merge (RRF, k=60, weights=[1.2, 1.0])
  → top-K chunks as context with document metadata
  → Gemini generates answer with citations
  → streamed to UI via @convex-dev/agent websocket streaming
```

## Data Model

### RAG Component Setup

```ts
const documentRag = new RAG<{ status: string; documentId: string }>(components.rag, {
  textEmbeddingModel: getEmbeddingModel("google/text-embedding-005"),
  embeddingDimension: 768,
  filterNames: ["status", "documentId"],
});
```

- **Namespace:** `workspace:{organizationId}` — tenant isolation
- **Key:** `doc:{documentId}:page:{pageNumber}` — stable, deduplicable
- **Filters:** `status` (active/archived), `documentId` (single-doc scoping)

### Schema Changes

- `documents.searchIndexedAt: v.optional(v.number())` — tracks when document was last embedded

No new tables — `@convex-dev/rag` manages its own internal tables. Threads use existing `@convex-dev/agent` tables.

## Ingestion Pipeline

Extends the existing `pipeline.ts` orchestrator. After field analysis, a new step:

1. Wait for `extractedText` to be populated (scheduled dependency)
2. Split text by page markers or fixed ~500 token chunks
3. For each chunk: `documentRag.add(ctx, { namespace, key, text, filterValues })`
4. Patch document with `searchIndexedAt: Date.now()`

**Re-indexing on PDF replace:** RAG component's `add` with same key does upsert. Old keys for deleted pages cleaned up explicitly.

## Search Agent

### New Tool: `searchDocuments`

```ts
searchDocuments: createTool({
  description: "Search across all workspace documents for relevant content. Returns document excerpts with citations.",
  args: z.object({
    query: z.string().describe("The search query — what to look for across documents"),
  }),
  handler: async (ctx, { query }) => {
    const namespace = `workspace:${ctx.organizationId}`;

    // 1. RAG vector search (semantic)
    const ragResults = await documentRag.search(ctx, {
      namespace, query, limit: 10, vectorScoreThreshold: 0.5,
    });

    // 2. Convex text search (BM25) on documents.extractedText
    const textResults = await ctx.runQuery(
      internal.documents.queries.searchDocumentText,
      { organizationId: ctx.organizationId, query, limit: 10 },
    );

    // 3. Hybrid rank merge via reciprocal rank fusion
    const ragKeys = ragResults.results.map(r => r.key);
    const textIds = textResults.map(d => d._id.toString());
    const ranked = hybridRank([ragKeys, textIds], { k: 60, weights: [1.2, 1.0] });

    // 4. Format as citations
    return formatSearchResults(ranked, ragResults, textResults);
  },
});
```

Tool-based approach: agent decides when to search, can search multiple times per conversation, refine queries, and naturally cite sources.

### Agent Update

Add `searchDocuments` to `sealAgent.tools`. Update system instructions to describe search capability.

## UI — Two Entry Points

### 1. Command Palette (Cmd+K)

- Global overlay accessible from any page
- Search input with "Search documents..." placeholder
- Top 5 results: document title + page number + text snippet
- Click result navigates to `/$slug/documents/$documentId` (scrolled to page)
- "Open full search" link at bottom

### 2. Dedicated Search Page (`/$slug/search`)

- Full conversational interface (reuses chat panel streaming pattern from Plasma)
- Filter bar: document status (draft/sent/completed/all), date range
- Streamed AI answers with inline citation chips
- Citation chip = document name + page number, clickable → navigates to document
- Thread history for follow-up questions ("What about the penalty clause in that one?")
- New sidebar link in workspace navigation

### Frontend Patterns (from Plasma)

- `useUIMessages` + `useSmoothText` + `optimisticallySendMessage` for streaming
- `{ saveStreamDeltas: true }` for real-time websocket streaming
- `fetchContextMessages` for cross-thread search history

## Not Building (YAGNI)

- No per-document scope toggle in command palette (workspace-global only for v1)
- No custom chunking strategies (page-based sufficient)
- No importance weighting per document (all equal)
- No search history persistence beyond current thread
- No plan-gating (available to all users)
- No document filters in command palette (filters only on dedicated page)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| RAG approach | Tool-based | Agent decides when to search, more flexible for conversation |
| Embedding model | text-embedding-005 (768 dims) | Same as Plasma, good quality/cost ratio |
| Chunking | Per-page | Natural boundaries for PDFs, citations map to page numbers |
| Search merge | hybridRank (RRF) | Proven in Plasma, combines semantic + keyword strengths |
| Namespace | Per-organization | Tenant isolation, simple scope |
| Indexing trigger | Automatic on upload | Consistent with field analysis pipeline pattern |

## Reference Implementation

The Plasma repo (`/Users/shlomokabareti/Projects/plasma`) has working implementations of:
- RAG setup with filters: `convex/ai/memory.ts`
- Hybrid search with `hybridRank`: `convex/ai/memory.ts`
- Agent with `contextOptions.searchOptions`: `convex/ai/agent.ts`
- Streaming UI: `portal/src/components/ai/hooks/`
- Thread management: `convex/ai/threads.ts`
