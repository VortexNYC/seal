/**
 * Clamp a number between a minimum and maximum value.
 *
 * When `min` > `max`, the function returns `max` (consistent with
 * `Math.min(Math.max(n, min), max)`).
 */
export function clampNumber(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
