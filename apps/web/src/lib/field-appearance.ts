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

/** A short placed signature still has to be readable on the rule. */
export function signatureMarkFrame(
  field: { width: number; height: number },
  page: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const width = Math.min(
    Math.max(field.width, page.width * (168 / 612)),
    Math.max(24, page.width - 8)
  );
  const height = Math.min(
    Math.max(field.height, page.height * (36 / 792)),
    page.height * (52 / 792)
  );
  return { x: 0, y: field.height - height, width, height };
}

function checkboxChecked(value: string): boolean {
  if (value.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      return (
        Array.isArray(parsed) &&
        parsed.some((item) => typeof item === "string" && item.trim().length > 0)
      );
    } catch {
      return false;
    }
  }
  const v = value.toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on" || v === "checked";
}
