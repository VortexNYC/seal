import { z } from "zod";

/**
 * Heuristic contract-review annotations from parsed markdown.
 * Extend-style bbox citations without requiring an LLM round-trip.
 */

export const annotationCategorySchema = z.enum([
  "obligation",
  "payment",
  "risk",
  "dates",
  "terms",
]);

export const annotationSeveritySchema = z.enum([
  "informational",
  "important",
  "critical",
]);

export const annotationItemSchema = z.object({
  page: z.number().int(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  category: annotationCategorySchema,
  severity: annotationSeveritySchema,
  text: z.string(),
  summary: z.string(),
});

export type AnnotationItem = z.infer<typeof annotationItemSchema>;

const LINES_PER_PAGE = 50;

type Rule = {
  category: AnnotationItem["category"];
  severity: AnnotationItem["severity"];
  patterns: RegExp[];
  summary: string;
};

const RULES: Rule[] = [
  {
    category: "payment",
    severity: "important",
    patterns: [
      /\b(payment|fee|invoice|amount due|wire|ach|\$\d)/i,
      /\b(price|consideration|compensation)\b/i,
    ],
    summary: "Payment-related clause",
  },
  {
    category: "obligation",
    severity: "important",
    patterns: [
      /\b(shall|must|required to|agree(?:s|d)? to|obligat)/i,
      /\b(responsible for|duty to)\b/i,
    ],
    summary: "Obligation language",
  },
  {
    category: "risk",
    severity: "critical",
    patterns: [
      /\b(indemnif|liability|damages|penalty|default|breach|terminate)\b/i,
      /\b(warranty|disclaimer|as.?is)\b/i,
    ],
    summary: "Risk / liability language",
  },
  {
    category: "dates",
    severity: "informational",
    patterns: [
      /\b(effective date|expiration|deadline|term of|renewal)\b/i,
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/i,
    ],
    summary: "Date / term language",
  },
  {
    category: "terms",
    severity: "informational",
    patterns: [
      /\b(governing law|jurisdiction|confidential|non.?compete|assignment)\b/i,
      /\b(entire agreement|severability|force majeure)\b/i,
    ],
    summary: "Key commercial terms",
  },
];

function geometryForLine(line: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const height = 3.5;
  const y = Math.min(
    100 - height,
    Math.round((Math.max(0, line) / LINES_PER_PAGE) * 90 * 10) / 10
  );
  return { x: 8, y, width: 84, height };
}

function matchRule(line: string): Rule | null {
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(line))) {
      return rule;
    }
  }
  return null;
}

/**
 * Extract annotation items from anydoc-style page-marked markdown.
 */
export function extractAnnotationsFromMarkdown(
  markdown: string
): AnnotationItem[] {
  const items: AnnotationItem[] = [];
  const seen = new Set<string>();
  const parts = markdown.split(/<!--\s*Page\s+(\d+)\s*-->/);

  const consume = (page: number, content: string): void => {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? "";
      if (line.length < 12) continue;
      const rule = matchRule(line);
      if (!rule) continue;
      const key = `${page}:${rule.category}:${line.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        page,
        ...geometryForLine(i),
        category: rule.category,
        severity: rule.severity,
        text: line.slice(0, 500),
        summary: rule.summary,
      });
      if (items.length >= 40) return;
    }
  };

  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i += 2) {
      const page = Number(parts[i]);
      consume(Number.isFinite(page) ? page : 1, parts[i + 1] ?? "");
      if (items.length >= 40) break;
    }
  } else {
    consume(1, markdown);
  }

  return items;
}
