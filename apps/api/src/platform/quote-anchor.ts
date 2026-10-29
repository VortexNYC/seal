/**
 * Quote → page/bbox anchoring (legal-primitives §3): citations carry where
 * the quote lives in the document, not just the quote string.
 *
 * Mechanism: pdf-tools `pdftotext -bbox` gives per-word 0–1 page geometry.
 * The quote is normalized to a word-token sequence and slid across each
 * page's words; the best contiguous match's union bbox is the anchor.
 * Model quotes drift from `parsedText` (line wraps, smart quotes) — match
 * is on normalized tokens, never exact bytes.
 */

import { z } from "zod";

import { ConversionError } from "./document-conversion.js";

/**
 * R2 → pdf-tools → locate. Convenience wrapper for call sites that hold a
 * storageKey. Returns null when the document has no text layer (scans) or
 * the quote can't be located — callers still keep the quote-only citation.
 */
export async function anchorQuote(
  env: CloudflareBindings,
  storageKey: string,
  quote: string,
  wordsCache?: Map<string, Promise<PdfWord[]>>
): Promise<QuoteAnchor | null> {
  const loadWords = async () => {
    const object = await env.DOCUMENTS_BUCKET.get(storageKey);
    if (!object) return [] as PdfWord[];
    return pdfWords(env, await object.arrayBuffer());
  };
  let wordsPromise = wordsCache?.get(storageKey);
  if (!wordsPromise) {
    wordsPromise = loadWords();
    wordsCache?.set(storageKey, wordsPromise);
  }
  const words = await wordsPromise;
  if (words.length === 0) return null;
  return locateQuoteInWords(words, quote);
}

export type PdfWord = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  t: string;
};

export type QuoteAnchor = {
  page: number;
  bbox: { x: number; y: number; width: number; height: number };
};

const wordsResponseSchema = z.object({
  words: z.array(
    z.object({
      page: z.number().int(),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
      t: z.string(),
    })
  ),
});

const MAX_WORDS_PER_PAGE = 20_000;

/** Fetch per-word geometry for a PDF via the convert-worker → pdf-tools. */
export async function pdfWords(
  env: CloudflareBindings,
  bytes: ArrayBuffer | Uint8Array
): Promise<PdfWord[]> {
  if (!env.SEAL_CONVERT_WORKER) {
    throw new ConversionError(
      "converter_not_configured",
      503,
      "SEAL_CONVERT_WORKER service binding is not configured"
    );
  }

  const response = await env.SEAL_CONVERT_WORKER.fetch(
    new Request("http://internal/pdf-to-words", {
      method: "POST",
      body: new Uint8Array(bytes),
      headers: {
        "Content-Type": "application/pdf",
        "x-internal-api-key": env.INTERNAL_API_KEY,
      },
    })
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ConversionError(
      "pdf_words_failed",
      response.status === 504 ? 504 : 502,
      text
    );
  }

  const parsed = wordsResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ConversionError(
      "pdf_words_failed",
      502,
      "unexpected words payload"
    );
  }
  return parsed.data.words;
}

/** Normalize a token for matching: lowercase, strip non-alphanumeric edges. */
function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length > 0);
}

/** Union bbox over a word span. */
function unionBBox(words: PdfWord[]): QuoteAnchor["bbox"] {
  const x1 = Math.min(...words.map((w) => w.x));
  const y1 = Math.min(...words.map((w) => w.y));
  const x2 = Math.max(...words.map((w) => w.x + w.w));
  const y2 = Math.max(...words.map((w) => w.y + w.h));
  const r = (n: number) => Math.round(n * 10_000) / 10_000;
  return { x: r(x1), y: r(y1), width: r(x2 - x1), height: r(y2 - y1) };
}

/**
 * Locate a quote in the per-page word stream. Full sequence match wins;
 * otherwise the longest prefix run (>= 4 tokens) anchors. Returns null when
 * no page has a usable span — the citation stays quote-only.
 */
export function locateQuoteInWords(
  words: PdfWord[],
  quote: string
): QuoteAnchor | null {
  const needle = tokenize(quote);
  if (needle.length === 0) return null;

  // Group words by page in reading order.
  const byPage = new Map<number, PdfWord[]>();
  for (const w of words.slice(0, MAX_WORDS_PER_PAGE * 1000)) {
    const list = byPage.get(w.page);
    if (list) {
      list.push(w);
    } else {
      byPage.set(w.page, [w]);
    }
  }

  let best: { page: number; start: number; len: number } | null = null;

  for (const [page, pageWords] of byPage) {
    const tokens = pageWords.map((w) => normalizeToken(w.t));
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] !== needle[0]) continue;
      let matched = 0;
      while (
        i + matched < tokens.length &&
        matched < needle.length &&
        tokens[i + matched] === needle[matched]
      ) {
        matched++;
      }
      if (matched === needle.length) {
        const span = pageWords.slice(i, i + needle.length);
        return { page, bbox: unionBBox(span) };
      }
      if (matched >= 4 && (!best || matched > best.len)) {
        best = { page, start: i, len: matched };
      }
    }
  }

  if (best) {
    const pageWords = byPage.get(best.page) ?? [];
    const span = pageWords.slice(best.start, best.start + best.len);
    if (span.length > 0) {
      return { page: best.page, bbox: unionBBox(span) };
    }
  }
  return null;
}
