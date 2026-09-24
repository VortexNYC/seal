#!/usr/bin/env node
/**
 * Minimal Node example: upload → create → recipient → send via SealClient.
 *
 *   SEAL_API_KEY=seal_… node packages/sdk/examples/node-send.mjs
 *   SEAL_API_KEY=… SEAL_BASE_URL=https://api.seal.nyc node …
 *
 * Requires a built SDK (`pnpm --filter @vortex-api/seal run build`) or
 * install from npm: `pnpm add @vortex-api/seal`.
 */

import { createSealClient } from "../dist/index.js";

const apiKey = process.env.SEAL_API_KEY;
if (!apiKey) {
  console.error("SEAL_API_KEY is required");
  process.exit(1);
}

const client = createSealClient({
  apiKey,
  baseUrl: process.env.SEAL_BASE_URL ?? "https://api.seal.nyc",
});

const pdfBytes = new TextEncoder().encode(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
xref
0 4
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF`);

const uploaded = await client.upload(pdfBytes, {
  filename: "example.pdf",
  contentType: "application/pdf",
});
console.log("uploaded", uploaded.storage_id);

const doc = /** @type {{ id: string }} */ (
  await client.request("POST", "/api/v1/documents", {
    title: `SDK example ${new Date().toISOString()}`,
    storage_id: uploaded.storage_id,
    file_type: "application/pdf",
    page_count: 1,
  })
);
console.log("document", doc.id);

await client.request(
  "POST",
  `/api/v1/recipients?document_id=${encodeURIComponent(doc.id)}`,
  {
    email: process.env.SEAL_SIGNER ?? "example+signer@seal.nyc",
    name: "Example Signer",
    role: "signer",
  }
);

const sent = /** @type {{ recipients?: Array<{ signing_url?: string }> }} */ (
  await client.request(
    "POST",
    `/api/v1/documents/send?id=${encodeURIComponent(doc.id)}`,
    { id: doc.id }
  )
);
const signingUrl = sent.recipients?.[0]?.signing_url;
console.log("signing_url", signingUrl ?? "(missing)");
