/**
 * Returns `true` if the given number is a finite positive number (> 0).
 */
export function isPositive(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
