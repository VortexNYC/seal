/**
 * Cacheable internal action for PDF field analysis via Gemini.
 *
 * Separated from the agent tool so that @convex-dev/action-cache can
 * wrap it — the cache keys on (storageId) so the same PDF analyzed
 * twice returns the cached result instantly.
 */

import { ActionCache, type ActionCacheConfig } from "@convex-dev/action-cache";
import { ActionRetrier } from "@convex-dev/action-retrier";
import { generateObject } from "ai";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";

import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import type { FieldType } from "../schemas/signature_fields";
import { getModel } from "./model";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Schema & prompt (shared with the tool)
// ---------------------------------------------------------------------------

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
      category: z.enum(["obligation", "payment", "risk", "dates", "terms"]).describe("Clause category"),
      severity: z.enum(["informational", "important", "critical"]).describe("Severity level"),
      text: z.string().describe("The exact clause text being annotated"),
      summary: z.string().max(120).describe("One-sentence plain-English explanation of this clause"),
    }),
  ),
});

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

// ---------------------------------------------------------------------------
// Internal action (the expensive Gemini call)
// ---------------------------------------------------------------------------

export const analyzeFieldsInternal = internalAction({
  args: {
    storageId: v.id("_storage"),
  },
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
});

// ---------------------------------------------------------------------------
// Cache wrapper — keyed on storageId, expires after 24 hours
// ---------------------------------------------------------------------------

type AnalyzeAction = FunctionReference<
  "action",
  "internal",
  { storageId: Id<"_storage"> },
  FieldAnalysisResult
>;

export const fieldAnalysisCache: ActionCache<AnalyzeAction> = new ActionCache(
  components.actionCache,
  {
    action: internal.ai.analyzeFieldsAction.analyzeFieldsInternal,
    name: "fieldAnalysis",
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  } as ActionCacheConfig<AnalyzeAction>,
);

// ---------------------------------------------------------------------------
// Retrier — for when the cache misses and the Gemini call fails transiently
// ---------------------------------------------------------------------------

export const fieldAnalysisRetrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1000, // 1s initial delay (Gemini rate limits)
  base: 2, // exponential backoff: 1s, 2s, 4s, 8s
  maxFailures: 3, // 3 retries before giving up
});
