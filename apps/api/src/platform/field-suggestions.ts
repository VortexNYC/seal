import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import type { createD1 } from "../global/db.js";
import {
  aiFieldSuggestions,
  signatureFields,
} from "../global/schema.js";
import {
  confidenceForCandidateType,
  geometryFromLine,
  mapCandidateTypeToFieldType,
  type PlaceableFieldType,
  validateFieldGeometry,
} from "./field-geometry.js";

type Db = ReturnType<typeof createD1>;

export const suggestionItemSchema = z.object({
  fieldType: z.string(),
  page: z.number().int(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
  confidence: z.number(),
  isRequired: z.boolean(),
});

export type SuggestionItem = z.infer<typeof suggestionItemSchema>;

const candidateInputSchema = z.object({
  type: z.string(),
  label: z.string(),
  page: z.number().optional(),
  line: z.number(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  confidence: z.number().optional(),
});

export type CandidateInput = z.infer<typeof candidateInputSchema>;

export function candidatesToSuggestionItems(
  candidates: CandidateInput[]
): SuggestionItem[] {
  const items: SuggestionItem[] = [];
  for (const raw of candidates) {
    const parsed = candidateInputSchema.safeParse(raw);
    if (!parsed.success) continue;
    const c = parsed.data;
    const fieldType = mapCandidateTypeToFieldType(c.type);
    const fromLine = geometryFromLine(fieldType, c.line);
    const geometry = {
      x: c.x ?? fromLine.x,
      y: c.y ?? fromLine.y,
      width: c.width ?? fromLine.width,
      height: c.height ?? fromLine.height,
    };
    if (!validateFieldGeometry(geometry).valid) continue;
    items.push({
      fieldType,
      page: c.page && c.page >= 1 ? c.page : 1,
      ...geometry,
      label: c.label || fieldType,
      confidence: c.confidence ?? confidenceForCandidateType(c.type),
      isRequired: fieldType === "signature" || fieldType === "date",
    });
  }
  return items;
}

export async function materializeSuggestionsFromCandidates(
  db: Db,
  args: {
    documentId: string;
    organizationId: string;
    candidatesJson: string | null;
  }
): Promise<{
  id: string;
  publicId: string;
  fields: SuggestionItem[];
  modelUsed: string;
  tokensUsed: number;
  processingTimeMs: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
} | null> {
  if (!args.candidatesJson) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(args.candidatesJson) as unknown;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const fields = candidatesToSuggestionItems(
    parsed as CandidateInput[]
  );
  if (fields.length === 0) return null;

  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const now = new Date();

  await db.insert(aiFieldSuggestions).values({
    id,
    publicId,
    documentId: args.documentId,
    organizationId: args.organizationId,
    fields: JSON.stringify(fields),
    modelUsed: "anydoc-heuristics",
    tokensUsed: 0,
    processingTimeMs: 0,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    publicId,
    fields,
    modelUsed: "anydoc-heuristics",
    tokensUsed: 0,
    processingTimeMs: 0,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

export async function applySuggestionItems(
  db: Db,
  args: {
    documentId: string;
    pageCount: number | null;
    items: SuggestionItem[];
    selectedFieldIndices?: number[];
  }
): Promise<{ fieldIds: string[]; count: number }> {
  const selected =
    args.selectedFieldIndices && args.selectedFieldIndices.length > 0
      ? args.selectedFieldIndices
          .filter((i) => i >= 0 && i < args.items.length)
          .map((i) => args.items[i])
          .filter((item): item is SuggestionItem => item !== undefined)
      : args.items;

  const fieldIds: string[] = [];
  const now = new Date();

  for (const item of selected) {
    const fieldType = mapCandidateTypeToFieldType(item.fieldType);
    const geometryCheck = validateFieldGeometry(item);
    if (!geometryCheck.valid) continue;
    if (item.page < 1) continue;
    if (args.pageCount !== null && item.page > args.pageCount) continue;

    let isMainSignature = false;
    if (fieldType === "signature") {
      const existing = await db
        .select({ value: count() })
        .from(signatureFields)
        .where(
          and(
            eq(signatureFields.documentId, args.documentId),
            eq(signatureFields.fieldType, "signature")
          )
        );
      isMainSignature = (existing[0]?.value ?? 0) === 0;
    }

    const fieldId = crypto.randomUUID();
    await db.insert(signatureFields).values({
      id: fieldId,
      publicId: crypto.randomUUID(),
      documentId: args.documentId,
      recipientId: null,
      templateFieldId: null,
      fieldType,
      label: item.label,
      isRequired: item.isRequired,
      isMainSignature,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      page: item.page,
      properties: null,
      validationRules: null,
      createdAt: now,
      updatedAt: now,
    });
    fieldIds.push(fieldId);
  }

  return { fieldIds, count: fieldIds.length };
}

export async function createDocumentField(
  db: Db,
  args: {
    documentId: string;
    pageCount: number | null;
    fieldType: PlaceableFieldType;
    label: string;
    isRequired: boolean;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    recipientId?: string | null;
    propertiesJson?: string | null;
  }
): Promise<{ id: string; publicId: string } | { error: string; status: 400 }> {
  const geometryCheck = validateFieldGeometry({
    x: args.x,
    y: args.y,
    width: args.width,
    height: args.height,
  });
  if (!geometryCheck.valid) {
    return { error: geometryCheck.error ?? "invalid_geometry", status: 400 };
  }
  if (args.page < 1) {
    return { error: "page_must_be_at_least_1", status: 400 };
  }
  if (args.pageCount !== null && args.page > args.pageCount) {
    return { error: "page_exceeds_document", status: 400 };
  }

  let isMainSignature = false;
  if (args.fieldType === "signature" && args.recipientId) {
    const existing = await db
      .select({ value: count() })
      .from(signatureFields)
      .where(
        and(
          eq(signatureFields.documentId, args.documentId),
          eq(signatureFields.recipientId, args.recipientId),
          eq(signatureFields.fieldType, "signature")
        )
      );
    isMainSignature = (existing[0]?.value ?? 0) === 0;
  } else if (args.fieldType === "signature") {
    const existing = await db
      .select({ value: count() })
      .from(signatureFields)
      .where(
        and(
          eq(signatureFields.documentId, args.documentId),
          eq(signatureFields.fieldType, "signature")
        )
      );
    isMainSignature = (existing[0]?.value ?? 0) === 0;
  }

  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const now = new Date();
  await db.insert(signatureFields).values({
    id,
    publicId,
    documentId: args.documentId,
    recipientId: args.recipientId ?? null,
    templateFieldId: null,
    fieldType: args.fieldType,
    label: args.label,
    isRequired: args.isRequired,
    isMainSignature,
    x: args.x,
    y: args.y,
    width: args.width,
    height: args.height,
    page: args.page,
    properties: args.propertiesJson ?? null,
    validationRules: null,
    createdAt: now,
    updatedAt: now,
  });

  return { id, publicId };
}
