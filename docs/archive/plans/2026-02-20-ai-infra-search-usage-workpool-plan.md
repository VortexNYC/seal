# AI Infrastructure: Search, Usage Tracking, Priority Queues — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Cmd+K to a power command palette with filters (kill search page), add AI usage tracking per org, and add priority queues so Pro orgs' AI jobs process first.

**Architecture:** Cmd+K switches to `fullSearch` with inline filter chips. New `ai_usage_log` table with `@convex-dev/aggregate` for efficient rollups. Two named `@convex-dev/workpool` instances (pro/free) replace `scheduler.runAfter` for pipeline jobs.

**Tech Stack:** Convex, `@convex-dev/aggregate`, `@convex-dev/workpool`, `cmdk` (existing), React, TanStack Router

---

## Task 1: Install workpool + aggregate packages

**Files:**

- Modify: `apps/backend/package.json`
- Modify: `apps/backend/convex/convex.config.ts`

**Step 1:** Install packages:

```bash
cd apps/backend && bun add @convex-dev/workpool @convex-dev/aggregate
```

**Step 2:** Register components in `apps/backend/convex/convex.config.ts`. Add after existing `app.use(rag)`:

```ts
import aggregate from "@convex-dev/aggregate/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";

// ... existing registrations ...

app.use(aggregate, { name: "aiUsageAggregate" });
app.use(workpool, { name: "aiPoolPro" });
app.use(workpool, { name: "aiPoolFree" });
```

Keep the existing imports (`actionCache`, `actionRetrier`, `agent`, `rag`, `rateLimiter`) as-is. Just add the three new `app.use()` calls.

**Step 3:** Regenerate types:

```bash
cd apps/backend && npx convex dev --once
```

**Step 4:** Verify no errors. Commit:

```
feat(ai): install @convex-dev/workpool and @convex-dev/aggregate
```

---

## Task 2: Add `ai_usage_log` schema

**Files:**

- Create: `apps/backend/convex/schemas/ai_usage_log.ts`
- Modify: `apps/backend/convex/schema.ts`

**Step 1:** Create `apps/backend/convex/schemas/ai_usage_log.ts`:

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiActionValidator = v.union(
  v.literal("field_analysis"),
  v.literal("payment_extraction"),
  v.literal("redlining"),
  v.literal("search"),
  v.literal("chat")
);

export const aiUsageLogTable = defineTable({
  organizationId: v.id("organizations"),
  userId: v.id("users"),
  action: aiActionValidator,
  tokensUsed: v.number(),
  estimatedCostUsd: v.number(),
  durationMs: v.number(),
  documentId: v.optional(v.id("documents")),
  modelUsed: v.string(),
  createdAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_organization_created", ["organizationId", "createdAt"])
  .index("by_user", ["userId"]);
```

**Step 2:** Add import and registration in `apps/backend/convex/schema.ts`. Add import:

```ts
import { aiUsageLogTable } from "./schemas/ai_usage_log";
```

Add to the `defineSchema({...})` call (alphabetically near other `ai_` tables):

```ts
ai_usage_log: aiUsageLogTable,
```

**Step 3:** Regenerate types:

```bash
cd apps/backend && npx convex dev --once
```

**Step 4:** Commit:

```
feat(ai): add ai_usage_log schema for usage tracking
```

---

## Task 3: Create usage tracking helpers

**Files:**

- Create: `apps/backend/convex/ai/usage.ts`

**Step 1:** Create `apps/backend/convex/ai/usage.ts`:

```ts
/**
 * AI usage tracking — logs every AI action and maintains aggregate counters.
 *
 * Call `logAiUsage` from any AI action/mutation to record usage.
 * Query aggregates via `getOrgUsageSummary` for dashboards.
 */

import { TableAggregate } from "@convex-dev/aggregate";
import { v } from "convex/values";

import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Aggregate: count + sum tokens per org, keyed by createdAt for time-range queries.
 * Namespace by organizationId for write throughput isolation.
 */
export const aiUsageAggregate = new TableAggregate<{
  Namespace: string;
  Key: number;
  DataModel: DataModel;
  TableName: "ai_usage_log";
}>(components.aiUsageAggregate, {
  namespace: (doc) => doc.organizationId,
  sortKey: (doc) => doc.createdAt,
  sumValue: (doc) => doc.tokensUsed,
});

/** Estimated cost per 1M tokens by model (input + output blended average). */
const MODEL_COST_PER_MILLION: Record<string, number> = {
  "gemini-2.0-flash": 0.1,
  "gemini-3-flash": 0.1,
  "gemini-3-pro": 1.25,
};

function estimateCost(tokensUsed: number, modelUsed: string): number {
  const costPerMillion = MODEL_COST_PER_MILLION[modelUsed] ?? 0.1;
  return (tokensUsed / 1_000_000) * costPerMillion;
}

/**
 * Log an AI usage event. Call from any AI action after completion.
 */
export const logAiUsage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    action: v.union(
      v.literal("field_analysis"),
      v.literal("payment_extraction"),
      v.literal("redlining"),
      v.literal("search"),
      v.literal("chat")
    ),
    tokensUsed: v.number(),
    durationMs: v.number(),
    documentId: v.optional(v.id("documents")),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const estimatedCostUsd = estimateCost(args.tokensUsed, args.modelUsed);

    const id = await ctx.db.insert("ai_usage_log", {
      ...args,
      estimatedCostUsd,
      createdAt: now,
    });

    // Keep aggregate in sync
    const doc = await ctx.db.get(id);
    if (doc) {
      await aiUsageAggregate.insert(ctx, doc);
    }
  },
});

