/**
 * Clamp a number into the inclusive range [lo, hi].
 *
 * - Returns `NaN` if any argument is `NaN`.
 * - If `lo > hi`, the bounds are swapped so the interval is still valid.
 */
export function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n) || Number.isNaN(lo) || Number.isNaN(hi)) {
    return NaN;
  }

  let lower = lo;
  let upper = hi;

  if (lower > upper) {
    const tmp = lower;
    lower = upper;
    upper = tmp;
  }

  if (n < lower) {
    return lower;
  }

  if (n > upper) {
    return upper;
  }

  return n;
}
