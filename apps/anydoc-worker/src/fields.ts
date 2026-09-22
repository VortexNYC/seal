export type FieldType =
  | "signature"
  | "initials"
  | "date"
  | "name"
  | "checkbox"
  | "text";

export type FieldCandidate = {
  type: FieldType;
  label: string;
  page: number;
  line: number;
  /** Suggested page-percent geometry (0–100) for agent/human placement */
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};


const LINES_PER_PAGE = 50;
const LEFT_MARGIN = 10;

const DEFAULT_SIZE: Record<FieldType, { width: number; height: number }> = {
  signature: { width: 33, height: 6 },
  initials: { width: 10, height: 5 },
  date: { width: 23, height: 5 },
  name: { width: 30, height: 5 },
  checkbox: { width: 5, height: 4 },
  text: { width: 30, height: 5 },
};

function geometryFor(type: FieldType, line: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const size = DEFAULT_SIZE[type];
  const y = Math.min(
    100 - size.height,
    Math.round((Math.max(0, line) / LINES_PER_PAGE) * 90 * 10) / 10
  );
  return { x: LEFT_MARGIN, y, width: size.width, height: size.height };
}

function confidenceFor(type: FieldType): number {
  switch (type) {
    case "signature":
      return 0.85;
    case "date":
      return 0.8;
    case "checkbox":
      return 0.75;
    case "name":
    case "initials":
      return 0.7;
    default:
      return 0.55;
  }
}

function withGeometry(
  type: FieldType,
  label: string,
  page: number,
  line: number
): FieldCandidate {
  return {
    type,
    label,
    page,
    line,
    ...geometryFor(type, line),
    confidence: confidenceFor(type),
  };
}

const CHECKBOX_MARKERS = ["☐", "☑", "[ ]", "[x]", "[X]"] as const;

function normalizeLabel(line: string): string {
  return line
    .replaceAll("☐", "")
    .replaceAll("☑", "")
    .replaceAll("[ ]", "")
    .replaceAll("[x]", "")
    .replaceAll("[X]", "")
    .replaceAll("[", "")
    .replaceAll("]", "")
    .replaceAll("/", "")
    .replace(/_{3,}/g, "____")
    .trim();
}

function detectField(
  line: string,
  page: number,
  lineIndex: number
): FieldCandidate | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  const hasCheckbox = CHECKBOX_MARKERS.some((m) => trimmed.includes(m));
  if (hasCheckbox) {
    const label = normalizeLabel(trimmed);
    return withGeometry(
      "checkbox",
      label || "Checkbox",
      page,
      lineIndex
    );
  }

  const hasUnderscore = /_{3,}/.test(trimmed);
  const lower = trimmed.toLowerCase();

  if (
    lower.includes("signature") ||
    lower.includes("sign here") ||
    lower.includes("signed by") ||
    (lower.includes("sign") && hasUnderscore)
  ) {
    return withGeometry(
      "signature",
      normalizeLabel(trimmed),
      page,
      lineIndex
    );
  }

  if (lower.includes("initial") || lower.includes("initials")) {
    return withGeometry(
      "initials",
      normalizeLabel(trimmed),
      page,
      lineIndex
    );
  }

  if (
    (lower.includes("date") || lower.includes("dated")) &&
    (hasUnderscore ||
      lower.includes("mm/dd/yyyy") ||
      lower.includes("yyyy-mm-dd") ||
      lower.includes("dd/mm/yyyy"))
  ) {
    return withGeometry(
      "date",
      normalizeLabel(trimmed),
      page,
      lineIndex
    );
  }

  if (
    (lower.includes("print name") ||
      lower.includes("full name") ||
      lower.includes("name:") ||
      (lower.includes("name") && hasUnderscore)) &&
    !lower.includes("signature")
  ) {
    return withGeometry(
      "name",
      normalizeLabel(trimmed),
      page,
      lineIndex
    );
  }

  if (hasUnderscore) {
    return withGeometry("text", "Text field", page, lineIndex);
  }

  return null;
}

export function extractFieldCandidates(markdown: string): FieldCandidate[] {
  const candidates: FieldCandidate[] = [];
  const parts = markdown.split(/<!--\s*Page\s+(\d+)\s*-->/);

  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i += 2) {
      const page = Number(parts[i]);
      const content = parts[i + 1] ?? "";
      const lines = content.split("\n");
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (line === undefined) continue;
        const field = detectField(line, page, lineIndex);
        if (field) candidates.push(field);
      }
    }
  } else {
    const lines = markdown.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const field = detectField(line, 1, i);
      if (field) candidates.push(field);
    }
  }

  return candidates;
}