/**
 * Get usage summary for an org in a time range.
 * Returns total calls and total tokens.
 */
export const getOrgUsageSummary = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    const bounds = {
      lower: { key: args.from, inclusive: true },
      upper: { key: args.to, inclusive: true },
    };

    const totalCalls = await aiUsageAggregate.count(ctx, {
      namespace: args.organizationId,
      bounds,
    });
    const totalTokens = await aiUsageAggregate.sum(ctx, {
      namespace: args.organizationId,
      bounds,
    });

    return { totalCalls, totalTokens };
  },
});
```

**Step 2:** Run typecheck:

```bash
cd apps/backend && bun --bun run typecheck
```

**Step 3:** Commit:

```
feat(ai): add usage tracking helpers with aggregate counters
```

---

## Task 4: Create workpool instances and enqueue helper

**Files:**

- Create: `apps/backend/convex/ai/workpool.ts`

**Step 1:** Create `apps/backend/convex/ai/workpool.ts`:

```ts
/**
 * AI workpool — priority queues for background AI processing.
 *
 * Pro orgs get a pool with higher parallelism (processed first).
 * Free orgs get a pool with lower parallelism (processed after Pro).
 */

import { Workpool } from "@convex-dev/workpool";

import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { DatabaseReader, MutationCtx } from "../_generated/server";

/** Pro pool: higher parallelism = more concurrent jobs. */
export const aiPoolPro = new Workpool(components.aiPoolPro, {
  maxParallelism: 8,
});

/** Free pool: lower parallelism = jobs wait longer under load. */
export const aiPoolFree = new Workpool(components.aiPoolFree, {
  maxParallelism: 2,
});

/**
 * Enqueue a document for AI processing via the appropriate priority pool.
 *
 * Call this from document mutations instead of `ctx.scheduler.runAfter`.
 * Resolves the org's subscription plan to pick Pro vs Free pool.
 */
export async function enqueueAiPipeline(
  ctx: MutationCtx,
  db: DatabaseReader,
  documentId: Id<"documents">,
  organizationId: Id<"organizations">
) {
  // Determine plan tier — find org owner's subscription
  const isPro = await isProOrganization(db, organizationId);
  const pool = isPro ? aiPoolPro : aiPoolFree;

  await pool.enqueueAction(ctx, internal.ai.pipeline.processDocument, {
    documentId,
    organizationId,
  });
}

/**
 * Check if an organization has at least one member with a Pro subscription.
 */
