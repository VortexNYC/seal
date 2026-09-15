import {
  initSync as anydocSync,
  formatFromBytes,
  toMarkdownBytes,
  type Format,
} from "@firecrawl/anydoc-wasm";
import anydocWasm from "@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm";
import {
  initSync as pdfSync,
  processPdf,
  type PdfProcessResult,
} from "@firecrawl/pdf-inspector-wasm";
import pdfWasm from "@firecrawl/pdf-inspector-wasm/pdf_inspector_wasm_bg.wasm";
import { Hono } from "hono";

import { extractFieldCandidates, type FieldCandidate } from "./fields.js";

anydocSync({ module: anydocWasm });
pdfSync({ module: pdfWasm });

type ParseResponse = {
  format: string;
  markdown: string | null;
  title: string | null;
  pageCount: number | undefined;
  pdfType: PdfProcessResult["pdfType"] | null;
  pagesNeedingOcr: number[];
  ocrReasonsByPage: PdfProcessResult["ocrReasonsByPage"];
  layout: PdfProcessResult["layout"] | null;
  hasEncodingIssues: boolean | null;
  confidence: number | null;
  processingTimeMs: number;
  fieldCandidates: FieldCandidate[];
};

const app = new Hono();

app.get("/", (c) =>
  c.json({
    ok: true,
    name: "seal-anydoc-worker",
  })
);

app.post("/parse", async (c) => {
  const startedAt = Date.now();
  const bytes = new Uint8Array(await c.req.arrayBuffer());

  if (bytes.length === 0) {
    return c.json({ error: "empty body" }, 400);
  }

  try {
    const detected = formatFromBytes(bytes);

    if (detected === undefined) {
      return c.json({ error: "unsupported or unrecognized format" }, 400);
    }

    let response: ParseResponse;

    if (detected === "pdf") {
      const result: PdfProcessResult = processPdf(bytes, {
        includePageMarkers: true,
      });
      const markdown = result.markdown ?? "";

      response = {
        format: detected,
        markdown: result.markdown ?? null,
        title: result.title ?? null,
        pageCount: result.pageCount,
        pdfType: result.pdfType,
        pagesNeedingOcr: result.pagesNeedingOcr,
        ocrReasonsByPage: result.ocrReasonsByPage,
        layout: result.layout,
        hasEncodingIssues: result.hasEncodingIssues,
        confidence: result.confidence,
        processingTimeMs: Date.now() - startedAt,
        fieldCandidates: extractFieldCandidates(markdown),
      };
    } else {
      const markdown = toMarkdownBytes(bytes, detected as Format);

      response = {
        format: detected,
        markdown,
        title: null,
        pageCount: undefined,
        pdfType: null,
        pagesNeedingOcr: [],
        ocrReasonsByPage: [],
        layout: null,
        hasEncodingIssues: null,
        confidence: null,
        processingTimeMs: Date.now() - startedAt,
        fieldCandidates: extractFieldCandidates(markdown),
      };
    }

    return c.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

export default app;
