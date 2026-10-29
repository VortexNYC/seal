import { Container } from "@cloudflare/containers";
import { verifyInternalApiKey } from "@seal/internal-auth";
import { Hono } from "hono";

const ALLOWED_INPUT_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/html",
]);

const FILE_EXTENSIONS: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/csv": ".csv",
  "text/html": ".html",
};

/**
 * text/html renders via Gotenberg's Chromium route (which requires the entry
 * file to be named index.html); office/CSV go through LibreOffice.
 */
const CHROMIUM_INPUT_TYPES = new Set(["text/html"]);

export class Converter extends Container {
  override defaultPort = 3000;
  override sleepAfter = "60s";
}

/** Poppler-tools container (image export, text extract, OCR, repair). */
export class PdfTools extends Container {
  override defaultPort = 8080;
  override sleepAfter = "60s";
}

type Bindings = {
  INTERNAL_API_KEY?: string;
  CONVERTER: DurableObjectNamespace<Converter>;
  PDF_TOOLS: DurableObjectNamespace<PdfTools>;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  if (c.req.path === "/health") {
    return next();
  }
  if (!verifyInternalApiKey(c)) {
    return c.text("unauthorized", 401);
  }
  return next();
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

/**
 * PDF-only optimize passthrough: re-encodes images to JPEG via Gotenberg's
 * pdfengines (qpdf/pdfcpu). Text, vectors, fonts, and structure are left
 * untouched; the engine never enlarges a file.
 */
app.post("/optimize-pdf", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return c.text("Expected multipart/form-data", 400);
  }

  const body = await c.req.parseBody();
  const file = body.files;
  if (!file || typeof file === "string") {
    return c.text("Missing files field", 400);
  }
  if (file.type !== "application/pdf") {
    return c.text(`Unsupported input type: ${file.type}`, 400);
  }

  const form = new FormData();
  form.append("files", file, "document.pdf");
  const quality = Number.parseInt(body.imageQuality?.toString() ?? "", 10);
  if (Number.isInteger(quality) && quality >= 1 && quality <= 100) {
    form.append("imageQuality", String(quality));
  }

  const containerRequest = new Request(
    "http://internal/forms/pdfengines/optimize",
    {
      method: "POST",
      body: form,
    }
  );

  const id = c.env.CONVERTER.idFromName("converter");
  const container = c.env.CONVERTER.get(id);
  const response = await container.fetch(containerRequest);

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  const pdf = await response.arrayBuffer();
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="optimized.pdf"',
    },
  });
});

/**
 * Encrypt a PDF via Gotenberg pdfengines /encrypt (qpdf — AES). Forwards
 * user/owner passwords and permission flags verbatim.
 */
app.post("/encrypt-pdf", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return c.text("Expected multipart/form-data", 400);
  }

  const body = await c.req.parseBody();
  const file = body.files;
  if (!file || typeof file === "string") {
    return c.text("Missing files field", 400);
  }
  if (file.type !== "application/pdf") {
    return c.text(`Unsupported input type: ${file.type}`, 400);
  }

  const form = new FormData();
  form.append("files", file, "document.pdf");
  for (const key of [
    "userPassword",
    "ownerPassword",
    "allowPrinting",
    "allowCopying",
    "allowModifying",
    "allowAnnotating",
    "allowFillingForms",
    "allowAssembling",
  ]) {
    const v = body[key];
    if (typeof v === "string" && v.length > 0) form.append(key, v);
  }

  const containerRequest = new Request(
    "http://internal/forms/pdfengines/encrypt",
    {
      method: "POST",
      body: form,
    }
  );

  const id = c.env.CONVERTER.idFromName("converter");
  const container = c.env.CONVERTER.get(id);
  const response = await container.fetch(containerRequest);

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  const pdf = await response.arrayBuffer();
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="encrypted.pdf"',
    },
  });
});

/**
 * Decrypt a password-protected PDF by re-exporting it through LibreOffice
 * (Gotenberg /forms/libreoffice/convert with the `password` open field).
 * Round-trip goes through LibreOffice Draw — mostly faithful but may shift
 * complex layouts; callers should surface that caveat.
 */