async function isProOrganization(
  db: DatabaseReader,
  organizationId: Id<"organizations">
): Promise<boolean> {
  // Find the primary (owner) member
  const owner = await db
    .query("organization_members")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("isPrimary"), true))
    .first();

  if (!owner) return false;

  // Check their subscription
  const subscription = await db
    .query("subscriptions")
    .withIndex("by_user_id", (q) => q.eq("userId", owner.userId))
    .order("desc")
    .first();

  return (
    subscription?.status === "active" || subscription?.status === "trialing"
  );
}
```

**Step 2:** Run typecheck:

```bash
cd apps/backend && bun --bun run typecheck
```

**Step 3:** Commit:

```
feat(ai): add workpool instances with Pro/Free priority tiers
```

---

## Task 5: Replace scheduler.runAfter with workpool in document mutations

**Files:**

- Modify: `apps/backend/convex/documents/mutations.ts`

**Step 1:** Add import at top of file:

```ts
import { enqueueAiPipeline } from "../ai/workpool";
```

**Step 2:** In `createDocument` (around line 137-141), replace:

```ts
await ctx.scheduler.runAfter(0, internal.ai.pipeline.processDocument, {
  documentId,
  organizationId: args.organizationId,
});
```

With:

```ts
await enqueueAiPipeline(ctx, ctx.db, documentId, args.organizationId);
```

**Step 3:** In `replaceDocumentPdf` (around line 660-663), replace:

```ts
await ctx.scheduler.runAfter(0, internal.ai.pipeline.processDocument, {
  documentId: args.documentId,
  organizationId: document.organizationId,
});
```

With:

```ts
await enqueueAiPipeline(ctx, ctx.db, args.documentId, document.organizationId);
```

**Step 4:** In `restoreDocumentVersion` (around line 767-770), replace:

```ts
await ctx.scheduler.runAfter(0, internal.ai.pipeline.processDocument, {
  documentId: args.documentId,
  organizationId: document.organizationId,
});
```

With:

```ts
await enqueueAiPipeline(ctx, ctx.db, args.documentId, document.organizationId);
```

**Step 5:** Remove the now-unused `internal` import for `internal.ai.pipeline.processDocument` if it was only used for these calls. Check if `internal` is still used elsewhere in the file — it likely is, so leave the import.

**Step 6:** Run typecheck + lint:

```bash
cd apps/backend && bun --bun run typecheck && bun --bun run lint
```

**Step 7:** Commit:

```
feat(ai): replace scheduler.runAfter with workpool priority queues
```

---

## Task 6: Instrument pipeline with usage logging

**Files:**

- Modify: `apps/backend/convex/ai/pipeline.ts`

The pipeline needs to: (a) resolve the userId who triggered it, and (b) log usage after each AI step.

**Step 1:** Add `userId` arg to `processDocument`. Modify the args:

```ts
export const processDocument = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),  // optional for backward compat
  },
