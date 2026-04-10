import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Lightweight Convex HTTP API client for E2E test fixtures.
 * Calls mutations directly from Node.js — no browser needed.
 * Cuts document create/delete from ~15s (UI) to ~300ms.
 */

const CONVEX_URL = process.env.VITE_CONVEX_URL ?? "https://coordinated-lemur-768.convex.cloud";
const DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY ?? "";

const STORAGE_ID_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../playwright/.clerk/e2e-pdf-storage-id.txt",
);

async function convexMutation(path: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${DEPLOY_KEY}`,
    },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex mutation ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Upload the sample PDF to Convex storage once and cache the storageId.
 * Subsequent calls return the cached ID immediately.
 */
export async function ensurePdfStorageId(pdfPath: string): Promise<string> {
  // Return cached ID if already uploaded this run
  try {
    const cached = fs.readFileSync(STORAGE_ID_FILE, "utf8").trim();
    if (cached) return cached;
  } catch {
    // File doesn't exist yet — upload below
  }

  // Get an upload URL from Convex
  const uploadUrlRes = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${DEPLOY_KEY}`,
    },
    body: JSON.stringify({
      path: "test_e2e_helpers:generateUploadUrl",
      args: {},
      format: "json",
    }),
  });

  if (!uploadUrlRes.ok) throw new Error(`generateUploadUrl failed: ${uploadUrlRes.status}`);
  const uploadUrlData = (await uploadUrlRes.json()) as {
    status: string;
    value?: string | { uploadUrl?: string };
  };
  const uploadUrl =
    typeof uploadUrlData.value === "string" ? uploadUrlData.value : uploadUrlData.value?.uploadUrl;

  if (!uploadUrl) {
    throw new Error(`generateUploadUrl returned no upload URL: ${JSON.stringify(uploadUrlData)}`);
  }

  // Upload the PDF
  const pdfBytes = fs.readFileSync(pdfPath);
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: pdfBytes,
  });
  if (!uploadRes.ok) throw new Error(`PDF upload failed: ${uploadRes.status}`);
  const { storageId } = (await uploadRes.json()) as { storageId: string };

  // Cache for this test run
  fs.mkdirSync(path.dirname(STORAGE_ID_FILE), { recursive: true });
  fs.writeFileSync(STORAGE_ID_FILE, storageId, "utf8");

  return storageId;
}

/**
 * Create a test document directly via Convex mutation.
 * Returns both the document ID and the name that was stored in the DB.
 */
export async function apiCreateDocument(
  organizationSlug: string,
  storageId: string,
): Promise<{ id: string; name: string }> {
  const name = `e2e-test-doc-${Date.now()}`;
  const result = (await convexMutation("test_e2e_helpers:createTestDocument", {
    organizationSlug,
    storageId,
    name,
  })) as { status: string; value: { id: string } };
  return { id: result.value.id, name };
}

/**
 * Delete a test document directly via Convex mutation.
 */
export async function apiDeleteDocument(documentId: string): Promise<void> {
  await convexMutation("test_e2e_helpers:deleteTestDocument", { documentId });
}