app.post("/decrypt-pdf", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return c.text("Expected multipart/form-data", 400);
  }

  const body = await c.req.parseBody();
  const file = body.files;
  if (!file || typeof file === "string") {
    return c.text("Missing files field", 400);
  }
  if (file.type !== "application/pdf") {
    return c.text(`Unsupported input type: ${file.type}`, 400);
  }
  const password = body.password;
  if (typeof password !== "string" || password.length === 0) {
    return c.text("Missing password field", 400);
  }

  const form = new FormData();
  form.append("files", file, "document.pdf");
  form.append("password", password);

  const containerRequest = new Request(
    "http://internal/forms/libreoffice/convert",
    {
      method: "POST",
      body: form,
    }
  );

  const id = c.env.CONVERTER.idFromName("converter");
  const container = c.env.CONVERTER.get(id);
  const response = await container.fetch(containerRequest);

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  const pdf = await response.arrayBuffer();
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="decrypted.pdf"',
    },
  });
});

/**
 * Flatten a PDF via Gotenberg pdfengines /flatten (pdfcpu/PDFtk): bakes
 * annotation and AcroForm appearance streams into page content.
 */
app.post("/flatten-pdf", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return c.text("Expected multipart/form-data", 400);
  }

  const body = await c.req.parseBody();
  const file = body.files;
  if (!file || typeof file === "string") {
    return c.text("Missing files field", 400);
  }
  if (file.type !== "application/pdf") {
    return c.text(`Unsupported input type: ${file.type}`, 400);
  }

  const form = new FormData();
  form.append("files", file, "document.pdf");

  const containerRequest = new Request(
    "http://internal/forms/pdfengines/flatten",
    {
      method: "POST",
      body: form,
    }
  );

  const id = c.env.CONVERTER.idFromName("converter");
  const container = c.env.CONVERTER.get(id);
  const response = await container.fetch(containerRequest);

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  const pdf = await response.arrayBuffer();
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="flattened.pdf"',
    },
  });
});

/**
 * Convert a PDF to PDF/A via Gotenberg pdfengines /convert.
 * Body: multipart with files field + `pdfa` form value (e.g. PDF/A-2b).
 */
app.post("/to-pdfa", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return c.text("Expected multipart/form-data", 400);
  }

  const body = await c.req.parseBody();
  const file = body.files;
  if (!file || typeof file === "string") {
    return c.text("Missing files field", 400);
  }
  if (file.type !== "application/pdf") {
    return c.text(`Unsupported input type: ${file.type}`, 400);
  }
  const pdfa = typeof body.pdfa === "string" ? body.pdfa : "PDF/A-2b";

  const form = new FormData();
  form.append("files", file, "document.pdf");
  form.append("pdfa", pdfa);

  const containerRequest = new Request(
    "http://internal/forms/pdfengines/convert",
    {
      method: "POST",
      body: form,
    }
  );

  const id = c.env.CONVERTER.idFromName("converter");
  const container = c.env.CONVERTER.get(id);
  const response = await container.fetch(containerRequest);

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  const pdf = await response.arrayBuffer();
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="pdfa.pdf"',
    },
  });
});

/**
 * Rasterise a PDF to per-page images via the pdf-tools container.
 * Query: format=png|jpeg (default png), dpi=50..600 (default 150).
 * Returns application/zip — one image per page.
 */
