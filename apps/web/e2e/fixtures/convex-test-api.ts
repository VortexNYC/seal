import fs from "node:fs";
import path from "node:path";

import { pdfStorageIdPath } from "./paths";

/**
 * Lightweight Convex HTTP API client for E2E test fixtures.
 * Calls mutations directly from Node.js — no browser needed.
 * Cuts document create/delete from ~15s (UI) to ~300ms.
 */

const CONVEX_URL = process.env.VITE_CONVEX_URL ?? "https://coordinated-lemur-768.convex.cloud";
const DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY ?? "";

function getConvexDeploymentName(convexUrl: string): string {
  try {
    return new URL(convexUrl).hostname.split(".")[0] ?? convexUrl;
  } catch {
    return convexUrl;
  }
}

function getConvexAuthHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Convex ${DEPLOY_KEY}`,
  };
}

const STORAGE_ID_FILE = pdfStorageIdPath;

export async function convexMutation(
  path: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: getConvexAuthHeaders(),
    body: JSON.stringify({ path, args, format: "json" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex mutation ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function convexQuery(path: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: getConvexAuthHeaders(),
    body: JSON.stringify({ path, args, format: "json" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex query ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export function describeConvexE2eTarget(): { deploymentName: string; convexUrl: string } {
  return {
    deploymentName: getConvexDeploymentName(CONVEX_URL),
    convexUrl: CONVEX_URL,
  };
}

export async function assertConvexE2eHelperAvailability(): Promise<void> {
  if (!DEPLOY_KEY) {
    throw new Error(
      `CONVEX_DEPLOY_KEY is missing for Web E2E preflight. Convex deployment: ${getConvexDeploymentName(CONVEX_URL)} (${CONVEX_URL})`,
    );
  }

  const response = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: getConvexAuthHeaders(),
    body: JSON.stringify({
      path: "test_e2e_helpers:generateUploadUrl",
      args: {},
      format: "json",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Convex E2E helper preflight failed for ${getConvexDeploymentName(CONVEX_URL)} (${CONVEX_URL}) with HTTP ${response.status}: ${text}`,
    );
  }

  const data = (await response.json()) as {
    status: string;
    value?: string | { uploadUrl?: string };
    errorMessage?: string;
  };
  const uploadUrl = typeof data.value === "string" ? data.value : data.value?.uploadUrl;

  if (!uploadUrl) {
    throw new Error(
      `Convex E2E helper preflight failed for ${getConvexDeploymentName(CONVEX_URL)} (${CONVEX_URL}). Response: ${JSON.stringify(data)}`,
    );
  }
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
    headers: getConvexAuthHeaders(),
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
    throw new Error(
      `generateUploadUrl returned no upload URL for ${getConvexDeploymentName(CONVEX_URL)} (${CONVEX_URL}): ${JSON.stringify(uploadUrlData)}`,
    );
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
