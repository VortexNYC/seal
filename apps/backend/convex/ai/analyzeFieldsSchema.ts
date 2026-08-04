/**
 * Zod schema for Gemini document analysis output.
 *
 * Extracted to its own module so tests can import it without
 * pulling in side-effect-heavy deps (ai SDK, action-cache, etc.).
 */

import { z } from "zod";

import type { FieldType } from "../schemas/signature_fields";

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
// Schema (used by generateObject + tests)
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
      x: z
        .number()
        .min(0)
        .max(100)
        .describe("X position as percentage of page width"),
      y: z
        .number()
        .min(0)
        .max(100)
        .describe("Y position as percentage of page height"),
      width: z
        .number()
        .min(1)
        .max(50)
        .describe("Width as percentage of page width"),
      height: z
        .number()
        .min(1)
        .max(20)
        .describe("Height as percentage of page height"),
      label: z
        .string()
        .describe("Descriptive label for the field, e.g. 'Buyer Signature'"),
      confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
      isRequired: z
        .boolean()
        .describe("Whether the field appears to be required"),
    })
  ),
  annotations: z.array(
    z.object({
      page: z.number().int().positive().describe("1-indexed page number"),
      x: z
        .number()
        .min(0)
        .max(100)
        .describe("X position as percentage of page width"),
      y: z
        .number()
        .min(0)
        .max(100)
        .describe("Y position as percentage of page height"),
      width: z
        .number()
        .min(1)
        .max(100)
        .describe("Width as percentage of page width"),
      height: z
        .number()
        .min(0.5)
        .max(30)
        .describe("Height as percentage of page height"),
      category: z
        .enum(["obligation", "payment", "risk", "dates", "terms"])
        .describe("Clause category"),
      severity: z
        .enum(["informational", "important", "critical"])
        .describe("Severity level"),
      text: z.string().describe("The exact clause text being annotated"),
      summary: z
        .string()
        .max(120)
        .describe("One-sentence plain-English explanation of this clause"),
    })
  ),
});
