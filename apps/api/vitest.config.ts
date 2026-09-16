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
  if (request.method === "POST" && url.pathname === "/convert") {
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
