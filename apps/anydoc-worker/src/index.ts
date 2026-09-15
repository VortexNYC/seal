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

anydocSync({ module: anydocWasm });
pdfSync({ module: pdfWasm });

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

    if (detected === "pdf") {
      const result: PdfProcessResult = processPdf(bytes);
      const processingTimeMs = Date.now() - startedAt;

      return c.json({
        format: detected,
        markdown: result.markdown ?? null,
        pdfType: result.pdfType,
        pageCount: result.pageCount,
        pagesNeedingOcr: result.pagesNeedingOcr,
        ocrReasonsByPage: result.ocrReasonsByPage,
        processingTimeMs,
      });
    }

    const markdown = toMarkdownBytes(bytes, detected as Format);
    const processingTimeMs = Date.now() - startedAt;

    return c.json({
      format: detected,
      markdown,
      processingTimeMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

export default app;
