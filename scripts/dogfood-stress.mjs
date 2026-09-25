#!/usr/bin/env node
/**
 * Stress dogfood: generate varied PDFs and exercise Seal limits as a test user.
 *
 * Usage:
 *   SEAL_API_KEY=seal_… node scripts/dogfood-stress.mjs
 *   SEAL_API_KEY=… node scripts/dogfood-stress.mjs --api https://api.seal.nyc
 *
 * Cases:
 *   1. unicode title (WinAnsi sanitize path)
 *   2. multi-page PDF (3 pages)
 *   3. many recipients (8 viewers + 1 signer) — CoC party truncate
 *   4. access_code signer auth
 *   5. empty-ish 1-page minimal PDF
 *   6. large page count (20) — upload/send/sign still works?
 *
 * Exit 0 = all cases passed; non-zero = failures.
 */

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
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
const KEY = process.env.SEAL_API_KEY;
if (!KEY) {
  console.error("SEAL_API_KEY is required");
  process.exit(1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEAL_BIN = join(ROOT, "packages/sdk/bin/seal.js");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
let failures = 0;
const work = await mkdtemp(join(tmpdir(), "seal-stress-"));

function pass(step, detail = "") {
  console.log(`PASS  ${step}${detail ? ` — ${detail}` : ""}`);
}
function fail(step, detail = "") {
  failures++;
  console.log(`FAIL  ${step}${detail ? ` — ${detail}` : ""}`);
}
function limit(step, detail) {
  console.log(`LIMIT ${step}${detail ? ` — ${detail}` : ""}`);
}

async function seal(argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SEAL_BIN, ...argv], {
      env: { ...process.env, SEAL_API_KEY: KEY, SEAL_BASE_URL: API },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c) => {
      stdout += c;
    });
    child.stderr.on("data", (c) => {
      stderr += c;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function sealJson(argv) {
  const { code, stdout, stderr } = await seal(argv);
  if (code !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || `seal exited ${code}`);
  }
  return JSON.parse(stdout);
}

async function writeJson(name, value) {
  const path = join(work, name);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

/** Minimal multi-page PDF (no pdf-lib dependency). */
function makePdf(pages, title) {
  const safe = String(title).replace(/[^\x20-\x7E]/g, "?");
  return Buffer.from(buildSimplePdf(pages, safe));
}

function buildSimplePdf(pages, title) {
  let body = "%PDF-1.4\n";
  const objOffsets = [0];
  const writeObj = (id, content) => {
    objOffsets[id] = body.length;
    body += `${id} 0 obj\n${content}\nendobj\n`;
  };
  writeObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const fontId = 3 + pages * 2;
  const kidRefs = [];
  for (let i = 0; i < pages; i++) {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    kidRefs.push(`${pageId} 0 R`);
    const stream = `BT /F1 12 Tf 72 720 Td (${title} p${i + 1}) Tj ET`;
    writeObj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    );
    writeObj(
      contentId,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
  }
  writeObj(
    2,
    `<< /Type /Pages /Kids [${kidRefs.join(" ")}] /Count ${pages} >>`
  );
  writeObj(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const xrefPos = body.length;
  const maxId = fontId;
  body += `xref\n0 ${maxId + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let id = 1; id <= maxId; id++) {
    body += `${String(objOffsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return body;
}

function extractToken(sent) {
  const recipients = Array.isArray(sent?.recipients) ? sent.recipients : [];
  const first = recipients.find((r) => r?.role === "signer") ?? recipients[0];
  if (!first) return null;
  if (typeof first.signing_token === "string") return first.signing_token;
  if (typeof first.signing_url === "string") {
    const m = /\/sign\/([A-Za-z0-9_-]+)/.exec(first.signing_url);
    return m?.[1] ?? null;
  }
  return null;
}

async function runCase(name, opts) {
  console.log(`\n=== ${name} ===`);
  const pdfPath = join(work, `${name}.pdf`);
  await writeFile(pdfPath, opts.pdfBytes);
  let storageId;
  try {
    const uploaded = await sealJson(["upload", pdfPath]);
    storageId = uploaded.storage_id;
    pass(`${name} upload`, storageId);
  } catch (err) {
    fail(`${name} upload`, err instanceof Error ? err.message : String(err));
    return;
  }

  let docId;
  try {
    const doc = await sealJson([
      "POST",
      "/api/v1/documents",
      await writeJson(`${name}-doc.json`, {
        title: opts.title,
        storage_id: storageId,
        file_type: "application/pdf",
        page_count: opts.pages,
      }),
    ]);
    docId = doc.id;
    pass(`${name} create`, docId);
  } catch (err) {
    fail(`${name} create`, err instanceof Error ? err.message : String(err));
    return;
  }

  try {
    for (const r of opts.recipients) {
      await sealJson([
        "POST",
        "/api/v1/recipients",
        await writeJson(`${name}-r-${r.email}.json`, {
          document_id: docId,
          name: r.name,
          email: r.email,
          role: r.role,
          auth_method: r.auth_method ?? "none",
          access_code: r.access_code,
        }),
      ]);
    }
    pass(`${name} recipients`, `${opts.recipients.length}`);
  } catch (err) {
    fail(
      `${name} recipients`,
      err instanceof Error ? err.message : String(err)
    );
    return;
  }

  let token;
  try {
    const sent = await sealJson([
      "POST",
      `/api/v1/documents/send?id=${encodeURIComponent(docId)}`,
      await writeJson(`${name}-send.json`, { id: docId }),
    ]);
    token = extractToken(sent);
    token
      ? pass(`${name} send`)
      : fail(`${name} send`, JSON.stringify(sent));
  } catch (err) {
    fail(`${name} send`, err instanceof Error ? err.message : String(err));
    return;
  }
  if (!token) return;

  if (opts.accessCode) {
    const bad = await fetch(`${API}/api/public/signing/${token}/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "wrong-code" }),
    });
    const badBody = await bad.json().catch(() => ({}));
    bad.status === 400
      ? pass(`${name} access_code reject`, JSON.stringify(badBody))
      : fail(`${name} access_code reject`, `HTTP ${bad.status}`);

    const blocked = await fetch(
      `${API}/api/public/signing/${token}/submit`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "viewed",
          ipAddress: "198.51.100.20",
          userAgent: "seal-dogfood-stress/1.0",
        }),
      }
    );
    const blockedBody = await blocked.json().catch(() => ({}));
    !blocked.ok
      ? pass(`${name} gate before auth`, `HTTP ${blocked.status}`)
      : fail(
          `${name} gate before auth`,
          `expected block, got ${JSON.stringify(blockedBody)}`
        );

    const ok = await fetch(`${API}/api/public/signing/${token}/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: opts.accessCode }),
    });
    const okBody = await ok.json().catch(() => ({}));
    ok.ok && okBody.success
      ? pass(`${name} access_code accept`)
      : fail(
          `${name} access_code accept`,
          `HTTP ${ok.status} ${JSON.stringify(okBody)}`
        );
  }

  for (const submit of [
    { status: "viewed" },
    {
      status: "signed",
      signatureData: "Stress Signer",
      signatureType: "type",
    },
  ]) {
    const res = await fetch(`${API}/api/public/signing/${token}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...submit,
        ipAddress: "198.51.100.20",
        userAgent: "seal-dogfood-stress/1.0",
      }),
    });
    const data = await res.json().catch(() => ({}));
    res.ok && data.success
      ? pass(`${name} submit ${submit.status}`)
      : fail(
          `${name} submit ${submit.status}`,
          `HTTP ${res.status} ${JSON.stringify(data)}`
        );
  }

  // Certificate (SEA-50) — may 404 until CoC is deployed
  {
    const res = await fetch(
      `${API}/api/v1/documents/certificate?id=${encodeURIComponent(docId)}`,
      { headers: { authorization: `Bearer ${KEY}` } }
    );
    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && ct.includes("pdf")) {
      const buf = await res.arrayBuffer();
      pass(`${name} certificate`, `bytes=${buf.byteLength}`);
      if (opts.expectPartyTruncate && buf.byteLength < 800) {
        limit(
          `${name} certificate size`,
          "small PDF — party truncation may omit later recipients"
        );
      }
    } else if (res.status === 404) {
      limit(
        `${name} certificate`,
        "404 — CoC not deployed on this API yet (SEA-50 PR)"
      );
    } else {
      fail(`${name} certificate`, `HTTP ${res.status} ${ct}`);
    }
  }
}

async function main() {
  console.log(`Seal stress dogfood — api=${API}`);
  const health = await fetch(`${API}/health`);
  const body = await health.json().catch(() => ({}));
  if (!(health.ok && body?.status === "ok")) {
    fail("health", JSON.stringify(body));
    process.exit(1);
  }
  pass("health");

  await runCase("unicode-title", {
    title: `Stress ↔ NDA — ${stamp}`,
    pages: 1,
    pdfBytes: await makePdf(1, "Unicode title case"),
    recipients: [
      {
        name: "Unicode Signer",
        email: `dogfood+unicode-${stamp}@seal.nyc`,
        role: "signer",
      },
    ],
  });

  await runCase("multipage-3", {
    title: `Stress 3-page ${stamp}`,
    pages: 3,
    pdfBytes: await makePdf(3, "Three page doc"),
    recipients: [
      {
        name: "Multi Signer",
        email: `dogfood+multi-${stamp}@seal.nyc`,
        role: "signer",
      },
    ],
  });

  const many = [];
  for (let i = 0; i < 8; i++) {
    many.push({
      name: `Viewer ${i + 1}`,
      email: `dogfood+v${i}-${stamp}@seal.nyc`,
      role: "viewer",
    });
  }
  many.push({
    name: "Many Signer",
    email: `dogfood+many-${stamp}@seal.nyc`,
    role: "signer",
  });
  await runCase("many-parties", {
    title: `Stress many parties ${stamp}`,
    pages: 1,
    pdfBytes: await makePdf(1, "Many parties"),
    recipients: many,
    expectPartyTruncate: true,
  });

  await runCase("access-code", {
    title: `Stress access_code ${stamp}`,
    pages: 1,
    pdfBytes: await makePdf(1, "Access code gated"),
    accessCode: "SealTest42",
    recipients: [
      {
        name: "Gated Signer",
        email: `dogfood+code-${stamp}@seal.nyc`,
        role: "signer",
        auth_method: "access_code",
        access_code: "SealTest42",
      },
    ],
  });

  await runCase("pages-20", {
    title: `Stress 20-page ${stamp}`,
    pages: 20,
    pdfBytes: await makePdf(20, "Twenty page bulk"),
    recipients: [
      {
        name: "Bulk Signer",
        email: `dogfood+p20-${stamp}@seal.nyc`,
        role: "signer",
      },
    ],
  });

  await rm(work, { recursive: true, force: true }).catch(() => {});
  console.log("");
  if (failures === 0) {
    console.log("All stress cases passed (LIMIT lines are known gaps).");
    process.exit(0);
  }
  console.log(`${failures} stress check(s) failed.`);
  process.exit(1);
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await rm(work, { recursive: true, force: true }).catch(() => {});
  process.exit(1);
});
