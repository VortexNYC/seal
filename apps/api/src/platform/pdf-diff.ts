/**
 * Text-level PDF diff: runs a Myers-style LCS over whole lines (pdftotext
 * -layout output split on form feeds, one segment per page). Produces a
 * per-page added/removed line list — honest text compare; visual/pixel
 * diff is out of scope for v1.
 */

export interface PageDiff {
  page: number;
  added: string[];
  removed: string[];
}

export interface PdfDiffResult {
  pagesDifferent: number;
  linesAdded: number;
  linesRemoved: number;
  pages: PageDiff[];
}

/** LCS dynamic programming over lines — O(n*m) but line-level: fine for docs. */
function diffLines(a: string[], b: string[]): { added: string[]; removed: string[] } {
  const n = a.length;
  const m = b.length;
  // LCS length table (n+1)x(m+1) — cap work for absurd inputs.
  if (n * m > 4_000_000) {
    // Fallback: treat as set-based whole-page replacement diff.
    const aSet = new Set(a);
    const bSet = new Set(b);
    return {
      added: b.filter((l) => l.trim() && !aSet.has(l)),
      removed: a.filter((l) => l.trim() && !bSet.has(l)),
    };
  }
  const dp: Uint32Array = new Uint32Array((n + 1) * (m + 1));
  const idx = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[idx(i, j)] =
        a[i] === b[j]
          ? dp[idx(i + 1, j + 1)]! + 1
          : Math.max(dp[idx(i + 1, j)]!, dp[idx(i, j + 1)]!);
    }
  }
  const added: string[] = [];
  const removed: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (dp[idx(i + 1, j)]! >= dp[idx(i, j + 1)]!) {
      if (a[i]!.trim()) removed.push(a[i]!);
      i++;
    } else {
      if (b[j]!.trim()) added.push(b[j]!);
      j++;
    }
  }
  while (i < n) {
    if (a[i]!.trim()) removed.push(a[i]!);
    i++;
  }
  while (j < m) {
    if (b[j]!.trim()) added.push(b[j]!);
    j++;
  }
  return { added, removed };
}

/** Split pdftotext -layout output into per-page line arrays. */
export function splitTextByPage(text: string): string[][] {
  return text.split("\f").map((p) => p.split("\n"));
}

export function diffPageTexts(
  aText: string,
  bText: string,
  maxPages = 200
): PdfDiffResult {
  const aPages = splitTextByPage(aText);
  const bPages = splitTextByPage(bText);
  const count = Math.min(Math.max(aPages.length, bPages.length), maxPages);
  const pages: PageDiff[] = [];
  let linesAdded = 0;
  let linesRemoved = 0;
  for (let p = 0; p < count; p++) {
    const { added, removed } = diffLines(aPages[p] ?? [], bPages[p] ?? []);
    if (added.length || removed.length) {
      linesAdded += added.length;
      linesRemoved += removed.length;
      pages.push({ page: p + 1, added, removed });
    }
  }
  return { pagesDifferent: pages.length, linesAdded, linesRemoved, pages };
}
