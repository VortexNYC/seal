import { z } from "zod";

export const fieldCandidateSchema = z.object({
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

const parseResultSchema = z.object({
  format: z.string(),
  markdown: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  pageCount: z.number().optional(),
  pdfType: z.string().nullable().optional(),
  pagesNeedingOcr: z.array(z.number()).optional(),
  ocrReasonsByPage: z
    .array(
      z.object({
        page: z.number(),
        reasons: z.array(z.string()),
      })
    )
    .optional(),
  layout: z
    .object({
      isComplex: z.boolean(),
      pagesWithTables: z.array(z.number()),
      pagesWithColumns: z.array(z.number()),
    })
    .nullable()
    .optional(),
  hasEncodingIssues: z.boolean().nullable().optional(),
  confidence: z.number().nullable().optional(),
  processingTimeMs: z.number().optional(),
  fieldCandidates: z.array(fieldCandidateSchema).optional(),
});

export type FieldCandidate = z.infer<typeof fieldCandidateSchema>;

export type ParsedDocument = {
  format: string;
  markdown: string | null;
  title: string | null;
  pageCount: number | undefined;
  pdfType: string | null;
  pagesNeedingOcr: number[];
  ocrReasonsByPage: { page: number; reasons: string[] }[];
  layout: {
    isComplex: boolean;
    pagesWithTables: number[];
    pagesWithColumns: number[];
  } | null;
  hasEncodingIssues: boolean | null;
  confidence: number | null;
  processingTimeMs: number;
  fieldCandidates: FieldCandidate[];
};

export async function parseDocumentFromStorage(
  env: CloudflareBindings,
  storageKey: string
): Promise<ParsedDocument | null> {
  const object = await env.DOCUMENTS_BUCKET.get(storageKey);
  if (!object) return null;
  if (!env.ANYDOC) return null;

  try {
    const response = await env.ANYDOC.fetch(
      new Request("http://anydoc/parse", {
        method: "POST",
        body: object.body,
        headers: {
          "x-internal-api-key": env.INTERNAL_API_KEY,
        },
      })
    );

    if (!response.ok) return null;

    const parsed = parseResultSchema.parse(await response.json());
    return {
      format: parsed.format,
      markdown: parsed.markdown ?? null,
      title: parsed.title ?? null,
      pageCount: parsed.pageCount,
      pdfType: parsed.pdfType ?? null,
      pagesNeedingOcr: parsed.pagesNeedingOcr ?? [],
      ocrReasonsByPage: parsed.ocrReasonsByPage ?? [],
      layout: parsed.layout ?? null,
      hasEncodingIssues: parsed.hasEncodingIssues ?? null,
      confidence: parsed.confidence ?? null,
      processingTimeMs: parsed.processingTimeMs ?? 0,
      fieldCandidates: parsed.fieldCandidates ?? [],
    };
  } catch {
    return null;
  }
}
