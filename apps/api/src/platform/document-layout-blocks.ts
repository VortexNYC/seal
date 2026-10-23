import { z } from "zod";

import { extractAnnotationsFromMarkdown } from "./document-annotations.js";
import { fieldCandidateSchema } from "./anydoc.js";

export const layoutBlockTypeSchema = z.enum([
  "text",
  "table",
  "figure",
  "heading",
  "list",
  "other",
]);

export const layoutBlockSchema = z.object({
  id: z.string(),
  type: layoutBlockTypeSchema,
  page: z.number().int(),
  /** Normalized 0–1 page geometry */
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  text: z.string().optional(),
  confidence: z.number().optional(),
  source: z.enum(["anydoc", "annotation"]).optional(),
});

export type LayoutBlock = z.infer<typeof layoutBlockSchema>;

function candidateTypeToBlockType(
  type: string
): z.infer<typeof layoutBlockTypeSchema> {
  switch (type) {
    case "checkbox":
      return "list";
    case "signature":
    case "initials":
    case "name":
    case "date":
    case "text":
      return "text";
    default:
      return "other";
  }
}

/**
 * Build layout/OCR-style blocks from stored anydoc field candidates +
 * annotation heuristics over parsed markdown. Coordinates are 0–1.
 */
export function buildDocumentLayoutBlocks(args: {
  parsedText: string | null;
  fieldCandidatesJson: string | null;
}): LayoutBlock[] {
  const blocks: LayoutBlock[] = [];

  if (args.fieldCandidatesJson) {
    try {
      const raw = JSON.parse(args.fieldCandidatesJson) as unknown;
      const parsed = z.array(fieldCandidateSchema).safeParse(raw);
      if (parsed.success) {
        for (const [index, candidate] of parsed.data.entries()) {
          const page = candidate.page && candidate.page >= 1 ? candidate.page : 1;
          const x = candidate.x ?? 10;
          const y = candidate.y ?? 10;
          const width = candidate.width ?? 30;
          const height = candidate.height ?? 5;
          blocks.push({
            id: `anydoc-${page}-${index}`,
            type: candidateTypeToBlockType(candidate.type),
            page,
            x: x / 100,
            y: y / 100,
            width: width / 100,
            height: height / 100,
            text: candidate.label,
            confidence: candidate.confidence,
            source: "anydoc",
          });
        }
      }
    } catch {
      // ignore malformed candidates
    }
  }

  const annotations = extractAnnotationsFromMarkdown(args.parsedText ?? "");
  for (const [index, item] of annotations.entries()) {
    blocks.push({
      id: `annotation-${item.page}-${index}`,
      type:
        item.category === "dates" || item.category === "terms"
          ? "heading"
          : item.category === "payment"
            ? "table"
            : "text",
      page: item.page,
      x: item.x / 100,
      y: item.y / 100,
      width: item.width / 100,
      height: item.height / 100,
      text: item.text,
      confidence:
        item.severity === "critical"
          ? 0.95
          : item.severity === "important"
            ? 0.8
            : 0.6,
      source: "annotation",
    });
  }

  return blocks;
}
