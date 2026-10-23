#!/usr/bin/env node
/**
 * Local identity dogfood: sender → two signers (OTP + account) → complete.
 * Emails go to miniflare EMAIL capture; OTP is scraped from HTML.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const API = process.env.SEAL_API_URL ?? "http://127.0.0.1:8787";
const APP = process.env.SEAL_APP_URL ?? "http://localhost:5180";
const PASSWORD = "SealDogfoodPass123!";
const SENDER = {
  email: "shlomo+seal-sender@vortex.nyc",
  name: "Seal Sender",
};
const SIGNERS = [
  {
    email: "shlomo+sealtestuser1@vortex.nyc",
    name: "Mark Test",
    password: PASSWORD,
  },
  {
    email: "shlomo+sealtestuser2@vortex.nyc",
    name: "Lenore Test",
    password: PASSWORD,
  },
];
const SLUG = `dogfood-${Date.now().toString(36)}`;

function cookieJar() {
  /** @type {Map<string, string>} */
  const jar = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() ?? [];
      for (const line of raw) {
        const [pair] = line.split(";");
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
      // Node < getSetCookie
      const single = res.headers.get("set-cookie");
      if (single && raw.length === 0) {
        for (const part of single.split(/,(?=\s*[^;]+=)/)) {
          const [pair] = part.trim().split(";");
          const eq = pair.indexOf("=");
          if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
        }
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    clear() {
      jar.clear();
    },
  };
}

