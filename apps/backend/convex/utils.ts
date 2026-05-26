/** Pure utility helpers shared across Convex functions. */

/** Clamp a number to the 0–100 percentage range. */
export function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, n));
}
