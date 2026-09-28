#!/usr/bin/env node
/**
 * SEA-72 — sealed final PDF pressure test.
 *
 * Mint → privacy/consent → typed submit → completed → download signed-pdf
 * and assert the bytes look like a Seal final artifact (PDF + optional
 * PAdES ETSI.CAdES.detached when platform seal secrets are configured).
 *
 * Usage:
 *   SEAL_API_KEY=seal_… node scripts/prove-sealed-pdf.mjs
 *   SEAL_API_KEY=… node scripts/prove-sealed-pdf.mjs --out /tmp/seal-sealed-proof
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const API = flag(
  "api",
  process.env.SEAL_BASE_URL ?? "https://api.seal.nyc"
).replace(/\/$/, "");
const OUT = flag("out", join(tmpdir(), `seal-sealed-proof-${Date.now()}`));
const KEY = process.env.SEAL_API_KEY;

if (!KEY) {
  console.error("SEAL_API_KEY is required (Bearer token, seal_…)");
  process.exit(1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEAL_BIN = join(ROOT, "packages/sdk/bin/seal.js");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

await mkdir(OUT, { recursive: true });

function run(cmd, argv, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, {
      ...opts,
      stdio: opts.stdio ?? ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (c) => {
      stdout += c;
    });
    child.stderr?.on("data", (c) => {
      stderr += c;
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", reject);
  });
}

async function sealJson(argv) {
  const { code, stdout, stderr } = await run(
    process.execPath,
    [SEAL_BIN, ...argv],
    {
      env: { ...process.env, SEAL_API_KEY: KEY, SEAL_BASE_URL: API },
    }
  );
  if (code !== 0) {
    throw new Error(`seal ${argv.join(" ")} failed: ${stderr || stdout}`);
  }
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error(`seal JSON parse failed: ${text.slice(0, 200)}`);
  }
}

function pdfHasEtsiCadesDetached(bytes) {
  return Buffer.from(bytes)
    .toString("latin1")
    .includes("/SubFilter /ETSI.CAdES.detached");
}

function pdfHasByteRange(bytes) {
  return /\/ByteRange\s*\[/.test(Buffer.from(bytes).toString("latin1"));
}

function minimalPdfBytes() {
  return Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 80>>stream
BT /F1 18 Tf 72 720 Td (Seal sealed PDF proof) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`);
}

console.log(`=== Sealed PDF proof ===`);
console.log(`API  ${API}`);
console.log(`OUT  ${OUT}\n`);

const pdfPath = join(OUT, "proof.pdf");
await writeFile(pdfPath, minimalPdfBytes());

const uploaded = await sealJson(["upload", pdfPath]);
const storageId = uploaded?.storage_id;
if (!storageId) throw new Error(`upload failed: ${JSON.stringify(uploaded)}`);
console.log(`PASS  upload ${storageId}`);

const docBody = join(OUT, "doc.json");
const pdfStat = await stat(pdfPath);
await writeFile(
  docBody,
  JSON.stringify({
    title: `Sealed PDF proof ${stamp}`,
    storage_id: storageId,
    file_type: "application/pdf",
    file_size: pdfStat.size,
    page_count: 1,
  })
);
const doc = await sealJson(["POST", "/api/v1/documents", docBody]);
const docId = doc?.id;
if (!docId) throw new Error(`document create failed: ${JSON.stringify(doc)}`);
console.log(`PASS  document ${docId}`);

const recipientBody = join(OUT, "recipient.json");
await writeFile(
  recipientBody,
  JSON.stringify({
    email: `proof+sealed-${Date.now()}@seal.nyc`,
    name: "Sealed Proof",
    role: "signer",
  })
);
const recipient = await sealJson([
  "POST",
  `/api/v1/recipients?document_id=${encodeURIComponent(docId)}`,
  recipientBody,
]);
const recipientId = recipient?.id ?? null;
console.log(`PASS  recipient ${recipientId ?? ""}`);

const fieldBody = join(OUT, "field.json");
await writeFile(
  fieldBody,
  JSON.stringify({
    id: docId,
    field_type: "signature",
    label: "Signature",
    page: 1,
    x: 10,
    y: 70,
    width: 30,
    height: 8,
    is_required: true,
    ...(recipientId ? { recipient_id: recipientId } : {}),
  })
);
await sealJson(["POST", "/api/v1/documents/fields", fieldBody]);
console.log("PASS  signature field");

const sent = await sealJson([
  "POST",
  `/api/v1/documents/send?id=${encodeURIComponent(docId)}`,
  await (async () => {
    const p = join(OUT, "send.json");
    await writeFile(p, JSON.stringify({ id: docId }));
    return p;
  })(),
]);
const first = sent?.recipients?.[0] ?? sent?.data?.recipients?.[0];
let token =
  (typeof first?.signing_token === "string" && first.signing_token) || null;
if (!token && typeof first?.signing_url === "string") {
  token = /\/sign\/([A-Za-z0-9_-]+)/.exec(first.signing_url)?.[1] ?? null;
}
if (!token && typeof sent?.signing_url === "string") {
  token = /\/sign\/([A-Za-z0-9_-]+)/.exec(sent.signing_url)?.[1] ?? null;
}
if (!token) throw new Error(`no signing token: ${JSON.stringify(sent)}`);
console.log(`PASS  send token=${token.slice(0, 12)}…`);

const ua = "seal-prove-sealed-pdf/1.0";
const ip = "203.0.113.77";

for (const path of ["privacy", "consent"]) {
  const res = await fetch(`${API}/api/public/signing/${token}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ipAddress: ip, userAgent: ua }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(`${path} failed: HTTP ${res.status} ${JSON.stringify(data)}`);
  }
  console.log(`PASS  ${path}`);
}

for (const submit of [
  { status: "viewed" },
  {
    status: "signed",
    signatureData: "Sealed Proof",
    signatureType: "type",
  },
]) {
  const res = await fetch(`${API}/api/public/signing/${token}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...submit, ipAddress: ip, userAgent: ua }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(
      `submit ${submit.status} failed: HTTP ${res.status} ${JSON.stringify(data)}`
    );
  }
  console.log(`PASS  submit ${submit.status}`);
}

const pdfRes = await fetch(`${API}/api/public/signing/${token}/signed-pdf`);
if (!pdfRes.ok) {
  throw new Error(`signed-pdf HTTP ${pdfRes.status}`);
}
const bytes = new Uint8Array(await pdfRes.arrayBuffer());
await writeFile(join(OUT, "signed.pdf"), bytes);
console.log(`PASS  signed-pdf ${bytes.byteLength} bytes`);

if (
  !(
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
) {
  throw new Error("signed-pdf is not a PDF");
}

const etsi = pdfHasEtsiCadesDetached(bytes);
const byteRange = pdfHasByteRange(bytes);
await writeFile(
  join(OUT, "result.json"),
  `${JSON.stringify({ etsi, byteRange, bytes: bytes.byteLength, token }, null, 2)}\n`
);

console.log(`\n=== RESULT ===`);
console.log(`etsi=${etsi} byteRange=${byteRange} out=${OUT}`);
if (etsi && byteRange) {
  console.log("PASS: PAdES-B markers present on completed download.");
  process.exit(0);
}
if (etsi || byteRange) {
  console.log(
    "WARN: partial seal markers — check platform PKCS#12 secrets on api."
  );
  process.exit(0);
}
console.log(
  "FAIL: completed download has no ETSI.CAdES.detached / ByteRange — flatten may have run without platform seal secrets, or final PDF was not served."
);
process.exit(2);
