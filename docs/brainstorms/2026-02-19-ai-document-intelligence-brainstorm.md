---
date: 2026-02-19
topic: ai-document-intelligence
---

# Seal AI — Document Intelligence

## What We're Building

A comprehensive AI layer for Seal that transforms document processing from manual to automated. Four capabilities, each fully built:

1. **Auto Field Placement** — AI analyzes uploaded PDFs and automatically places signature, name, date, number, payment, and other fields at the correct positions.
2. **Document Redlining** — AI annotates PDFs with visual highlights on key clauses, obligations, payment terms, and risk areas that recipients should review carefully.
3. **Cross-Document Search** — Workspace-wide semantic search across all stored documents with optional document/folder filters.
4. **Payment Structure Extraction** — AI reads payment terms, amounts, schedules, and line items from contracts and auto-builds the payment field configuration.

## Architecture Decision

**Orchestration**: Convex Agent component (`@convex-dev/agent`)
**Primary LLM**: Google Gemini (via `@google/genai` SDK)
**Why Gemini**: Native PDF vision up to 1000 pages at ~258 tokens/page. Structured output extraction. Best cost/performance ratio for document processing. Gemini 3 Flash is fast and cheap for bulk work; Gemini 3 Pro for complex reasoning when needed.
**Why Convex Agent**: First-party integration with our Convex backend. Threads, tool calling, streaming over websockets, RAG with vector search, usage tracking, rate limiting — all built-in. No custom orchestration needed.

**Trigger**: Configurable per-workspace. Default is manual ("Analyze with AI" button). Workspace setting to enable automatic analysis on upload.

---

## Capability 1: Auto Field Placement

### What It Does

User uploads a PDF. AI visually analyzes every page, identifies where fillable fields should go, and creates `signature_fields` records with precise `(x, y, width, height, page)` coordinates mapped to the correct `fieldType`.

### Detection Targets

| What AI Looks For | Maps To `fieldType` | Examples |
|---|---|---|
| Signature lines (underscores, "Sign here", "Authorized by") | `signature` | `_____________`, "Signature:", dotted lines |
| Name fields ("Full Name", "Printed Name", name blanks) | `text` | "Name: ___", "Printed Name" |
| Date fields ("Date", "MM/DD/YYYY", date blanks) | `date` | "Date: ___", "Effective Date:" |
| Numerical inputs (amounts, quantities, account numbers) | `number` | "Amount: $___", "Qty:" |
| Checkboxes (empty squares, "[ ]", option lists) | `checkbox` | "[ ] I agree", "[ ] Option A" |
| Payment/invoice tables (line items, totals, due amounts) | `payment` | Invoice tables, "Total Due: $___" |
| File attachment areas ("Attach proof", "Supporting docs") | `attachment` | "Attach ID:", "Upload proof of insurance" |

### How It Works

1. **PDF stored in Convex file storage** (existing flow)
2. **Convex Agent action** triggered (manual button or auto on upload)
3. **Agent sends PDF to Gemini** with structured output schema requesting field detections
4. **Gemini returns** array of detected fields with:
   - `fieldType` (signature, text, date, number, checkbox, payment, attachment)
   - `page` number (1-indexed)
   - `boundingBox` as percentages of page dimensions (matching our existing coordinate system)
   - `label` (inferred label text, e.g. "Buyer Signature", "Effective Date")
   - `confidence` score (0-1)
   - `isRequired` inference (based on context like "required", asterisks, bold)
5. **Agent maps results** to `signature_fields` schema and creates records via mutation
6. **User sees fields** pre-placed on the document in the editor, can adjust/remove/add

### Recipient Assignment Strategy

Fields are created **unassigned** (recipientId = undefined). If the document already has recipients, the agent attempts smart assignment:
- If document has exactly 1 recipient: assign all fields to them
- If document has multiple recipients: use label context ("Buyer" -> first recipient, "Seller" -> second) or leave unassigned for manual review
- Always surfaced in UI as "AI-suggested" so user can override

