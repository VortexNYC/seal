/**
 * Sequential polling helper for E2E flows that must re-check UI state until a
 * deadline. Each probe intentionally depends on the previous one settling, so
 * the repetition is expressed as recursion instead of an awaited loop.
 *
 * `step` returns a value to stop polling, or `undefined` to poll again.
 * Resolves to `undefined` when the deadline passes without a result.
 */
export async function pollUntil<T>(
  step: () => Promise<T | undefined>,
  options: { readonly deadline: number; readonly intervalMs: number }
): Promise<T | undefined> {
  const result = await step();
  if (result !== undefined) return result;
  if (Date.now() >= options.deadline) return undefined;
  await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  return pollUntil(step, options);
}
