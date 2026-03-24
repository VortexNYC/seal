# Document Redlining Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the AI document processing pipeline to produce redline annotations (clause highlights with summaries) alongside field suggestions, and render them as clean pastel highlights on the PDF with an "Insights" sidebar panel.

**Architecture:** Expand the existing `analyzeFieldsInternal` Gemini call to return both `fields[]` and `annotations[]` in a single pass. Pipeline fans out the combined result into `ai_field_suggestions` (existing) and `ai_document_annotations` (new). Frontend renders soft highlights on the PDF and a flat list in the sidebar.

**Tech Stack:** Convex (internalAction/internalMutation), Gemini 3 Flash via Vercel AI SDK (`generateObject`), ActionCache, React + Tailwind.

---

## Task 1: Create `ai_document_annotations` schema

**Files:**

- Create: `apps/backend/convex/schemas/ai_document_annotations.ts`
- Modify: `apps/backend/convex/schema.ts`

**Step 1:** Create `apps/backend/convex/schemas/ai_document_annotations.ts`:

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const annotationCategoryTuple = v.union(
  v.literal("obligation"),
  v.literal("payment"),
  v.literal("risk"),
  v.literal("dates"),
  v.literal("terms"),
);

export const annotationSeverityTuple = v.union(
  v.literal("informational"),
  v.literal("important"),
  v.literal("critical"),
);

export type AnnotationCategory = "obligation" | "payment" | "risk" | "dates" | "terms";
export type AnnotationSeverity = "informational" | "important" | "critical";

