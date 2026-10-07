const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

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
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || day < 1 || day > 31) return value;
  return `${month} ${day}, ${match[1]}`;
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
