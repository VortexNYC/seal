/**
 * Format a numeric value for display.
 *
 * Supports:
 *  - Number formatting with locale-aware grouping and decimals
 *  - Percentage display
 *  - Currency display (dollar symbol by default)
 *  - Null / undefined handling with a fallback string
 */

export type FormatValueOptions = {
  /** Number of decimal places. Defaults to 0. */
  decimals?: number;
  /** When true, renders the value as a percentage (e.g. 0.12 → "12%"). */
  percentage?: boolean;
  /** When true, prefixes the formatted number with "$". */
  currency?: boolean;
  /** String shown when value is null or undefined. Defaults to "—". */
  fallback?: string;
  /** Optional locale string (e.g. "en-US"). Defaults to "en-US". */
  locale?: string;
};

/**
 * Format a numeric value for human-readable display.
 *
 * @example
 * formatValue(1234.5) // → "1,235"
 * formatValue(1234.5, { decimals: 2 }) // → "1,234.50"
 * formatValue(0.12, { percentage: true }) // → "12%"
 * formatValue(99.9, { currency: true, decimals: 2 }) // → "$99.90"
 * formatValue(null) // → "—"
 */
export function formatValue(
  value: number | null | undefined,
  options: FormatValueOptions = {},
): string {
  const {
    decimals = 0,
    percentage = false,
    currency = false,
    fallback = "—",
    locale = "en-US",
  } = options;

  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  let numericValue = value;

  if (percentage) {
    numericValue = value * 100;
  }

  const formatted = numericValue.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (percentage) {
    return `${formatted}%`;
  }

  if (currency) {
    return `$${formatted}`;
  }

  return formatted;
}