```

**Step 2:** After the field analysis completes (step 4, after `saveFieldSuggestions`), add usage logging:

```ts
// Log field analysis usage
if (args.userId) {
  await ctx.runMutation(internal.ai.usage.logAiUsage, {
    organizationId: args.organizationId,
    userId: args.userId,
    action: "field_analysis",
    tokensUsed: result.tokensUsed,
    durationMs: result.processingTimeMs,
    documentId: args.documentId,
    modelUsed: "gemini-3-flash",
  });
}
```

**Step 3:** After the redlining step (step 5, after `saveDocumentAnnotations`), add:

```ts
// Log redlining usage
if (args.userId) {
  await ctx.runMutation(internal.ai.usage.logAiUsage, {
    organizationId: args.organizationId,
    userId: args.userId,
    action: "redlining",
    tokensUsed: result.tokensUsed,
    durationMs: result.processingTimeMs,
    documentId: args.documentId,
    modelUsed: "gemini-3-flash",
  });
}
```

**Step 4:** Update the three `enqueueAiPipeline` call sites in `documents/mutations.ts` to also pass `userId`. In the workpool helper `enqueueAiPipeline`, add `userId` parameter and pass it through:

In `apps/backend/convex/ai/workpool.ts`, update the function signature:

```ts
export async function enqueueAiPipeline(
  ctx: MutationCtx,
  db: DatabaseReader,
  documentId: Id<"documents">,
  organizationId: Id<"organizations">,
  userId?: Id<"users">
) {
  const isPro = await isProOrganization(db, organizationId);
  const pool = isPro ? aiPoolPro : aiPoolFree;

  await pool.enqueueAction(ctx, internal.ai.pipeline.processDocument, {
    documentId,
    organizationId,
    userId,
  });
}
```

Then in `documents/mutations.ts`, update each call to pass the user:

- `createDocument`: `await enqueueAiPipeline(ctx, ctx.db, documentId, args.organizationId, ctx.auth.user._id);`
- `replaceDocumentPdf`: `await enqueueAiPipeline(ctx, ctx.db, args.documentId, document.organizationId, ctx.auth.user._id);`
- `restoreDocumentVersion`: `await enqueueAiPipeline(ctx, ctx.db, args.documentId, document.organizationId, ctx.auth.user._id);`

**Step 5:** Run typecheck:

```bash
cd apps/backend && bun --bun run typecheck
```

**Step 6:** Commit:

```
feat(ai): instrument pipeline with usage logging
```

---

## Task 7: Instrument search with usage logging

**Files:**

- Modify: `apps/backend/convex/ai/search_queries.ts`

**Step 1:** In `fullSearch`, after the `hybridSearchDocuments` call returns results, add usage logging. We need to estimate tokens (search is lighter — use a rough estimate based on query length + results).

After the `return` line in `fullSearch`, restructure to log before returning:

```ts
export const fullSearch = action({
  args: {
    query: v.string(),
    workflowStatus: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SearchResult[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    if (args.query.trim().length < 2) return [];

    const result = await ctx.runQuery(
      internal.ai.search_queries.getCurrentUserOrg,
      {
        clerkUserId: identity.subject,
      }
    );
    if (!result) return [];

    const startMs = Date.now();
    const results = await ctx.runAction(
      internal.ai.search.hybridSearchDocuments,
      {
        organizationId: result.organizationId,
        query: args.query.trim(),
        limit: args.limit ?? 20,
        workflowStatus: args.workflowStatus,
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
      }
    );
    const durationMs = Date.now() - startMs;

    // Log search usage (resolve userId)
    const user = await ctx.runQuery(
      internal.ai.search_queries.getUserByClerkId,
      {
        clerkUserId: identity.subject,
      }
    );
    if (user) {
      await ctx.runMutation(internal.ai.usage.logAiUsage, {
        organizationId: result.organizationId,
        userId: user._id,
        action: "search",
        tokensUsed: Math.ceil(args.query.length * 1.5) + results.length * 100,
        durationMs,
        modelUsed: "text-embedding-005",
      });
    }

    return results;
  },
});
```

**Step 2:** Add a `getUserByClerkId` internal query in the same file:

```ts
export const getUserByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkUserId))
      .first();
  },
});
```

**Step 3:** Delete the `quickSearch` action entirely from this file.

**Step 4:** Run typecheck:

```bash
cd apps/backend && bun --bun run typecheck
```

**Step 5:** Commit:

```
feat(ai): instrument search with usage logging, remove quickSearch
```

---

## Task 8: Upgrade command palette — switch to fullSearch with filters

**Files:**

- Modify: `apps/web/src/components/command-palette.tsx`

**Step 1:** Rewrite the command palette to use `fullSearch` instead of `quickSearch`, add filter state, and embed the `SearchFiltersBar` component.

Replace the entire file content with:

```tsx
/**
 * Power Command Palette (Cmd+K) — full workspace search with filters.
 *
 * Uses fullSearch for filtered hybrid search with up to 20 results.
 * Inline filter bar for status and date range filtering.
 */

import { useAction } from "convex/react";
import { FileTextIcon, Loader2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useDebounce } from "use-debounce";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { api } from "@seal/backend/convex/_generated/api";

