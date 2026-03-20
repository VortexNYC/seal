---
date: 2026-02-20
topic: ai-infra-search-usage-workpool
---

# AI Infrastructure: Search, Usage Tracking, Priority Queues

## What We're Building

Three infrastructure improvements to the AI pipeline:

1. **Power Command Palette** — Cmd+K becomes the only search interface. Full filters, more results, kill the search page.
2. **Usage Tracking** — Log every AI action with token counts and cost estimates per org. Visibility only (no hard limits yet).
3. **Priority Queues** — Pro orgs' AI jobs process before Free orgs' jobs via `@convex-dev/workpool`.

## Why This Approach

- **Search**: The dedicated search page adds a navigation hop nobody wants. Cmd+K is already the muscle memory. Backend `fullSearch` already supports all filters — this is mostly frontend work.
- **Usage**: We need data before we can set limits. A simple `ai_usage_log` table + `@convex-dev/aggregate` for efficient rollups. No dashboard UI yet — inspect via Convex dashboard.
- **Workpool**: Direct `scheduler.runAfter` treats all jobs equally. With paying customers, Pro should get priority. `@convex-dev/workpool` handles priority queuing and concurrency limits out of the box.

## Key Decisions

- **Kill `quickSearch` action**: One search action (`fullSearch`) used everywhere. Remove `quickSearch` entirely.
- **Kill `/$slug/search` route**: Cmd+K is the only search UI. Remove the search page and its sidebar nav link.
- **No `@convex-dev/neutralcost`**: It tracks Convex compute costs, not Gemini API costs. A simple usage log table fits better.
- **No usage dashboard UI yet**: Just the tracking layer. Inspect data in Convex dashboard. Build UI when ready to expose to users.
- **Workpool only for background pipeline jobs**: Search and chat are synchronous user-facing actions — no queuing. Workpool applies to field analysis, redlining, and payment extraction.
- **No hard limits yet**: Track everything, decide on limits after seeing real usage patterns and costs.

---

## Section 1: Power Command Palette

### Changes

- Switch Cmd+K from `quickSearch` to `fullSearch` (up to 20 results, with filters)
- Add inline filter chips below search input: **Status** dropdown (All / Draft / Sent / In Progress / Completed), **Date range** (From / To pickers)
- Results show: document name, page number badge, 2-line excerpt
- "Show more results" option to load additional results
- Delete `quickSearch` action from `search_queries.ts`
- Delete `/$slug/search` route
- Remove "Open full search" link and search sidebar nav entry

### Backend

No backend changes needed — `fullSearch` already accepts `workflowStatus`, `dateFrom`, `dateTo`, `limit`.

---

## Section 2: Usage Tracking

### New Table: `ai_usage_log`

| Field              | Type                       | Description                                                                         |
| ------------------ | -------------------------- | ----------------------------------------------------------------------------------- |
| `organizationId`   | `Id<"organizations">`      | Which workspace                                                                     |
| `userId`           | `Id<"users">`              | Who triggered it                                                                    |
| `action`           | union literal              | `"field_analysis"` / `"payment_extraction"` / `"redlining"` / `"search"` / `"chat"` |
| `tokensUsed`       | `number`                   | Input + output tokens                                                               |
| `estimatedCostUsd` | `number`                   | Calculated from token count + model pricing                                         |
| `durationMs`       | `number`                   | Processing time                                                                     |
| `documentId`       | `optional Id<"documents">` | Null for search/chat                                                                |
| `modelUsed`        | `string`                   | e.g. "gemini-2.0-flash"                                                             |

### Aggregate Counters

Use `@convex-dev/aggregate` to maintain:

- Total AI calls per org per month
- Total tokens per org per month
- Total estimated cost per org per month

Efficient rollup queries without scanning all log records.

### Instrumentation Points

Every AI action writes a usage record on completion:

- `pipeline.ts` (field analysis + redlining)
- `paymentExtraction.ts`
- `search.ts` (hybrid search)
- `agent.ts` (chat messages)

---

## Section 3: Priority Queues

### Component

`@convex-dev/workpool` — priority queue with concurrency control.

### Priority Tiers

| Tier | Priority | Who                                     |
| ---- | -------- | --------------------------------------- |
| High | 1        | Pro orgs (active/trialing subscription) |
| Low  | 2        | Free orgs (no subscription)             |

### Where Applied

Replace `ctx.scheduler.runAfter(0, internal.ai.pipeline.processDocument, ...)` with workpool enqueue in:

- `createDocument`
- `replaceDocumentPdf`
- `restoreDocumentVersion`

Priority determined by checking org's subscription plan at enqueue time.

### Concurrency

Set global max concurrent jobs (e.g., 10) to avoid hammering Gemini API.

### NOT Applied To

- Search (synchronous, user-facing)
- Chat (synchronous, user-facing)

---

## Open Questions

- Exact Gemini token pricing for cost estimates (check current pricing when implementing)
- Concurrency limit tuning (start at 10, adjust based on Gemini rate limits)