export const aiDocumentAnnotationsTable = defineTable({
  documentId: v.id("documents"),
  organizationId: v.id("organizations"),
  annotations: v.array(
    v.object({
      page: v.number(),
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number(),
      category: annotationCategoryTuple,
      severity: annotationSeverityTuple,
      text: v.string(),
      summary: v.string(),
    }),
  ),
  modelUsed: v.string(),
  tokensUsed: v.number(),
  processingTimeMs: v.number(),
  status: v.union(v.literal("pending"), v.literal("active"), v.literal("dismissed")),
  createdAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_organization", ["organizationId"]);
```

**Step 2:** Add to `apps/backend/convex/schema.ts`. Add import after line 4 (after `aiFieldSuggestionsTable`):

```ts
import {
  aiDocumentAnnotationsTable,
  type AnnotationCategory,
  type AnnotationSeverity,
} from "./schemas/ai_document_annotations";
```

Add the re-export in the type exports section:

```ts
export type { AnnotationCategory, AnnotationSeverity };
```

Add the table to the schema definition (after `ai_progress: aiProgressTable` around line 206):

```ts
  ai_document_annotations: aiDocumentAnnotationsTable,
```

**Step 3:** Run `cd apps/backend && bun --bun run dev` briefly to regenerate types. Verify no errors.

**Step 4:** Commit: `feat(ai): add ai_document_annotations schema`

---

## Task 2: Extend Gemini analysis to return annotations

**Files:**

- Modify: `apps/backend/convex/ai/analyzeFieldsAction.ts`

**Step 1:** Expand `FieldAnalysisResult` interface (line 26) to include annotations:

```ts
export interface AnnotationResult {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  category: "obligation" | "payment" | "risk" | "dates" | "terms";
  severity: "informational" | "important" | "critical";
  text: string;
  summary: string;
}

export interface FieldAnalysisResult {
  fields: {
    fieldType: FieldType;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    confidence: number;
    isRequired: boolean;
  }[];
  annotations: AnnotationResult[];
  tokensUsed: number;
  processingTimeMs: number;
}
```

**Step 2:** Add annotation schema to the Zod schema. Replace `FieldSuggestionSchema` (line 46) with `DocumentAnalysisSchema`:

```ts
export const DocumentAnalysisSchema = z.object({
  fields: z.array(
    z.object({
      fieldType: z.enum([
        "signature",
        "text",
        "number",
        "date",
        "checkbox",
        "dropdown",
        "radio",
        "attachment",
        "payment",
      ]),
      page: z.number().int().positive().describe("1-indexed page number"),
      x: z.number().min(0).max(100).describe("X position as percentage of page width"),
      y: z.number().min(0).max(100).describe("Y position as percentage of page height"),
      width: z.number().min(1).max(50).describe("Width as percentage of page width"),
      height: z.number().min(1).max(20).describe("Height as percentage of page height"),
      label: z.string().describe("Descriptive label for the field, e.g. 'Buyer Signature'"),
      confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
      isRequired: z.boolean().describe("Whether the field appears to be required"),
    }),
  ),
  annotations: z.array(
    z.object({
      page: z.number().int().positive().describe("1-indexed page number"),
      x: z.number().min(0).max(100).describe("X position as percentage of page width"),
      y: z.number().min(0).max(100).describe("Y position as percentage of page height"),
      width: z.number().min(1).max(100).describe("Width as percentage of page width"),
      height: z.number().min(0.5).max(30).describe("Height as percentage of page height"),
      category: z
        .enum(["obligation", "payment", "risk", "dates", "terms"])
        .describe("Clause category"),
      severity: z.enum(["informational", "important", "critical"]).describe("Severity level"),
      text: z.string().describe("The exact clause text being annotated"),
      summary: z
        .string()
        .max(120)
        .describe("One-sentence plain-English explanation of this clause"),
    }),
  ),
});
```

**Step 3:** Extend the prompt. Append to `FIELD_ANALYSIS_PROMPT` (after line 102):

```ts
const DOCUMENT_ANALYSIS_PROMPT = `You are analyzing a PDF document for a document signing platform. You have two jobs:

## JOB 1: FIELD DETECTION
Identify all locations where form fields should be placed for recipients to fill in.

### Field Types
- **signature**: Signature lines, "Sign here" labels, signature blocks
- **text**: Name fields, address fields, title fields, any free-text input areas
- **number**: Numeric fields like amounts, quantities, phone numbers
- **date**: Date fields, "Date:" labels, any date entry areas
- **checkbox**: Checkboxes, agreement confirmations, yes/no selections
- **dropdown**: Select fields with predefined options (rare in PDFs)
- **radio**: Radio button groups for mutually exclusive choices
- **attachment**: Areas indicating file upload or attachment requirements
- **payment**: Payment amount fields, invoice totals, amounts due

### Field Guidelines
1. Look for blank lines, underscores, boxes, or labeled areas meant for input
2. Signature blocks are typically at the bottom of documents
3. Date fields often appear near signature lines
4. Look for labels like "Name:", "Address:", "Date:", "Signature:", "Sign:", etc.
5. Consider the document context — contracts have signature/date blocks, invoices have payment fields
6. Set confidence higher (0.8-1.0) when you see clear visual indicators (underlines, boxes, labels)
7. Set confidence lower (0.5-0.7) when inferring from context or document structure
8. Mark fields as required when they have asterisks, "required" labels, or are core to the document
9. Size fields appropriately — signatures need more space (~20-30% width, ~5-8% height), text fields less

## JOB 2: DOCUMENT REDLINING
Identify key clauses in the document that a reader should pay attention to. Annotate them with precise bounding boxes.

### Annotation Categories
- **obligation**: Duties, commitments — "shall", "must", "agrees to", deliverables, deadlines
- **payment**: Amounts, due dates, payment schedules, penalties, fees, pricing
- **risk**: Indemnification, limitation of liability, termination, warranties, disclaimers
- **dates**: Effective dates, expiration dates, renewal periods, notice periods
- **terms**: Key defined terms that affect interpretation of the document

### Annotation Severity
- **informational**: Standard clause, good to be aware of
- **important**: Clause with significant implications — financial commitments, deadlines, restrictions
- **critical**: High-risk clause — large liability exposure, unusual terms, penalty clauses

### Annotation Guidelines
1. The bounding box should tightly cover the clause text being annotated
2. Summary must be one sentence, plain English, max 120 characters — explain what this means for the reader
3. Focus on substantive clauses, not boilerplate headers or formatting
4. For multi-line clauses, the bounding box should cover the full clause
5. Prefer fewer high-quality annotations over many low-value ones — aim for 5-20 per document
6. Every annotation must have real substance — don't annotate obvious things like "This is a contract"

## Coordinate System
- All positions are **percentages of page dimensions** (0-100)
- x=0 is left edge, x=100 is right edge
- y=0 is top edge, y=100 is bottom edge
- Width and height are also percentages

Analyze the document and return both detected fields AND clause annotations.`;
```

**Step 4:** Update the handler. Replace the `generateObject` call and return to use the new schema and prompt:

```ts
  handler: async (ctx, args): Promise<FieldAnalysisResult> => {
    const pdfUrl = await ctx.storage.getUrl(args.storageId);
    if (!pdfUrl) throw new Error("PDF not found in storage");

    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error("Failed to download PDF");
    const pdfBuffer = await response.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    const startTime = Date.now();
    const result = await generateObject({
      model: getModel("google/gemini-3-flash"),
      schema: DocumentAnalysisSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: DOCUMENT_ANALYSIS_PROMPT },
            { type: "file", data: pdfBase64, mediaType: "application/pdf" },
          ],
        },
      ],
    });
    const processingTimeMs = Date.now() - startTime;

    const validated = DocumentAnalysisSchema.parse(result.object);

    return {
      fields: validated.fields,
      annotations: validated.annotations,
      tokensUsed: result.usage?.totalTokens ?? 0,
      processingTimeMs,
    };
  },
