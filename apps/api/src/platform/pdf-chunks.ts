/**
 * Anchored text chunks for agent document reads — the geometry substrate
 * behind `preview?format=chunks`. Words (pdftotext -bbox, 0–1 coords) are
 * grouped per page into visual lines; each chunk carries its union bbox so
 * agents can reference {page, bbox} spans — e.g. to target a redline.
 */

import { pdfWords, type PdfWord } from "./quote-anchor.js";

export type PdfChunk = {
  page: number;
  bbox: { x: number; y: number; width: number; height: number };
  text: string;
};

/** Vertical drift allowed within one visual line (normalized units). */
const LINE_Y_EPS = 0.008;
/** Cap — enough for ~100 dense pages; beyond that callers get truncated. */
export const MAX_CHUNKS = 1500;

/**
 * Words arrive in reading order. A new line starts when the next word's y
 * drifts from the line's baseline (new row or wrap) — heading/body breaks
 * become chunk boundaries, which is the granularity agents quote against.
 */
export function chunkWords(words: PdfWord[]): PdfChunk[] {
  const chunks: PdfChunk[] = [];
  let run: PdfWord[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const text = run
      .map((w) => w.t)
      .join(" ")
      .trim();
    if (text.length === 0) {
      run = [];
      return;
    }
    const x1 = Math.min(...run.map((w) => w.x));
    const y1 = Math.min(...run.map((w) => w.y));
    const x2 = Math.max(...run.map((w) => w.x + w.w));
    const y2 = Math.max(...run.map((w) => w.y + w.h));
    const r = (n: number) => Math.round(n * 10_000) / 10_000;
    chunks.push({
      page: run[0]!.page,
      bbox: { x: r(x1), y: r(y1), width: r(x2 - x1), height: r(y2 - y1) },
      text,
    });
    run = [];
  };

  let prevY = -1;
  let prevPage = -1;
  for (const w of words) {
    const newLine =
      w.page !== prevPage || prevY === -1 || Math.abs(w.y - prevY) > LINE_Y_EPS;
    if (newLine) flush();
    run.push(w);
    prevY = w.y;
    prevPage = w.page;
    if (chunks.length >= MAX_CHUNKS) {
      flush();
      return chunks;
    }
  }
  flush();
  return chunks;
}

/** Load a document's PDF bytes from R2 → words → line chunks. */
export async function documentChunks(
  env: CloudflareBindings,
  storageKey: string
): Promise<PdfChunk[]> {
  const object = await env.DOCUMENTS_BUCKET.get(storageKey);
  if (!object) return [];
  const words = await pdfWords(env, await object.arrayBuffer());
  return chunkWords(words);
}