### Confidence Threshold

- **High confidence (>0.85)**: Field placed automatically, shown as solid
- **Medium confidence (0.5-0.85)**: Field placed but shown with a subtle "review" indicator
- **Low confidence (<0.5)**: Not placed, but shown in a suggestions panel for user to drag-drop

### Gemini Prompt Strategy

Use Gemini's structured output mode with a JSON schema. The prompt includes:
- System instruction explaining Seal's field types and coordinate system
- The PDF as inline data (or via Files API for large docs)
- Request for structured array output matching our field schema
- Examples of each field type for few-shot guidance

### Data Model Changes

New table: `ai_field_suggestions`
```
documentId: Id<"documents">
fields: array of detected field objects (before user confirms)
modelUsed: string ("gemini-3-flash", etc.)
tokensUsed: number
processingTimeMs: number
status: "pending" | "applied" | "dismissed"
createdAt: number
```

This stores the raw AI output separately from `signature_fields`, so:
- User can "undo" AI placement (delete suggestions, revert)
- We track AI accuracy over time
- Billing/usage attribution

### UI Components

- **"Analyze with AI" button** in document editor toolbar
- **Loading state**: "Analyzing document..." with page-by-page progress
- **Review panel**: Shows all detected fields grouped by page, with confidence badges
- **"Apply All" / "Apply Selected"** buttons to confirm placement
- **Per-field "Dismiss"** to reject individual suggestions
- **Confidence indicators** on placed fields (subtle dot: green/yellow)

---

## Capability 2: Document Redlining

### What It Does

AI reads the PDF and creates visual annotations highlighting key clauses, obligations, risks, and payment terms. These annotations appear as colored highlights directly on the PDF pages — like a lawyer's markup.

### Annotation Categories

| Category | Color | What Gets Highlighted |
|---|---|---|
| **Obligations** | Blue | "shall", "must", "agrees to", deadlines, deliverables |
| **Payment Terms** | Green | Amounts, due dates, payment schedules, penalties |
| **Risk / Liability** | Red/Orange | Indemnification, limitation of liability, termination clauses |
| **Important Dates** | Purple | Effective dates, expiration, renewal periods |
| **Defined Terms** | Yellow | Key definitions that affect interpretation |

### How It Works

1. **User clicks "Redline Document"** (or auto-triggered alongside field placement)
2. **Convex Agent sends PDF to Gemini** with a legal analysis prompt
3. **Gemini returns** structured annotations:
   - `page` number
   - `boundingBox` (coordinates of the highlighted region)
   - `category` (obligation, payment, risk, dates, terms)
   - `text` (the actual clause text)
   - `summary` (1-sentence plain-English explanation)
   - `severity` (informational, important, critical)
4. **Agent stores annotations** in a new `ai_document_annotations` table
5. **Frontend renders overlays** on the PDF viewer — colored highlight rectangles with hover tooltips showing the summary

### Data Model

New table: `ai_document_annotations`
```
documentId: Id<"documents">
page: number
x: number (percentage)
y: number (percentage)
width: number (percentage)
height: number (percentage)
category: "obligation" | "payment" | "risk" | "dates" | "terms"
severity: "informational" | "important" | "critical"
text: string (extracted clause text)
summary: string (plain-English explanation)
modelUsed: string
createdAt: number
```

### Visibility

- **Document owner/sender**: Sees all annotations in the editor
- **Recipients on signing page**: Optionally shown (workspace setting: "Show AI highlights to signers")
- **Toggle on/off**: Users can hide/show redline overlay

### UI Components

- **"Redline" button** in document editor toolbar (can be combined with "Analyze with AI")
- **Color-coded highlight overlays** rendered on PDF pages
- **Hover tooltip** on each annotation showing category icon + summary
- **Annotation list panel** (collapsible sidebar) grouped by category with jump-to-page
- **Toggle visibility** per category (e.g. show only "Risk" highlights)