```

**Step 5:** Remove the old `FieldSuggestionSchema` and `FIELD_ANALYSIS_PROMPT` constants (they're replaced by `DocumentAnalysisSchema` and `DOCUMENT_ANALYSIS_PROMPT`).

**Step 6:** Run typecheck: `cd apps/backend && bun --bun run typecheck`. Fix any issues.

**Step 7:** Commit: `feat(ai): extend Gemini analysis to extract annotations alongside fields`

---

## Task 3: Add annotation mutations

**Files:**

- Modify: `apps/backend/convex/ai/mutations.ts`

**Step 1:** Add `saveDocumentAnnotations` internal mutation. Add after the existing `saveFieldSuggestions` mutation:

```ts
// ---------------------------------------------------------------------------
// Document annotations (redlining)
// ---------------------------------------------------------------------------

const annotationCategoryTuple = v.union(
  v.literal("obligation"),
  v.literal("payment"),
  v.literal("risk"),
  v.literal("dates"),
  v.literal("terms"),
);

const annotationSeverityTuple = v.union(
  v.literal("informational"),
  v.literal("important"),
  v.literal("critical"),
);

export const saveDocumentAnnotations = internalMutation({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    annotations: v.array(
      v.object({
        page: v.number(),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        category: annotationCategoryTuple,
        severity: annotationSeverityTuple,
        text: v.string(),
        summary: v.string(),
      }),
    ),
    modelUsed: v.string(),
    tokensUsed: v.number(),
    processingTimeMs: v.number(),
  },
  handler: async (ctx, args) => {
    // Dismiss any existing active annotations for this document
    const existing = await ctx.db
      .query("ai_document_annotations")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "active")))
      .collect();

    for (const annotation of existing) {
      await ctx.db.patch(annotation._id, { status: "dismissed" as const });
    }

    // Save new annotations (skip if none detected)
    if (args.annotations.length === 0) return null;

    return await ctx.db.insert("ai_document_annotations", {
      documentId: args.documentId,
      organizationId: args.organizationId,
      annotations: args.annotations,
      modelUsed: args.modelUsed,
      tokensUsed: args.tokensUsed,
      processingTimeMs: args.processingTimeMs,
      status: "active",
      createdAt: Date.now(),
    });
  },
});
```

**Step 2:** Add `dismissDocumentAnnotations` auth mutation (for the master toggle dismiss):

```ts
export const dismissDocumentAnnotations = authMutation({
  args: { annotationId: v.id("ai_document_annotations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.annotationId, { status: "dismissed" as const });
  },
});
```

**Step 3:** Run typecheck. Commit: `feat(ai): add annotation save and dismiss mutations`

---

## Task 4: Add annotation query

**Files:**

- Modify: `apps/backend/convex/ai/queries.ts`

**Step 1:** Add `getDocumentAnnotations` query after the existing queries:

```ts
export const getDocumentAnnotations = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_document_annotations")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .first();
  },
});
```

**Step 2:** Run typecheck. Commit: `feat(ai): add annotation query`

---

## Task 5: Hook annotations into the pipeline

**Files:**

- Modify: `apps/backend/convex/ai/pipeline.ts`

**Step 1:** After the existing `saveFieldSuggestions` call (step 4, around line 42), add the annotation save:

```ts
// 5. Save document annotations (redlining)
if (result.annotations && result.annotations.length > 0) {
  await ctx.runMutation(internal.ai.mutations.saveDocumentAnnotations, {
    documentId: args.documentId,
    organizationId: args.organizationId,
    annotations: result.annotations,
    modelUsed: "gemini-3-flash",
    tokensUsed: result.tokensUsed,
    processingTimeMs: result.processingTimeMs,
  });
}
```

Update the step numbers for the existing search indexing (becomes step 6) and mark completed (becomes step 7).

**Step 2:** Run typecheck. Commit: `feat(ai): save annotations in document processing pipeline`

---

## Task 6: Create annotation highlight overlays component

**Files:**

- Create: `apps/web/src/components/documents/ai-annotation-overlays.tsx`

**Step 1:** Create the component file:

```tsx
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  BookOpenIcon,
  CalendarIcon,
  InfoIcon,
  ScaleIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnnotationCategory = "obligation" | "payment" | "risk" | "dates" | "terms";
