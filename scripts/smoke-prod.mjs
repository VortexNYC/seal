#!/usr/bin/env node
/**
 * Production smoke test for the Seal API loop.
 *
 * Usage:
 *   SEAL_API_KEY=seal_... node scripts/smoke-prod.mjs
 *   SEAL_API_KEY=... node scripts/smoke-prod.mjs --api https://api.seal.nyc \
 *     --org seal-e2e-b --signer smoke+signer@example.com
 *
 * Covers: health → upload → document → recipient → send → audit.
 * Signing URL comes from the send response (recipients[].signing_url).
 * When present, also covers: public signing fetch → PDF bytes → viewed →
 * signed → completed → audit.
 *
 * Exit 0 = pass, 1 = failure. SKIP lines are known gaps, not failures.
 */

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const API = flag("api", "https://api.seal.nyc").replace(/\/$/, "");
const APP = flag("app", "https://app.seal.nyc").replace(/\/$/, "");
const ORG = flag("org", process.env.SEAL_ORG ?? "");
const SIGNER = flag("signer", "smoke+signer@seal.nyc");
const KEY = process.env.SEAL_API_KEY;

if (!KEY) {
  console.error("SEAL_API_KEY is required (Bearer token, seal_...)");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const DOC_TITLE = `Smoke Document ${stamp}`;
const PDF_BYTES = Buffer.from(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 88>>stream
BT /F1 18 Tf 72 720 Td (Seal Smoke Document) Tj 0 -30 Td (Sign here: ____________) Tj ET
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

let failures = 0;
let skips = 0;

function pass(step, detail = "") {
  console.log(`PASS  ${step}${detail ? ` — ${detail}` : ""}`);
}
function fail(step, detail = "") {
  failures++;
  console.log(`FAIL  ${step}${detail ? ` — ${detail}` : ""}`);
}
function skip(step, detail = "") {
  skips++;
  console.log(`SKIP  ${step}${detail ? ` — ${detail}` : ""}`);
}

async function api(path, { method = "GET", body, binary, auth = true } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(auth ? { authorization: `Bearer ${KEY}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...(binary ? { "content-type": binary } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

function pickArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const v of Object.values(data)) if (Array.isArray(v)) return v;
  }
  return [];
}

async function main() {
  console.log(`Seal smoke — api=${API} app=${APP} org=${ORG || "(unset)"}`);

  // 1. health
  {
    const res = await fetch(`${API}/health`);
    res.ok ? pass("health") : fail("health", `HTTP ${res.status}`);
  }

  // 2. generate upload URL (exercises MCP_SIGNING_KEY → upload token)
  let uploadUrl;
  {
    const { status, data } = await api("/api/v1/uploads/generate-url", {
      method: "POST",
      body: {},
    });
    uploadUrl = data?.upload_url;
    status === 200 && uploadUrl
      ? pass("uploads/generate-url")
      : fail("uploads/generate-url", `HTTP ${status} ${JSON.stringify(data)}`);
  }
  if (!uploadUrl) return summary();

  // 3. upload PDF bytes
  let storageId;
  {
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "content-type": "application/pdf" },
      body: PDF_BYTES,
    });
    const data = await res.json().catch(() => ({}));
    storageId = data.storageId ?? data.storage_id ?? data.id ?? data.key;
    res.ok && storageId
      ? pass("uploads upload", storageId)
      : fail("uploads upload", `HTTP ${res.status} ${JSON.stringify(data)}`);
  }
  if (!storageId) return summary();

  // 4. create document
  let docId;
  {
    const { status, data } = await api("/api/v1/documents", {
      method: "POST",
      body: {
        title: DOC_TITLE,
        storage_id: storageId,
        file_type: "application/pdf",
        page_count: 1,
      },
    });
    docId = data?.id;
    status < 300 && docId
      ? pass("documents create", docId)
      : fail("documents create", `HTTP ${status} ${JSON.stringify(data)}`);
  }
  if (!docId) return summary();

  // 5. add recipient
  let recipientId;
  {
    const { status, data } = await api(
      `/api/v1/recipients?document_id=${encodeURIComponent(docId)}`,
      {
        method: "POST",
        body: { email: SIGNER, name: "Smoke Signer", role: "signer" },
      }
    );
    recipientId = data?.id;
    status < 300 && recipientId
      ? pass("recipients create", recipientId)
      : fail("recipients create", `HTTP ${status} ${JSON.stringify(data)}`);
  }

  // 6. send (returns signing_url per recipient — preferred token source)
  let signingToken;
  {
    const { status, data } = await api(
      `/api/v1/documents/send?id=${encodeURIComponent(docId)}`,
      { method: "POST", body: { id: docId } }
    );
    status < 300
      ? pass("documents send")
      : fail("documents send", `HTTP ${status} ${JSON.stringify(data)}`);
    const sentRecipients = pickArray(data?.recipients ?? data);
    const sent =
      sentRecipients.find((r) => r?.id === recipientId) ?? sentRecipients[0];
    if (sent?.signing_url) {
      const m = /\/sign\/([A-Za-z0-9_-]+)/.exec(String(sent.signing_url));
      signingToken = m?.[1];
    }
    signingToken =
      signingToken ??
      sent?.signing_token ??
      sent?.signingToken ??
      sent?.sign_token;
  }

  // 7. document status
  let doc;
  {
    const { status, data } = await api(
      `/api/v1/documents?id=${encodeURIComponent(docId)}`
    );
    doc = data?.id ? data : pickArray(data).find((d) => d?.id === docId);
    status === 200 && doc && doc.status !== "draft"
      ? pass("document status", doc.status)
      : fail("document status", `HTTP ${status} ${JSON.stringify(data)}`);
  }

  // 8. signing token fallback via recipients list (send response is primary)
  if (!signingToken) {
    const { data } = await api(
      `/api/v1/recipients?document_id=${encodeURIComponent(docId)}`
    );
    const rec = pickArray(data).find((r) => r?.id === recipientId) ?? data;
    signingToken = rec?.signing_token ?? rec?.signingToken ?? rec?.sign_token;
    if (!signingToken && rec?.signing_url) {
      const m = /\/sign\/([A-Za-z0-9_-]+)/.exec(rec.signing_url);
      signingToken = m?.[1];
    }
  }
  if (signingToken) {
    pass("recipient signing token");
  } else {
    skip(
      "recipient signing token",
      "send + recipients list returned no signing_url — signing phase skipped"
    );
  }

  // 9-13. public signing phase (runs automatically once tokens exist)
  if (signingToken) {
    {
      const res = await fetch(`${API}/api/public/signing/${signingToken}`);
      res.ok
        ? pass("public signing page data")
        : fail("public signing page data", `HTTP ${res.status}`);
    }
    {
      // Regression: PDF must come from the API, not the SPA's index.html
      const res = await fetch(`${API}/api/public/signing/${signingToken}/pdf`);
      const ct = res.headers.get("content-type") ?? "";
      res.ok && ct.includes("pdf")
        ? pass("public signing pdf", ct)
        : fail("public signing pdf", `HTTP ${res.status} content-type=${ct}`);
    }
    {
      const res = await fetch(`${APP}/sign/${signingToken}`);
      const ct = res.headers.get("content-type") ?? "";
      res.ok && ct.includes("html")
        ? pass("app signing route serves SPA", ct)
        : fail("app signing route", `HTTP ${res.status} content-type=${ct}`);
    }
    for (const submit of [
      { status: "viewed" },
      {
        status: "signed",
        signatureData: "Smoke Test",
        signatureType: "type",
      },
    ]) {
      const res = await fetch(
        `${API}/api/public/signing/${signingToken}/submit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...submit,
            ipAddress: "203.0.113.10",
            userAgent: "seal-smoke/1.0",
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      res.ok && data.success
        ? pass(`public submit ${submit.status}`)
        : fail(
            `public submit ${submit.status}`,
            `HTTP ${res.status} ${JSON.stringify(data)}`
          );
    }
    {
      const { data } = await api(
        `/api/v1/documents?id=${encodeURIComponent(docId)}`
      );
      const after = data?.id
        ? data
        : pickArray(data).find((d) => d?.id === docId);
      after?.status === "completed"
        ? pass("document completed")
        : fail("document completed", `status=${after?.status}`);
    }
  }

  // 14. audit trail
  if (ORG) {
    const { status, data } = await api(
      `/api/v1/organizations/${encodeURIComponent(ORG)}/audit?limit=100`
    );
    const events = pickArray(data);
    const actions = new Set(events.map((e) => e?.action ?? e?.event_type));
    const expected = ["document.create", "recipient.added"];
    if (signingToken) expected.push("recipient.signed", "document.completed");
    const missing = expected.filter((a) => !actions.has(a));
    status === 200 && missing.length === 0
      ? pass("audit trail", [...actions].filter(Boolean).join(","))
      : fail("audit trail", `HTTP ${status} missing=${missing.join(",")}`);
  } else {
    skip("audit trail", "pass --org <slug> to verify the audit chain");
  }

  summary();
}

function summary() {
  console.log(`\n${failures} failure(s), ${skips} skip(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("smoke crashed:", err);
  process.exit(1);
});