async function api(jar, path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("origin")) {
    headers.set("origin", APP);
  }
  const cookie = jar.header();
  if (cookie) headers.set("cookie", cookie);
  const res = await fetch(`${API}${path}`, { ...init, headers });
  jar.store(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 400)}`
    );
  }
  return json;
}

function findEmailHtmlDirs() {
  const hits = new Set();
  const roots = [tmpdir()];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if (!name.startsWith("miniflare-")) continue;
      const emailHtml = join(root, name, "email", "email-html");
      if (existsSync(emailHtml)) hits.add(emailHtml);
    }
  }
  try {
    const out = execSync(
      'find /var/folders -type d -path "*miniflare*/email/email-html" 2>/dev/null | head -20',
      { encoding: "utf8" }
    );
    for (const line of out.split("\n")) {
      if (line.trim()) hits.add(line.trim());
    }
  } catch {
    /* no find hits */
  }
  return [...hits];
}

function latestOtpFor(email, sinceMs) {
  const dirs = findEmailHtmlDirs();
  /** @type {{mtime:number,code:string,file:string}[]} */
  const candidates = [];
  for (const dir of dirs) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".html")) continue;
      const full = join(dir, file);
      const st = statSync(full);
      if (st.mtimeMs < sinceMs - 1000) continue;
      const html = readFileSync(full, "utf8");
      if (!html.toLowerCase().includes(email.toLowerCase()) && !html.includes("Verification") && !html.includes("code")) {
        // still allow if it's an OTP template without address
      }
      const match = html.match(/\b(\d{6})\b/);
      if (match) {
        candidates.push({ mtime: st.mtimeMs, code: match[1], file: full });
      }
    }
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  if (candidates.length === 0) {
    throw new Error(`No OTP email found for ${email} after ${sinceMs}`);
  }
  return candidates[0];
}

function samplePdfBase64() {
  const path = new URL(
    "../apps/web/e2e/fixtures/sample-document.pdf",
    import.meta.url
  ).pathname;
  return readFileSync(path).toString("base64");
}

async function ensureUser(email, name, password) {
  const jar = cookieJar();
  try {
    await api(jar, "/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    console.log(`signed in ${email}`);
  } catch {
    await api(jar, "/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    console.log(`signed up ${email}`);
  }
  return jar;
}

async function main() {
  console.log("=== Seal identity dogfood ===");
  console.log({ API, APP, SLUG, SIGNERS: SIGNERS.map((s) => s.email) });

  const senderJar = await ensureUser(SENDER.email, SENDER.name, PASSWORD);

  // Create org
  await api(senderJar, "/api/auth/organization/create", {
    method: "POST",
    body: JSON.stringify({ name: "Dogfood Workspace", slug: SLUG }),
  });
  await api(senderJar, "/api/auth/organization/set-active", {
    method: "POST",
    body: JSON.stringify({ organizationSlug: SLUG }),
  });
  console.log(`org ${SLUG} active`);

  // Compliance on (explicit)
  await api(senderJar, `/api/organizations/${SLUG}/signing`, {
    method: "PATCH",
    body: JSON.stringify({
      requireRecipientAuth: true,
      requireSignerAccount: true,
      defaultRecipientAuthMethod: "email_otp",
      allowedSignatureTypes: ["draw", "type", "upload"],
      defaultDeadlineDays: 30,
    }),
  });
  console.log("signing compliance enabled");

  // Create document (metadata) then upload bytes
  const pdfB64 = samplePdfBase64();
  const pdfBytes = Buffer.from(pdfB64, "base64");
  const doc = await api(senderJar, `/api/documents/${SLUG}`, {
    method: "POST",
    body: JSON.stringify({
      name: `Dogfood Mark-Lenore ${new Date().toISOString()}`,
      fileSize: pdfBytes.byteLength,
      contentType: "application/pdf",
      pageCount: 1,
    }),
  });
  const publicId = doc.publicId ?? doc.id;
  if (!publicId) throw new Error(`no publicId: ${JSON.stringify(doc)}`);
  await api(senderJar, `/api/documents/${SLUG}/${publicId}/upload`, {
    method: "POST",
    body: JSON.stringify({
      contentBase64: pdfB64,
      contentType: "application/pdf",
    }),
  });
  console.log(`document ${publicId}`);

  // Recipients
  const recipients = await api(
    senderJar,
    `/api/documents/${SLUG}/${publicId}/recipients`,
    {
      method: "POST",
      body: JSON.stringify({
        recipients: SIGNERS.map((s, i) => ({
          email: s.email,
          name: s.name,
          role: "signer",
          order: i + 1,
          authMethod: "email_otp",
        })),
      }),
    }
  );
  console.log(
    "recipients",
    recipients.map((r) => ({
      email: r.email,
      token: r.signingToken?.slice(0, 8),
      publicId: r.publicId,
    }))
  );

  // Fields — one signature per recipient
  for (const [index, r] of recipients.entries()) {
    await api(
      senderJar,
      `/api/documents/${SLUG}/${publicId}/signature-fields`,
      {
        method: "POST",
        body: JSON.stringify({
          recipientPublicId: r.publicId,
          fieldType: "signature",
          label: "Signature",
          isRequired: true,
          x: 10 + index * 5,
          y: 20,
          width: 30,
          height: 12,
          page: 1,
        }),
      }
    );
  }
  console.log("signature fields placed");

  await api(senderJar, `/api/documents/${SLUG}/${publicId}/send`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  console.log("SENT");

  // Refresh recipients for tokens after send
  const afterSend = await api(
    senderJar,
    `/api/documents/${SLUG}/${publicId}/recipients`
  );

  for (const signer of SIGNERS) {
    const rec = afterSend.find(
      (r) => r.email.toLowerCase() === signer.email.toLowerCase()
    );
    if (!rec?.signingToken) {
      throw new Error(`missing token for ${signer.email}`);
    }
    const token = rec.signingToken;
    console.log(`\n--- ${signer.name} (${signer.email}) token=${token.slice(0, 10)}…`);

    // OTP challenge
    const since = Date.now();
    await api(cookieJar(), `/api/public/signing/${token}/auth/challenge`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    // allow email write
    await new Promise((r) => setTimeout(r, 800));
    let otp;
    try {
      otp = latestOtpFor(signer.email, since).code;
    } catch (err) {
      // fallback: scan all recent 6-digit codes
      const dirs = findEmailHtmlDirs();
      console.log("email dirs", dirs);
      throw err;
    }
    console.log(`OTP ${otp}`);

    await api(cookieJar(), `/api/public/signing/${token}/auth/verify`, {
      method: "POST",
      body: JSON.stringify({ code: otp }),
    });
    console.log("OTP verified");

    // Account for this email
    const signerJar = await ensureUser(signer.email, signer.name, signer.password);

    // Privacy + consent
    const tokenData = await api(
      signerJar,
      `/api/public/signing/${token}`
    );
    const consentText =
      tokenData.signingSettings?.esignConsentText ?? "consent";
    const privacyText =
      tokenData.signingSettings?.privacyNoticeText ?? "privacy";

    await api(signerJar, `/api/public/signing/${token}/privacy`, {
      method: "POST",
      body: JSON.stringify({
        noticeText: privacyText,
        noticeVersion:
          tokenData.signingSettings?.privacyNoticeVersion ?? "seal-privacy-1",
        ipAddress: "127.0.0.1",
        userAgent: "seal-dogfood/1.0",
      }),
    });
    await api(signerJar, `/api/public/signing/${token}/consent`, {
      method: "POST",
      body: JSON.stringify({
        consentText,
        consentVersion:
          tokenData.signingSettings?.esignConsentVersion ?? "seal-esign-1",
        ipAddress: "127.0.0.1",
        userAgent: "seal-dogfood/1.0",
      }),
    });
    console.log("privacy + consent ok");

    // Type signature into field
    const fieldsPayload = await api(
      signerJar,
      `/api/public/signing/${token}/fields`
    );
    const fieldList = Array.isArray(fieldsPayload)
      ? fieldsPayload
      : (fieldsPayload.fields ?? []);
    const sigField = fieldList.find(
      (f) => f.fieldType === "signature" || f.type === "signature"
    );
    if (!sigField) throw new Error(`no signature field for ${signer.email}`);
    const fieldId = sigField.publicId ?? sigField.id;
    await api(
      signerJar,
      `/api/public/signing/${token}/fields/${fieldId}/save`,
      {
        method: "POST",
        body: JSON.stringify({
          value: signer.name,
          signatureMethod: "type",
          ipAddress: "127.0.0.1",
          userAgent: "seal-dogfood/1.0",
        }),
      }
    );
    console.log(`field ${fieldId} filled`);

    await api(signerJar, `/api/public/signing/${token}/submit`, {
      method: "POST",
      body: JSON.stringify({
        status: "signed",
        signatureType: "type",
        signatureData: signer.name,
        ipAddress: "127.0.0.1",
        userAgent: "seal-dogfood/1.0",
      }),
    });
    console.log(`SIGNED ${signer.email}`);
    console.log(`UI link: ${APP}/sign/${token}`);
  }

  const finalDoc = await api(
    senderJar,
    `/api/documents/${SLUG}/${publicId}`
  );
  console.log("\n=== DONE ===");
  console.log({
    status: finalDoc.status ?? finalDoc.workflowStatus,
    publicId,
    org: SLUG,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