type AnnotationSeverity = "informational" | "important" | "critical";

interface Annotation {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  category: AnnotationCategory;
  severity: AnnotationSeverity;
  text: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  AnnotationCategory,
  { label: string; icon: typeof InfoIcon; bgColor: string; textColor: string; dotColor: string }
> = {
  obligation: {
    label: "Obligation",
    icon: BookOpenIcon,
    bgColor: "bg-blue-100/50 dark:bg-blue-900/20",
    textColor: "text-blue-700 dark:text-blue-300",
    dotColor: "bg-blue-500",
  },
  payment: {
    label: "Payment",
    icon: BanknoteIcon,
    bgColor: "bg-emerald-100/50 dark:bg-emerald-900/20",
    textColor: "text-emerald-700 dark:text-emerald-300",
    dotColor: "bg-emerald-500",
  },
  risk: {
    label: "Risk",
    icon: AlertTriangleIcon,
    bgColor: "bg-rose-100/50 dark:bg-rose-900/20",
    textColor: "text-rose-700 dark:text-rose-300",
    dotColor: "bg-rose-500",
  },
  dates: {
    label: "Date",
    icon: CalendarIcon,
    bgColor: "bg-violet-100/50 dark:bg-violet-900/20",
    textColor: "text-violet-700 dark:text-violet-300",
    dotColor: "bg-violet-500",
  },
  terms: {
    label: "Term",
    icon: ScaleIcon,
    bgColor: "bg-amber-100/50 dark:bg-amber-900/20",
    textColor: "text-amber-700 dark:text-amber-300",
    dotColor: "bg-amber-500",
  },
};

const SEVERITY_DOT: Record<AnnotationSeverity, string> = {
  informational: "opacity-40",
  important: "opacity-70",
  critical: "opacity-100",
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDocumentAnnotations(documentId: Id<"documents">) {
  const annotations = useQuery(api.ai.queries.getDocumentAnnotations, { documentId });
  const dismissMutation = useMutation(api.ai.mutations.dismissDocumentAnnotations);
  const [enabledCategories, setEnabledCategories] = useState<Set<AnnotationCategory>>(
    new Set(["obligation", "payment", "risk", "dates", "terms"]),
  );

  const toggleCategory = useCallback((category: AnnotationCategory) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleDismiss = useCallback(async () => {
    if (!annotations) return;
    try {
      await dismissMutation({ annotationId: annotations._id });
      toast.info("Annotations dismissed");
    } catch {
      toast.error("Failed to dismiss annotations");
    }
  }, [annotations, dismissMutation]);

  return {
    annotations,
    enabledCategories,
    toggleCategory,
    handleDismiss,
  };
}

// ---------------------------------------------------------------------------
// PDF highlight overlay (inside TransformComponent)
// ---------------------------------------------------------------------------

function HighlightOverlay({
  annotation,
  currentPage,
  pdfPageWidth,
  pdfPageHeight,
}: {
  annotation: Annotation;
  currentPage: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
}) {
  if (annotation.page !== currentPage) return null;

  const left = (annotation.x / 100) * pdfPageWidth;
  const top = (annotation.y / 100) * pdfPageHeight;
  const width = (annotation.width / 100) * pdfPageWidth;
  const height = (annotation.height / 100) * pdfPageHeight;

  const config = CATEGORY_CONFIG[annotation.category];

  return (
    <div
      className={cn("group/highlight absolute rounded-sm transition-opacity", config.bgColor)}
      style={{ left, top, width, height }}
    >
      {/* Tooltip on hover */}
      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden max-w-xs rounded-md border border-slate-200 bg-white px-3 py-2 shadow-lg group-hover/highlight:block dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-1.5 mb-0.5">
          <config.icon className={cn("h-3 w-3", config.textColor)} />
          <span
            className={cn("text-[10px] font-semibold uppercase tracking-wide", config.textColor)}
          >
            {config.label}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {annotation.summary}
        </p>
      </div>
    </div>
  );
}

export function AIAnnotationOverlays({
  annotations,
  enabledCategories,
  currentPage,
  pdfPageWidth,
  pdfPageHeight,
}: {
  annotations: NonNullable<ReturnType<typeof useDocumentAnnotations>["annotations"]>;
  enabledCategories: Set<AnnotationCategory>;
  currentPage: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
}) {
  // Only show important + critical on PDF; filter by enabled categories
  const visible = annotations.annotations.filter(
    (a) =>
      a.severity !== "informational" &&
      enabledCategories.has(a.category as AnnotationCategory) &&
      a.page === currentPage,
  );

  return (
    <>
      {visible.map((annotation, i) => (
        <HighlightOverlay
          key={`annotation-${i}`}
          annotation={annotation}
          currentPage={currentPage}
          pdfPageWidth={pdfPageWidth}
          pdfPageHeight={pdfPageHeight}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sidebar insights panel
// ---------------------------------------------------------------------------

export function AIInsightsPanel({
  annotations,
  enabledCategories,
  toggleCategory,
  onDismiss,
  onPageJump,
}: {
  annotations: NonNullable<ReturnType<typeof useDocumentAnnotations>["annotations"]>;
  enabledCategories: Set<AnnotationCategory>;
  toggleCategory: (category: AnnotationCategory) => void;
  onDismiss: () => void;
  onPageJump: (page: number) => void;
}) {
  const allAnnotations = annotations.annotations;
  const filtered = allAnnotations.filter((a) =>
    enabledCategories.has(a.category as AnnotationCategory),
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CATEGORY_CONFIG) as AnnotationCategory[]).map((category) => {
          const config = CATEGORY_CONFIG[category];
          const count = allAnnotations.filter((a) => a.category === category).length;
          if (count === 0) return null;
          const isActive = enabledCategories.has(category);

          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all",
                isActive
                  ? cn(config.bgColor, config.textColor)
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? config.dotColor : "bg-slate-300 dark:bg-slate-600",
                )}
              />
              {config.label}
              <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Annotation list */}
      <div className="flex flex-col gap-1">
        {filtered.map((annotation, i) => {
          const config = CATEGORY_CONFIG[annotation.category as AnnotationCategory];
          return (
            <button
              key={`insight-${i}`}
              type="button"
              onClick={() => onPageJump(annotation.page)}
              className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  config.dotColor,
                  SEVERITY_DOT[annotation.severity as AnnotationSeverity],
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-snug text-slate-700 dark:text-slate-300">
                  {annotation.summary}
                </p>
              </div>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                p.{annotation.page}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        className="text-[11px] text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
      >
        Dismiss all insights
      </button>
    </div>
  );
}
```

**Step 2:** Run typecheck: `cd apps/web && bun --bun run typecheck`

**Step 3:** Commit: `feat(ai): create annotation overlay and insights panel components`

---

## Task 7: Wire annotations into the document editor page

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx`

**Step 1:** Add imports at the top of the file (near the other AI component imports around line 38):

```ts
import {
  AIAnnotationOverlays,
  AIInsightsPanel,
  useDocumentAnnotations,
} from "../../../../components/documents/ai-annotation-overlays";
```

Add `ScanSearchIcon` to the lucide-react import (for the Insights section header icon).

**Step 2:** In `DocumentDetailPage()`, add the hook call near the existing AI hooks (around line 363):

```ts
const documentAnnotations = useDocumentAnnotations(documentId as Id<"documents">);
```

**Step 3:** Add annotation overlays inside TransformComponent, right after the `AIFieldOverlays` block (around line 1169). The overlays must be inside the same container div so they zoom with the PDF:

```tsx
{
  /* AI annotation overlays (redlining) — inside TransformComponent */
}
{
  canEdit && documentAnnotations.annotations && (
    <AIAnnotationOverlays
      annotations={documentAnnotations.annotations}
      enabledCategories={documentAnnotations.enabledCategories}
      currentPage={currentPage}
      pdfPageWidth={pdfWidth}
      pdfPageHeight={pdfHeight}
    />
  );
}
```

**Step 4:** Add the Insights sidebar section. Add it after the AI Chat Panel section (around line 1387) and before the Signature Fields section:

```tsx
{
  /* AI Insights (Redlining) */
}
{
  canEdit && documentAnnotations.annotations && (
    <Collapsible
      open={openSections.has("insights")}
      onOpenChange={() => toggleSection("insights")}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-slate-50 sm:px-4 sm:py-3.5 dark:hover:bg-slate-800"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-rose-100 text-rose-600 sm:h-8 sm:w-8 sm:rounded-lg dark:bg-rose-900 dark:text-rose-400">
              <ScanSearchIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
            </div>
            <span className="font-sans text-[0.9375rem] font-semibold text-slate-800 sm:text-sm dark:text-slate-200">
              Insights
            </span>
            <span className="ml-2 rounded-xl bg-slate-100 px-2 py-0.5 font-sans text-[0.6875rem] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {documentAnnotations.annotations.annotations.length}
            </span>
          </div>
          <ChevronDownIcon
            className={`h-4 w-4 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${openSections.has("insights") ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
        <div className="mt-3">
          <AIInsightsPanel
            annotations={documentAnnotations.annotations}
            enabledCategories={documentAnnotations.enabledCategories}
            toggleCategory={documentAnnotations.toggleCategory}
            onDismiss={documentAnnotations.handleDismiss}
            onPageJump={(page) => setCurrentPage(page)}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

**Step 5:** Run typecheck + lint: `bun --bun run typecheck && bun --bun run lint`

**Step 6:** Commit: `feat(ai): wire annotation overlays and insights panel into document editor`

---

## Task 8: Static analysis and generated files

**Step 1:** Run full static analysis from root: `bun --bun run typecheck && bun --bun run lint`

**Step 2:** If there are errors, fix them.

**Step 3:** Commit any generated file changes: `chore: update generated types for document annotations`

---

## Files Summary

### New Files

| File                                                      | Purpose                         |
| --------------------------------------------------------- | ------------------------------- |
| `convex/schemas/ai_document_annotations.ts`               | Annotation table schema         |
| `web/src/components/documents/ai-annotation-overlays.tsx` | Overlay + insights panel + hook |

### Modified Files

| File                                | Changes                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| `convex/schema.ts`                  | Register `ai_document_annotations` table                          |
| `convex/ai/analyzeFieldsAction.ts`  | Expand Zod schema, prompt, and result type to include annotations |
| `convex/ai/mutations.ts`            | Add `saveDocumentAnnotations` + `dismissDocumentAnnotations`      |
| `convex/ai/queries.ts`              | Add `getDocumentAnnotations`                                      |
| `convex/ai/pipeline.ts`             | Fan out annotations from combined result                          |
| `web/.../documents/$documentId.tsx` | Render overlays + insights sidebar section                        |

---

## Verification

1. **Static analysis**: `bun --bun run typecheck && bun --bun run lint` — zero errors
2. **Backend dev server**: `cd apps/backend && bun --bun run dev` — starts, new table recognized
3. **Manual test flow**:
   - Upload a contract PDF → pipeline processes → check `ai_document_annotations` table in Convex dashboard
   - Should have annotations with categories, severities, bounding boxes, summaries
   - Open document in editor → pastel highlights appear on important/critical clauses
   - Hover a highlight → tooltip shows category and summary
   - Sidebar "Insights" section → shows all annotations with filter chips
   - Click an insight → page jumps to that annotation's page
   - Toggle a category filter chip → corresponding highlights hide/show
   - Click "Dismiss all insights" → annotations disappear
   - Replace PDF → old annotations dismissed, new ones generated
4. **Cache behavior**: Upload same PDF twice — second analysis is instant (cached), both fields and annotations returned from cache
