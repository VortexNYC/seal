/**
 * Round a number to a given number of decimal places.
 *
 * @param value - The number to round
 * @param decimals - Number of decimal places (default 0)
 * @returns The rounded number
 */
export function roundTo(value: number, decimals: number = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
