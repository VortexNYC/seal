import path from "node:path";

import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrationsPath = path.join(import.meta.dirname ?? ".", "migrations");
const migrations = await readD1Migrations(migrationsPath);

const CONVERT_WORKER_MOCK = `
addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/pdf-to-text") {
    return new Response("line one\\nline two\\fsecond page\\n", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (request.method === "POST" && url.pathname === "/tracked-docx") {
    // Minimal zip placeholder — the test only asserts the artifact exists.
    const encoder = new TextEncoder();
    return new Response(encoder.encode("PK\\u0003\\u0004docx-placeholder"), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "x-skipped-edits": "0",
      },
    });
  }

  if (request.method === "POST" && url.pathname === "/pdf-to-words") {
    // Minimal word list covering a quote from the seeded fixture doc text.
    return new Response(
      JSON.stringify({
        words: [
          { page: 1, x: 0.1, y: 0.1, w: 0.05, h: 0.02, t: "Either" },
          { page: 1, x: 0.16, y: 0.1, w: 0.05, h: 0.02, t: "party" },
          { page: 1, x: 0.22, y: 0.1, w: 0.04, h: 0.02, t: "may" },
          { page: 1, x: 0.27, y: 0.1, w: 0.08, h: 0.02, t: "terminate" },
          { page: 1, x: 0.36, y: 0.1, w: 0.04, h: 0.02, t: "this" },
          { page: 1, x: 0.41, y: 0.1, w: 0.09, h: 0.02, t: "Agreement" },
          { page: 1, x: 0.51, y: 0.1, w: 0.03, h: 0.02, t: "on" },
          { page: 1, x: 0.55, y: 0.1, w: 0.05, h: 0.02, t: "thirty" },
          { page: 1, x: 0.61, y: 0.1, w: 0.05, h: 0.02, t: "days" },
          { page: 1, x: 0.67, y: 0.1, w: 0.05, h: 0.02, t: "written" },
          { page: 1, x: 0.73, y: 0.1, w: 0.05, h: 0.02, t: "notice." },
        ],
      }),
      { headers: { "content-type": "application/json" } }
    );
  }
  if (
    request.method === "POST" &&
    (url.pathname === "/convert" ||
      url.pathname === "/optimize-pdf" ||
      url.pathname === "/encrypt-pdf" ||
      url.pathname === "/decrypt-pdf" ||
      url.pathname === "/flatten-pdf" ||
      url.pathname === "/pdf-to-images" ||
      url.pathname === "/pdf-to-office" ||
      url.pathname === "/ocr-pdf" ||
      url.pathname === "/to-pdfa")
  ) {
    const pdf = "%PDF-1.4\\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\\nxref\\n0 4\\n0000000000 65535 f \\n0000000009 00000 n \\n0000000058 00000 n \\n0000000115 00000 n \\ntrailer<</Size 4/Root 1 0 R>>\\nstartxref\\n196\\n%%EOF";
    return new Response(pdf, {
      headers: { "content-type": "application/pdf" },
    });
  }
  return new Response("Not Found", { status: 404 });
}
`;

const ANYDOC_MOCK = `
addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/parse") {
    return new Response(JSON.stringify({
      format: "pdf",
      markdown: "test",
      title: null,
      pageCount: 1,
      pdfType: null,
      pagesNeedingOcr: [],
      ocrReasonsByPage: [],
      layout: null,
      hasEncodingIssues: null,
      confidence: null,
      processingTimeMs: 0,
      fieldCandidates: []
    }), {
      headers: { "content-type": "application/json" },
    });
  }
  return new Response("Not Found", { status: 404 });
}
`;

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      remoteBindings: false,
      miniflare: {
        compatibilityDate: "2026-07-30",
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          TEST_MIGRATIONS: migrations,
          BETTER_AUTH_SECRET: "test-better-auth-secret-do-not-use-in-prod",
          TOKEN_HASH_SECRET: "test-token-hash-secret-do-not-use-in-prod",
          BETTER_AUTH_URL: "http://localhost:8787",
          ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5173",
          EMAIL_FROM: "notifications@seal.nyc",
          APP_URL: "http://localhost:3000",
        },
        workers: [
          {
            name: "seal-convert-worker",
            script: CONVERT_WORKER_MOCK,
          },
          {
            name: "seal-anydoc-worker",
            script: ANYDOC_MOCK,
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