---

## Capability 3: Cross-Document Search

### What It Does

Workspace-wide semantic search across all documents. Users ask natural language questions and get answers grounded in their actual documents, with citations.

### How It Works

**Indexing Pipeline** (background, on document upload/update):
1. Document PDF text is extracted (we already do this for field positioning)
2. Text is chunked (by page or by semantic sections)
3. Chunks are embedded using Gemini's embedding model (`text-embedding-004`)
4. Embeddings stored in Convex vector index (via Convex Agent's built-in RAG)
5. Metadata attached: documentId, page number, document title, status, created date

**Search Flow**:
1. User types a natural language query in the workspace search bar
2. Query is embedded and searched against the vector index
3. Top-K relevant chunks retrieved, with document filters if specified
4. Chunks passed as context to Gemini with the user's question
5. Gemini generates an answer with citations (document name + page number)
6. Answer streamed to UI in real-time via Convex Agent's websocket streaming

### Search Filters

- **Document status**: draft, sent, completed, all
- **Date range**: created/modified within time period
- **Specific documents**: multi-select to search within specific docs
- **Recipients**: documents involving specific recipients

### Convex Agent Integration

This is where `@convex-dev/agent` shines:
- **Threads** persist search conversations per user
- **RAG** is built-in — vector search + text search hybrid
- **Tool calling** lets the agent fetch document metadata, recipient info, field values
- **Streaming** over websockets keeps UI responsive
- **Usage tracking** for billing attribution

### Data Model

Uses Convex Agent's built-in tables for threads/messages. Additional:

New table: `ai_document_chunks`
```
documentId: Id<"documents">
organizationId: Id<"organizations">
page: number
chunkIndex: number
text: string
embedding: v.array(v.float64()) // vector embedding
metadata: { title, status, createdAt, recipientNames }
```

With vector index:
```
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 768,
  filterFields: ["organizationId"]
})
```

### UI Components

- **Workspace search page** (`/$slug/search` or `/$slug/ai`)
- **Search input** with natural language placeholder
- **Filter bar** (status, date, specific docs)
- **Answer panel** with streamed response + citations
- **Citation chips** linking to specific document pages
- **Conversation history** (follow-up questions in same thread)
- **Sidebar link** in main "Workspace" section

---

## Capability 4: Payment Structure Extraction

### What It Does

AI reads payment terms, line items, amounts, schedules, and fee structures from contracts and auto-builds the `payment_field_configs` record. Instead of manually configuring invoice line items, the AI extracts them from the contract text.

### What Gets Extracted

| Data Point | Maps To | Example |
|---|---|---|
| Line items (description + amount) | `lineItems[]` in payment config | "Consulting: $5,000/month" |
| Total amount | `amount` field | "Total: $15,000" |
| Currency | `currency` | "$" -> "usd", "EUR" -> "eur" |
| Payment schedule | metadata/notes | "Due within 30 days", "Monthly installments" |
| Late fees / penalties | metadata/notes | "2% monthly late fee" |
| Tax information | `taxRate` or line items | "Plus applicable sales tax" |
| Deposit / upfront | Split into line items | "50% deposit due upon signing" |

### How It Works

1. **Runs as part of Auto Field Placement** (Capability 1) when a `payment` field type is detected
2. **OR** user clicks "Extract Payment Terms" on an existing payment field
3. **Gemini analyzes** the full document context (not just the payment section) to understand:
   - What services/goods are being paid for
   - Exact amounts and currencies
   - Payment timing and conditions
4. **Returns structured payment config** matching our `payment_field_configs` schema
5. **Agent creates/updates** the payment field config via mutation
6. **User reviews** in the payment field builder UI — all fields pre-populated

### Integration with Existing Payment Flow

This feeds directly into the payment field builder we just built (Phase 1-4 of Stripe). The extracted config populates:
- Line items in the invoice builder
- Amount and currency
- The payment field's label (e.g., "Project Payment - Phase 1")

### Data Model

No new tables needed — uses existing `payment_field_configs` and `ai_field_suggestions` (from Capability 1). The AI output includes payment-specific structured data that maps directly to the existing schema.

---

## Shared Infrastructure

### Convex Agent Setup

Single agent definition with multiple tools:

```typescript
const sealAI = new Agent(components.agent, {
  model: "gemini-3-flash",
  instructions: "You are Seal AI, a document intelligence assistant...",
  tools: [
    analyzeDocumentFields,    // Capability 1
    redlineDocument,          // Capability 2
    searchDocuments,          // Capability 3
    extractPaymentTerms,     // Capability 4
  ],
});
```

### Workspace Settings

New settings in organization config:
- `aiEnabled`: boolean (feature gate, tied to plan)
- `aiAutoAnalyze`: boolean (auto-trigger on upload, default false)
- `aiShowRedlinesToSigners`: boolean (show annotations to recipients)
- `aiModel`: "flash" | "pro" (cost vs quality tradeoff)

### Usage & Billing

- Track tokens per-org, per-document, per-capability
- Convex Agent's built-in usage tracking handles this
- Free plan: X AI analyses per month
- Pro plan: unlimited (or higher limit)

### Rate Limiting

- Convex Agent's built-in rate limiting component
- Per-user and per-org limits to prevent abuse
- Respects Gemini API rate limits

---

## Implementation Order

| Phase | Capability | Why This Order |
|---|---|---|
| **Phase 1** | Auto Field Placement | Highest immediate value. Saves the most manual work. Proves the AI integration works. |
| **Phase 2** | Payment Structure Extraction | Builds directly on Phase 1's infrastructure. Extends field placement with payment-specific intelligence. |
| **Phase 3** | Document Redlining | Adds visual intelligence layer. Reuses the same PDF analysis pipeline. |
| **Phase 4** | Cross-Document Search | Most complex (requires embedding pipeline + RAG). Benefits from having more documents processed by Phases 1-3. |

Each phase is independently shippable and valuable.

---

## Key Decisions

- **Gemini over Claude for PDF processing**: 10x cheaper per page, native vision, 1000-page support, structured output. Claude is better at reasoning but we don't need deep reasoning for field detection — we need fast, structured extraction.
- **Convex Agent for orchestration**: First-party, handles threads/messages/RAG/streaming/rate-limiting/usage-tracking out of the box. No custom orchestration code.
- **Configurable trigger (manual default)**: Respects user control and manages costs. Power users can enable auto-analyze.
- **Suggestions model (not direct placement)**: AI writes to `ai_field_suggestions`, user confirms. Maintains user trust and allows accuracy improvement over time.
- **Visual PDF annotations for redlining**: Matches how lawyers actually work. More intuitive than a text sidebar.
- **Per-workspace vector index**: Scales naturally with Convex. Org-scoped for data isolation.

## Open Questions

- **Gemini API key management**: Store in Convex env vars (same pattern as Stripe). One key per deployment or per-org?
- **Embedding model**: Gemini's `text-embedding-004` (768 dims) vs a dedicated embedding model. Start with Gemini for simplicity.
- **Document versioning**: When a document is re-uploaded, do we re-analyze? Probably yes, with a "re-analyze" button.
- **Plan gating**: Which plan gets AI features? Pro only? Or free with limits?

## Next Steps

Each capability becomes its own feature spec with full implementation plan:
1. `docs/features/ai/auto-field-placement/feature-spec.md`
2. `docs/features/ai/payment-extraction/feature-spec.md`
3. `docs/features/ai/document-redlining/feature-spec.md`
4. `docs/features/ai/cross-document-search/feature-spec.md`

--> `/workflows:plan` for Phase 1 (Auto Field Placement) first.
