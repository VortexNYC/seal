#!/usr/bin/env node
/**
 * Agent dogfood via the thin `seal` CLI (OpenAPI contract).
 *
 * Usage:
 *   SEAL_API_KEY=seal_… node scripts/dogfood-cli.mjs
 *   SEAL_API_KEY=… node scripts/dogfood-cli.mjs \
 *     --api https://seal-selfhost-api.<account>.workers.dev \
 *     --signer dogfood+signer@example.com
 *
 * Covers: health → folders → contact create/update → upload → document+folder_id
 * → recipients → send (signing_url) → imports create → breadcrumbs.
 *
 * Exit 0 = pass, 1 = failure.
 */

import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const API = flag("api", process.env.SEAL_BASE_URL ?? "https://api.seal.nyc").replace(
  /\/$/,
  ""
);
const SIGNER = flag("signer", "dogfood+signer@seal.nyc");
const KEY = process.env.SEAL_API_KEY;

if (!KEY) {
  console.error("SEAL_API_KEY is required (Bearer token, seal_…)");
  process.exit(1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEAL_BIN = join(ROOT, "packages/sdk/bin/seal.mjs");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
let failures = 0;
const work = await mkdtemp(join(tmpdir(), "seal-dogfood-"));

function pass(step, detail = "") {
  console.log(`PASS  ${step}${detail ? ` — ${detail}` : ""}`);
}
function fail(step, detail = "") {
  failures++;
  console.log(`FAIL  ${step}${detail ? ` — ${detail}` : ""}`);
}

async function seal(argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SEAL_BIN, ...argv], {
      env: {
        ...process.env,
        SEAL_API_KEY: KEY,
        SEAL_BASE_URL: API,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
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

async function main() {
  console.log(`Seal CLI dogfood — api=${API}`);

  // health (raw — not via seal CLI)
  {
    const res = await fetch(`${API}/health`);
    const body = await res.json().catch(() => ({}));
    if (res.ok && body?.status === "ok") {
      pass("health");
    } else {
      fail("health", `HTTP ${res.status} ${JSON.stringify(body)}`);
      return summary();
    }
  }

  let folderId;
  {
    try {
      const created = await sealJson([
        "POST",
        "/api/v1/folders",
        await writeJson("folder.json", {
          name: `Dogfood ${stamp}`,
          type: "document",
        }),
      ]);
      folderId = created.id;
      folderId ? pass("folders create", folderId) : fail("folders create");
    } catch (err) {
      fail("folders create", err instanceof Error ? err.message : String(err));
    }
  }
  if (!folderId) return summary();

  {
    try {
      const crumbs = await sealJson([
        "GET",
        `/api/v1/folders/breadcrumbs?id=${encodeURIComponent(folderId)}`,
      ]);
      Array.isArray(crumbs.breadcrumbs) && crumbs.breadcrumbs.length > 0
        ? pass("folders breadcrumbs", `${crumbs.breadcrumbs.length}`)
        : fail("folders breadcrumbs", JSON.stringify(crumbs));
    } catch (err) {
      fail(
        "folders breadcrumbs",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  let contactId;
  {
    try {
      const created = await sealJson([
        "POST",
        "/api/v1/contacts",
        await writeJson("contact.json", {
          first_name: "Dogfood",
          last_name: "Signer",
          email: SIGNER,
          company: "Seal Dogfood",
        }),
      ]);
      contactId = created.id;
      contactId ? pass("contacts create", contactId) : fail("contacts create");
    } catch (err) {
      fail("contacts create", err instanceof Error ? err.message : String(err));
    }
  }

  if (contactId) {
    try {
      const updated = await sealJson([
        "PUT",
        "/api/v1/contacts/update",
        await writeJson("contact-update.json", {
          id: contactId,
          title: "Signer",
          status: "active",
        }),
      ]);
      updated?.success
        ? pass("contacts update")
        : fail("contacts update", JSON.stringify(updated));
    } catch (err) {
      fail("contacts update", err instanceof Error ? err.message : String(err));
    }
  }

  let storageId;
  {
    const pdfPath = join(work, "dogfood.pdf");
    await writeFile(
      pdfPath,
      Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 80>>stream
BT /F1 18 Tf 72 720 Td (Seal CLI Dogfood) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`)
    );
    try {
      const uploaded = await sealJson(["upload", pdfPath]);
      storageId = uploaded.storage_id;
      storageId
        ? pass("seal upload", storageId)
        : fail("seal upload", JSON.stringify(uploaded));
    } catch (err) {
      fail("seal upload", err instanceof Error ? err.message : String(err));
    }
  }
  if (!storageId) return summary();

  let docId;
  {
    try {
      const doc = await sealJson([
        "POST",
        "/api/v1/documents",
        await writeJson("doc.json", {
          title: `CLI Dogfood ${stamp}`,
          storage_id: storageId,
          file_type: "application/pdf",
          page_count: 1,
          folder_id: folderId,
        }),
      ]);
      docId = doc.id;
      docId && doc.folder_id === folderId
        ? pass("documents create+folder", docId)
        : fail("documents create+folder", JSON.stringify(doc));
    } catch (err) {
      fail(
        "documents create+folder",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
  if (!docId) return summary();

  {
    try {
      const listed = await sealJson([
        "GET",
        `/api/v1/documents?folder_id=${encodeURIComponent(folderId)}`,
      ]);
      const hit = (listed.documents ?? []).some((d) => d.id === docId);
      hit
        ? pass("documents filter folder_id")
        : fail("documents filter folder_id", JSON.stringify(listed));
    } catch (err) {
      fail(
        "documents filter folder_id",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  {
    try {
      const recipient = await sealJson([
        "POST",
        `/api/v1/recipients?document_id=${encodeURIComponent(docId)}`,
        await writeJson("recipient.json", {
          email: SIGNER,
          name: "Dogfood Signer",
          role: "signer",
        }),
      ]);
      recipient?.id
        ? pass("recipients create", recipient.id)
        : fail("recipients create", JSON.stringify(recipient));
    } catch (err) {
      fail(
        "recipients create",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  {
    try {
      const sent = await sealJson([
        "POST",
        `/api/v1/documents/send?id=${encodeURIComponent(docId)}`,
        await writeJson("send.json", { id: docId }),
      ]);
      const url = sent?.recipients?.[0]?.signing_url;
      url
        ? pass("documents send", "signing_url present")
        : fail("documents send", JSON.stringify(sent));
      if (url && sent?.recipients?.[0]?.email_sent === true) {
        pass("documents send email_sent");
      }
    } catch (err) {
      fail("documents send", err instanceof Error ? err.message : String(err));
    }
  }

  {
    try {
      const job = await sealJson([
        "POST",
        "/api/v1/imports",
        await writeJson("import.json", { adapter: "pdf", payload: {} }),
      ]);
      job?.data?.id
        ? pass("imports create", job.data.id)
        : fail("imports create", JSON.stringify(job));
    } catch (err) {
      fail("imports create", err instanceof Error ? err.message : String(err));
    }
  }

  return summary();
}

async function summary() {
  await rm(work, { recursive: true, force: true }).catch(() => {});
  console.log("");
  if (failures === 0) {
    console.log("All dogfood checks passed.");
    process.exit(0);
  }
  console.log(`${failures} dogfood check(s) failed.`);
  process.exit(1);
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await rm(work, { recursive: true, force: true }).catch(() => {});
  process.exit(1);
});
