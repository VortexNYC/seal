/** What a filled field shows: the value, not a signature certificate. */
export function filledFieldText(
  fieldType: string,
  value: string | null | undefined
): string {
  const raw = (value ?? "").trim();
  const type = fieldType.toLowerCase();
  if (type === "checkbox") {
    return checkboxChecked(raw) ? "X" : "";
  }
  if (type === "date" || type === "date_signed") {
    return calendarLabel(raw);
  }
  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === "string")
          .join(", ");
      }
    } catch {
      return raw;
    }
  }
  return raw;
}

function calendarLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return value;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

/** Twelve characters of the document id, so the stamp fits on the rule. */
export function signatureStamp(documentRef: string): string {
  const compact = documentRef.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return compact.slice(0, 12);
}

/**
 * Tall marks lift "Signed by:" above the box. A short line keeps it at the
 * top of the box, on the ink, so the form label above the rule stays.
 */
export function signatureCaptionOffset(height: number): number {
  return height >= 24 ? -11 : 0;
}

/** Widen a short signature along the rule. Keep the placed height so the mark stays on the line. */
export function signatureMarkFrame(
  field: { width: number; height: number },
  page: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const width = Math.min(
    Math.max(field.width, page.width * (140 / 612)),
    Math.max(field.width, page.width - 8)
  );
  return { x: 0, y: 0, width, height: field.height };
}

function checkboxChecked(value: string): boolean {
  if (value.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      return (
        Array.isArray(parsed) &&
        parsed.some(
          (item) => typeof item === "string" && item.trim().length > 0
        )
      );
    } catch {
      return false;
    }
  }
  const v = value.toLowerCase();
  return (
    v === "true" || v === "1" || v === "yes" || v === "on" || v === "checked"
  );
}