interface SearchResult {
  documentId: string;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  score: number;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { slug } = useParams({ strict: false }) as { slug?: string };
  const navigate = useNavigate();
  const fullSearch = useAction(api.ai.search_queries.fullSearch);

  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 200);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Filters
  const [workflowStatus, setWorkflowStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const hasActiveFilters = workflowStatus !== "all" || dateFrom || dateTo;

  // Run search when debounced query or filters change
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    fullSearch({
      query: debouncedQuery,
      workflowStatus: workflowStatus !== "all" ? workflowStatus : undefined,
      dateFrom: dateFrom ? new Date(dateFrom).getTime() : undefined,
      dateTo: dateTo ? new Date(dateTo).getTime() : undefined,
      limit: 15,
    })
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
  }, [debouncedQuery, fullSearch, workflowStatus, dateFrom, dateTo]);

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
        navigate({
          to: "/$slug/documents/$documentId",
          params: { slug, documentId },
        });
      }
    },
    [navigate, onOpenChange, slug]
  );

  const clearFilters = useCallback(() => {
    setWorkflowStatus("all");
    setDateFrom("");
    setDateTo("");
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Documents"
      description="Search across all workspace documents"
    >
      <CommandInput
        placeholder="Search documents..."
        value={query}
        onValueChange={setQuery}
      />

      {/* Inline filter bar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Select value={workflowStatus} onValueChange={setWorkflowStatus}>
          <SelectTrigger className="h-7 w-[140px] text-xs">
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
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <CalendarIcon className="h-3 w-3" />
              Date
              {(dateFrom || dateTo) && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1 py-0 text-[9px]"
                >
                  set
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 gap-1 text-xs text-muted-foreground"
          >
            <XIcon className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <CommandList className="max-h-[400px]">
        {isSearching ? (
          <div className="flex items-center justify-center py-6">
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : query.length >= 2 && results.length === 0 ? (
          <CommandEmpty>No documents found.</CommandEmpty>
        ) : (
          results.length > 0 && (
            <CommandGroup
              heading={`${results.length} result${results.length !== 1 ? "s" : ""}`}
            >
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
                      {result.pageNumber > 0 && (
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
          )
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
 * Call this in the workspace layout to make the command palette accessible everywhere.
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

**Step 2:** Run typecheck + lint:

```bash
bun --bun run typecheck && bun --bun run lint
```

**Step 3:** Commit:

```
feat(ai): upgrade Cmd+K to power palette with filters
```

---

## Task 9: Delete search page and sidebar link

**Files:**

- Delete: `apps/web/src/routes/_authenticated/$slug/search.tsx`
- Delete: `apps/web/src/components/search/search-filters.tsx`
- Delete: `apps/web/src/components/search/citation-chip.tsx`
- Modify: `apps/web/src/components/app-sidebar.tsx`

**Step 1:** Delete the search page route:

```bash
rm apps/web/src/routes/_authenticated/\$slug/search.tsx
```

**Step 2:** Delete the now-unused search components:

```bash
rm -rf apps/web/src/components/search/
```

**Step 3:** In `apps/web/src/components/app-sidebar.tsx`, remove the search nav entry (around line 139-142):

Remove:

```ts
    {
      title: "Search",
      url: buildOrganizationPath(slug, "/search"),
      visible: true,
    },
```

**Step 4:** Check for any other imports of the deleted files:

```bash
cd apps/web && grep -r "search/citation-chip\|search/search-filters\|/search" src/ --include="*.tsx" --include="*.ts" -l
```

Fix any remaining imports found.

**Step 5:** Run typecheck + lint:

```bash
bun --bun run typecheck && bun --bun run lint
```

**Step 6:** Commit:

```
feat(ai): remove search page, Cmd+K is the only search interface
```

---

## Task 10: Typecheck + lint + build from root

**Step 1:** Run full verification:

```bash
bun --bun run typecheck && bun --bun run lint && bun --bun run build
```

**Step 2:** Fix any remaining issues.

**Step 3:** Commit if any fixes were needed:

```
fix: resolve remaining type/lint issues from AI infra changes
```

---

## Files Summary

### New Files

| File                             | Purpose                                      |
| -------------------------------- | -------------------------------------------- |
| `convex/schemas/ai_usage_log.ts` | Schema for AI usage tracking table           |
| `convex/ai/usage.ts`             | Usage logging mutations + aggregate counters |
| `convex/ai/workpool.ts`          | Pro/Free workpool instances + enqueue helper |

### Modified Files

| File                                 | Changes                                             |
| ------------------------------------ | --------------------------------------------------- |
| `convex/convex.config.ts`            | Register aggregate + 2 workpool components          |
| `convex/schema.ts`                   | Add `ai_usage_log` table                            |
| `convex/ai/pipeline.ts`              | Add userId arg, log usage after each AI step        |
| `convex/ai/search_queries.ts`        | Delete quickSearch, add usage logging to fullSearch |
| `convex/documents/mutations.ts`      | Replace scheduler.runAfter with workpool enqueue    |
| `web/components/command-palette.tsx` | Full rewrite — filters, fullSearch, more results    |
| `web/components/app-sidebar.tsx`     | Remove search nav link                              |

### Deleted Files

| File                                         | Reason                       |
| -------------------------------------------- | ---------------------------- |
| `web/routes/_authenticated/$slug/search.tsx` | Cmd+K replaces search page   |
| `web/components/search/search-filters.tsx`   | Was only used by search page |
| `web/components/search/citation-chip.tsx`    | Was only used by search page |

---

## Verification

1. **Static analysis**: `bun --bun run typecheck && bun --bun run lint && bun --bun run build` — zero errors
2. **Backend dev server**: `cd apps/backend && bun --bun run dev` — starts, new tables recognized
3. **Cmd+K test**: Press Cmd+K → type a query → see results with filter chips → filter by status → filter by date → navigate to result
4. **Usage tracking test**: Upload a document → check `ai_usage_log` table in Convex dashboard → verify field_analysis + redlining entries logged
5. **Workpool test**: Upload a document → check Convex dashboard for workpool job entries instead of scheduler entries
6. **Search page gone**: Navigate to `/$slug/search` → should 404 or redirect