app.post("/pdf-to-images", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const body = await c.req.arrayBuffer();
  if (!contentType.startsWith("application/pdf")) {
    return c.text("Expected application/pdf body", 400);
  }
  const url = new URL(c.req.url);
  const format = url.searchParams.get("format") ?? "png";
  const dpi = url.searchParams.get("dpi") ?? "150";

  const id = c.env.PDF_TOOLS.idFromName("pdftools");
  const container = c.env.PDF_TOOLS.get(id);
  const response = await container.fetch(
    new Request(
      `http://internal/to-images?format=${encodeURIComponent(format)}&dpi=${encodeURIComponent(dpi)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
        },
        body,
      }
    )
  );

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="pages.zip"',
    },
  });
});

/**
 * Convert a PDF to an Office format via pdf-tools (headless LibreOffice).
 * Query: format=docx|xlsx|pptx (default docx). Returns the office file.
 */
app.post("/pdf-to-office", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const body = await c.req.arrayBuffer();
  if (!contentType.startsWith("application/pdf")) {
    return c.text("Expected application/pdf body", 400);
  }
  const url = new URL(c.req.url);
  const format = url.searchParams.get("format") ?? "docx";

  const id = c.env.PDF_TOOLS.idFromName("pdftools");
  const container = c.env.PDF_TOOLS.get(id);
  const response = await container.fetch(
    new Request(
      `http://internal/pdf-to-office?format=${encodeURIComponent(format)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body,
      }
    )
  );

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="converted.${format}"`,
    },
  });
});

/**
 * Tracked-changes .docx via pdf-tools — JSON {title, text, edits[]} in,
 * OOXML out (w:ins/w:del runs + <w:trackChanges/> settings). The
 * counter-proposal round-trip: Word opens it as pending redlines.
 */
app.post("/tracked-docx", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.startsWith("application/json")) {
    return c.text("Expected application/json body", 400);
  }
  const body = await c.req.arrayBuffer();
  const id = c.env.PDF_TOOLS.idFromName("pdftools");
  const container = c.env.PDF_TOOLS.get(id);
  const response = await container.fetch(
    new Request("http://container/tracked-docx", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-internal-api-key": c.env.INTERNAL_API_KEY ?? "",
      },
    })
  );
  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/octet-stream",
      "x-skipped-edits": response.headers.get("x-skipped-edits") ?? "0",
      "x-grafted": response.headers.get("x-grafted") ?? "0",
    },
  });
});

/**
 * Per-word geometry via pdf-tools (pdftotext -bbox). Returns JSON:
 * {words: [{page, x, y, w, h, t}]} with 0–1 normalized coordinates —
 * the citation-anchoring substrate.
 */
app.post("/pdf-to-words", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const body = await c.req.arrayBuffer();
  if (!contentType.startsWith("application/pdf")) {
    return c.text("Expected application/pdf body", 400);
  }

  const id = c.env.PDF_TOOLS.idFromName("pdftools");
  const container = c.env.PDF_TOOLS.get(id);
  const response = await container.fetch(
    new Request("http://internal/to-words", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body,
    })
  );

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  return new Response(await response.arrayBuffer(), {
    headers: { "Content-Type": "application/json" },
  });
});

/** Extract embedded text via pdf-tools (pdftotext -layout). */
app.post("/pdf-to-text", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const body = await c.req.arrayBuffer();
  if (!contentType.startsWith("application/pdf")) {
    return c.text("Expected application/pdf body", 400);
  }

  const id = c.env.PDF_TOOLS.idFromName("pdftools");
  const container = c.env.PDF_TOOLS.get(id);
  const response = await container.fetch(
    new Request("http://internal/to-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
      },
      body,
    })
  );

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  return new Response(await response.arrayBuffer(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
});

/**
 * OCR a PDF via pdf-tools ocrmypdf (--skip-text: only pages lacking a
 * text layer get OCR'd). Query: lang=eng (tesseract code, + joined).
 */
app.post("/ocr-pdf", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const body = await c.req.arrayBuffer();
  if (!contentType.startsWith("application/pdf")) {
    return c.text("Expected application/pdf body", 400);
  }
  const lang = new URL(c.req.url).searchParams.get("lang") ?? "eng";

  const id = c.env.PDF_TOOLS.idFromName("pdftools");
  const container = c.env.PDF_TOOLS.get(id);
  const response = await container.fetch(
    new Request(`http://internal/ocr?lang=${encodeURIComponent(lang)}`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body,
    })
  );

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="ocred.pdf"',
    },
  });
});

app.post("/convert", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return c.text("Expected multipart/form-data", 400);
  }

  const body = await c.req.parseBody();
  const file = body.files;

  if (!file || typeof file === "string") {
    return c.text("Missing files field", 400);
  }

  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    return c.text(`Unsupported input type: ${file.type}`, 400);
  }

  const viaChromium = CHROMIUM_INPUT_TYPES.has(file.type);
  const form = new FormData();
  form.append(
    "files",
    file,
    viaChromium ? "index.html" : `document${FILE_EXTENSIONS[file.type]}`
  );

  const containerRequest = new Request(
    viaChromium
      ? "http://internal/forms/chromium/convert/html"
      : "http://internal/forms/libreoffice/convert",
    {
      method: "POST",
      body: form,
    }
  );

  const id = c.env.CONVERTER.idFromName("converter");
  const container = c.env.CONVERTER.get(id);
  const response = await container.fetch(containerRequest);

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, { status: response.status });
  }

  const pdf = await response.arrayBuffer();

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="converted.pdf"',
    },
  });
});

export default app;
