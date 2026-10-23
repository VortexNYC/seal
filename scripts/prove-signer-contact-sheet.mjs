#!/usr/bin/env node
/**
 * Guest-signer contact-sheet proof (SEA-74 / SEA-72).
 *
 * Mints a real envelope on the Seal API, then drives /sign/<token> with
 * agent-browser --contact-sheet so temporal paint bugs (blank PDF, signature
 * flash) show up as timestamped change frames — not identical before/after
 * screenshots (Chris Tate / agent-browser 0.38 Contact Sheets).
 *
 * Usage:
 *   SEAL_API_KEY=seal_… node scripts/prove-signer-contact-sheet.mjs
 *   SEAL_API_KEY=… node scripts/prove-signer-contact-sheet.mjs \
 *     --app http://127.0.0.1:5180 \
 *     --out /tmp/seal-signer-proof
 *
 * Requires: agent-browser >= 0.38 (record --contact-sheet), ffmpeg.
 * Exit 0 = paint evidence found (data-testid=pdf-signing-document or img in sheet/DOM).
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
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
const APP = flag(
  "app",
  process.env.SEAL_APP_URL ?? "https://app.seal.nyc"
).replace(/\/$/, "");
const OUT = flag("out", join(tmpdir(), `seal-signer-proof-${Date.now()}`));
const KEY = process.env.SEAL_API_KEY;
const SKIP_BROWSER = args.includes("--mint-only");

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
  const { code, stdout, stderr } = await run(process.execPath, [SEAL_BIN, ...argv], {
    env: { ...process.env, SEAL_API_KEY: KEY, SEAL_BASE_URL: API },
  });
  if (code !== 0) {
    throw new Error(stderr || stdout || `seal exit ${code}`);
  }
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`seal non-JSON: ${text.slice(0, 400)}`);
  }
}

/** Minimal valid PDF (one blank page). */
function minimalPdfBytes() {
  // Same minimal PDF as dogfood-cli (known uploadable).
  return Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 80>>stream
BT /F1 18 Tf 72 720 Td (Seal contact sheet proof) Tj ET
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

console.log(`=== Signer contact-sheet proof ===`);
console.log(`API  ${API}`);
console.log(`APP  ${APP}`);
console.log(`OUT  ${OUT}\n`);

const pdfPath = join(OUT, "proof.pdf");
await writeFile(pdfPath, minimalPdfBytes());

const uploaded = await sealJson(["upload", pdfPath]);
const storageId = uploaded?.storage_id;
if (!storageId) throw new Error(`upload failed: ${JSON.stringify(uploaded)}`);
console.log(`PASS  upload ${storageId}`);

const doc = await sealJson([
  "POST",
  "/api/v1/documents",
  await (async () => {
    const p = join(OUT, "doc.json");
    const stat = await import("node:fs/promises").then((m) => m.stat(pdfPath));
    await writeFile(
      p,
      JSON.stringify({
        title: `Contact sheet proof ${stamp}`,
        storage_id: storageId,
        file_type: "application/pdf",
        file_size: stat.size,
        page_count: 1,
      })
    );
    return p;
  })(),
]);
const docId = doc?.id;
if (!docId) throw new Error(`document create failed: ${JSON.stringify(doc)}`);
console.log(`PASS  document ${docId}`);

const recipient = await sealJson([
  "POST",
  `/api/v1/recipients?document_id=${encodeURIComponent(docId)}`,
  await (async () => {
    const p = join(OUT, "recipient.json");
    await writeFile(
      p,
      JSON.stringify({
        email: `proof+contact-sheet-${Date.now()}@seal.nyc`,
        name: "Contact Sheet Signer",
        role: "signer",
      })
    );
    return p;
  })(),
]);
const recipientId = recipient?.id ?? null;
console.log(`PASS  recipient ${recipientId ?? ""}`);

// Place a signature field so chrome progress is non-empty (SEA-78 widget).
try {
  await sealJson([
    "POST",
    "/api/v1/documents/fields",
    await (async () => {
      const p = join(OUT, "field.json");
      await writeFile(
        p,
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
      return p;
    })(),
  ]);
  console.log(`PASS  signature field`);
} catch (err) {
  console.log(
    `WARN  field create skipped — ${err instanceof Error ? err.message : String(err)}`
  );
}

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
let signingUrl =
  typeof first?.signing_url === "string" ? first.signing_url : null;
if (!token && signingUrl) {
  token = /\/sign\/([A-Za-z0-9_-]+)/.exec(signingUrl)?.[1] ?? null;
}
if (!token && typeof sent?.signing_url === "string") {
  signingUrl = sent.signing_url;
  token = /\/sign\/([A-Za-z0-9_-]+)/.exec(signingUrl)?.[1] ?? null;
}
if (!token) {
  throw new Error(`no signing token in send response: ${JSON.stringify(sent)}`);
}

// Rewrite host to --app so local web (PR branch) can be proved against prod API.
signingUrl = `${APP}/sign/${token}`;
await writeFile(join(OUT, "signing-url.txt"), `${signingUrl}\n`);
await writeFile(join(OUT, "token.txt"), `${token}\n`);
console.log(`PASS  send → ${signingUrl}`);

const pdfRes = await fetch(`${API}/api/public/signing/${token}/pdf`);
console.log(
  pdfRes.ok
    ? `PASS  public pdf HTTP ${pdfRes.status}`
    : `FAIL  public pdf HTTP ${pdfRes.status}`
);

if (SKIP_BROWSER) {
  console.log(`\nMint-only. Drive browser:\n  agent-browser open ${signingUrl}`);
  process.exit(pdfRes.ok ? 0 : 1);
}

const videoPath = join(OUT, "signer.webm");
const sheetGlob = join(OUT, "signer*.png");

async function ab(argv) {
  const { code, stdout, stderr } = await run("agent-browser", argv, {
    env: process.env,
  });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.log(stderr.trim());
  if (code !== 0) {
    throw new Error(`agent-browser ${argv.join(" ")} exit ${code}`);
  }
  // agent-browser prints interactive snapshots on stderr; merge both.
  return `${stdout}\n${stderr}`;
}

console.log("\n--- agent-browser contact sheet ---");
await ab(["--session", "seal-signer-proof", "open", signingUrl]);

// Pace like a human — capture temporal paint.
await new Promise((r) => setTimeout(r, 1200));

function parseA11yRef(line) {
  // Legacy: `[ref=e4]` / `[checked=false, ref=e8]`
  // agent-browser 0.38+: `[4] @e4 button "Start"`
  return (
    /(?:\[|, )\s*ref=(e\d+)/.exec(line)?.[1] ??
    /(?:^|\s)@(e\d+)\b/.exec(line)?.[1] ??
    null
  );
}

function lineHasRef(line) {
  return parseA11yRef(line) !== null;
}

function lineMatchesRole(line, role) {
  return (
    new RegExp(`role=${role}\\b`, "i").test(line) ||
    new RegExp(`^\\s*-\\s*${role}\\b`, "i").test(line) ||
    // agent-browser 0.38+: `button "Start"` / `[4] @e4 button "Start"`
    new RegExp(`(?:^|\\s)${role}\\b`, "i").test(line)
  );
}

async function clickMatching(snap, patterns, { role, skipDisabled } = {}) {
  for (const pattern of patterns) {
    const re = new RegExp(pattern, "i");
    const line = snap.split(/\r?\n/).find((l) => {
      if (!re.test(l) || !lineHasRef(l)) return false;
      if (skipDisabled && /\[disabled|\bdisabled\b/i.test(l)) return false;
      if (role && !lineMatchesRole(l, role)) return false;
      return true;
    });
    if (!line) continue;
    const ref = parseA11yRef(line);
    if (!ref) continue;
    console.log(`gate  click @${ref} ← ${line.trim().slice(0, 80)}`);
    await ab(["--session", "seal-signer-proof", "click", `@${ref}`]);
    await new Promise((r) => setTimeout(r, 900));
    return true;
  }
  return false;
}

async function ensureCheckboxThenContinue(snap) {
  // Prefer a11y checkbox ref; fall back to label ref.
  const uncheckedLine = snap
    .split(/\r?\n/)
    .find((l) => /checkbox/i.test(l) && /checked\s*=\s*false/i.test(l));
  let ref = uncheckedLine ? parseA11yRef(uncheckedLine) : null;
  if (!ref) {
    const label = snap
      .split(/\r?\n/)
      .find(
        (l) =>
          /LabelText|checkbox|Privacy notice|consent/i.test(l) &&
          /acknowledge this privacy notice|I consent to use electronic|Privacy notice/i.test(
            l
          )
      );
    ref = label ? parseA11yRef(label) : null;
  }
  if (ref) {
    console.log(`gate  check @${ref}`);
    try {
      await ab(["--session", "seal-signer-proof", "check", `@${ref}`]);
    } catch {
      await ab(["--session", "seal-signer-proof", "click", `@${ref}`]);
    }
    await new Promise((r) => setTimeout(r, 800));
  } else {
    console.log("gate  no checkbox/label ref");
  }
  const snap2 = await ab([
    "--session",
    "seal-signer-proof",
    "snapshot",
    "-i",
  ]);
  return clickMatching(
    snap2,
    [
      "Continue to Document",
      "Accept electronic signature consent",
      "\\bContinue\\b",
    ],
    { role: "button", skipDisabled: true }
  );
}

// Clear invite/privacy/consent BEFORE recording so the sheet captures paint,
// not gate clicks — and so snapshot -i keeps nested checkbox refs.
for (let gate = 0; gate < 8; gate++) {
  const snap = await ab([
    "--session",
    "seal-signer-proof",
    "snapshot",
    "-i",
  ]);
  if (
    /pdf-signing-document|data-engine|Decline to sign|All fields/i.test(snap)
  ) {
    break;
  }
  if (await clickMatching(snap, ["\\bStart\\b"], { role: "button" })) continue;
  if (/Privacy notice|Electronic Signature Consent|I consent to use electronic/i.test(snap)) {
    if (await ensureCheckboxThenContinue(snap)) continue;
  }
  if (
    await clickMatching(snap, ["\\bContinue\\b"], {
      role: "button",
      skipDisabled: true,
    })
  ) {
    continue;
  }
  break;
}

await ab([
  "--session",
  "seal-signer-proof",
  "record",
  "start",
  videoPath,
  "--cursor",
  "--contact-sheet",
  "--fps",
  "10",
]);


// Wait for PDF paint testid / img
let painted = false;
for (let i = 0; i < 12; i++) {
  try {
    const html = await ab([
      "--session",
      "seal-signer-proof",
      "get",
      "html",
      "body",
    ]);
    if (
      html.includes('data-testid="pdf-signing-document"') ||
      html.includes('data-engine="pdfium"') ||
      /data-page-number=/.test(html)
    ) {
      painted = true;
      console.log(`PASS  PDF surface in DOM (attempt ${i + 1})`);
      break;
    }
    if (html.includes('data-testid="pdf-signing-error"')) {
      console.log(`FAIL  PDF error surface visible`);
      break;
    }
  } catch {
    /* retry */
  }
  await new Promise((r) => setTimeout(r, 1000));
}

await ab([
  "--session",
  "seal-signer-proof",
  "screenshot",
  "--annotate",
  join(OUT, "final.png"),
]);
await ab(["--session", "seal-signer-proof", "record", "stop"]);
await ab(["--session", "seal-signer-proof", "close"]).catch(() => undefined);

// Locate contact sheet PNG written next to video
const { stdout: lsOut } = await run("bash", [
  "-lc",
  `ls -la ${JSON.stringify(OUT)}`,
]);
console.log(lsOut);

let sheetPath = null;
try {
  const { stdout } = await run("bash", [
    "-lc",
    `ls ${JSON.stringify(OUT)}/*contact* ${JSON.stringify(OUT)}/*.png 2>/dev/null | head -20`,
  ]);
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  sheetPath =
    lines.find((l) => /contact/i.test(l)) ??
    lines.find((l) => l.endsWith(".png")) ??
    null;
} catch {
  /* none */
}

await writeFile(
  join(OUT, "RESULT.md"),
  `# Signer contact-sheet proof

- signing_url: ${signingUrl}
- public_pdf_ok: ${pdfRes.ok}
- pdf_painted_in_dom: ${painted}
- video: ${videoPath}
- contact_sheet: ${sheetPath ?? "(see OUT dir)"}
- final_screenshot: ${join(OUT, "final.png")}

## How to read
Contact sheet frames with highlighted diffs show when the PDF raster (or error)
appeared. Identical before/after screenshots are not enough for SEA-74-class bugs.
`
);

console.log(`\n=== RESULT ===`);
console.log(`painted=${painted} out=${OUT}`);
if (!painted) {
  console.error(
    "FAIL: PDF surface never appeared in DOM. Inspect contact sheet + video."
  );
  process.exit(1);
}
console.log("PASS: PDF paint evidence captured.");
process.exit(0);
