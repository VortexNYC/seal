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
};

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
    return {
      type: "checkbox",
      label: label || "Checkbox",
      page,
      line: lineIndex,
    };
  }

  const hasUnderscore = /_{3,}/.test(trimmed);
  const lower = trimmed.toLowerCase();

  if (
    lower.includes("signature") ||
    lower.includes("sign here") ||
    lower.includes("signed by") ||
    (lower.includes("sign") && hasUnderscore)
  ) {
    return {
      type: "signature",
      label: normalizeLabel(trimmed),
      page,
      line: lineIndex,
    };
  }

  if (lower.includes("initial") || lower.includes("initials")) {
    return {
      type: "initials",
      label: normalizeLabel(trimmed),
      page,
      line: lineIndex,
    };
  }

  if (
    (lower.includes("date") || lower.includes("dated")) &&
    (hasUnderscore ||
      lower.includes("mm/dd/yyyy") ||
      lower.includes("yyyy-mm-dd") ||
      lower.includes("dd/mm/yyyy"))
  ) {
    return {
      type: "date",
      label: normalizeLabel(trimmed),
      page,
      line: lineIndex,
    };
  }

  if (
    (lower.includes("print name") ||
      lower.includes("full name") ||
      lower.includes("name:") ||
      (lower.includes("name") && hasUnderscore)) &&
    !lower.includes("signature")
  ) {
    return {
      type: "name",
      label: normalizeLabel(trimmed),
      page,
      line: lineIndex,
    };
  }

  if (hasUnderscore) {
    return { type: "text", label: "Text field", page, line: lineIndex };
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
