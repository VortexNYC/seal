/**
 * Clamp a requested page number into the valid range for a paginated result set,
 * compute the corresponding offset, and return the total number of pages.
 *
 * @param page     Requested page number (1-indexed). Non-finite values are treated as 1.
 * @param pageSize Number of items per page. Must be a positive finite number.
 * @param total    Total number of items. Negative / non-finite values are treated as 0.
 *
 * @returns {{ page: number; offset: number; pages: number }}
 *
 * @throws {Error} When `pageSize` is not a positive finite number (<= 0 or NaN/Infinity).
 */
export function clampPage(
  page: number,
  pageSize: number,
  total: number,
): { page: number; offset: number; pages: number } {
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    throw new Error("pageSize must be a positive finite number");
  }

  const safePageSize = Math.trunc(pageSize);
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  const safePage = Number.isFinite(page) ? Math.trunc(page) : 1;

  const pages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const clampedPage = Math.max(1, Math.min(safePage, pages));
  const offset = (clampedPage - 1) * safePageSize;

  return { page: clampedPage, offset, pages };
}
