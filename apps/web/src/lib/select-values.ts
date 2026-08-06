/**
 * Parse a Radix Select `onValueChange` string back into its literal union
 * instead of asserting it. Returns `null` when the value is not one of the
 * allowed options so callers can keep their current state.
 */
export function parseSelectValue<T extends string>(
  value: string,
  allowed: readonly T[]
): T | null {
  for (const option of allowed) {
    if (option === value) {
      return option;
    }
  }
  return null;
}
