/**
 * Expiration helpers for documents and recipients.
 */

export function expirationPeriodToMs(
  amount: number,
  unit: "day" | "week" | "month"
): number {
  const MS_PER_DAY = 86_400_000;
  switch (unit) {
    case "day":
      return amount * MS_PER_DAY;
    case "week":
      return amount * 7 * MS_PER_DAY;
    case "month":
      return amount * 30 * MS_PER_DAY;
    default: {
      const _exhaustive: never = unit;
      void _exhaustive;
      throw new Error("Unsupported expiration unit");
    }
  }
}
