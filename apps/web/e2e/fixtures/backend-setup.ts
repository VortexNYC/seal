import { type APIRequestContext } from "@playwright/test";

import { deleteDocument, listDocuments } from "./api-test-client";

const E2E_DOCUMENT_PREFIXES = [
  "e2e-test-doc-",
  "e2e-signable-doc-",
  "e2e-tpl-",
];

/**
 * Purge stale E2E documents created by previous runs.
 *
 * The Seal API does not expose a batched purge mutation, so we list documents
 * and delete any whose names match known E2E prefixes.
 */
export async function purgeE2eDocuments(
  request: APIRequestContext
): Promise<void> {
  try {
    const docs = await listDocuments(request, "all");
    const stale = docs.filter((doc) =>
      E2E_DOCUMENT_PREFIXES.some((prefix) => doc.name.startsWith(prefix))
    );

    if (stale.length === 0) {
      return;
    }

    let deleted = 0;
    await Promise.all(
      stale.map(async (doc) => {
        try {
          await deleteDocument(request, doc.publicId);
          deleted++;
        } catch (err) {
          console.warn(`[setup] Failed to delete ${doc.publicId}:`, err);
        }
      })
    );

    if (deleted > 0) {
      console.info(`[setup] Purged ${deleted} stale E2E document(s)`);
    }
  } catch (err) {
    console.warn("[setup] purgeE2eDocuments failed:", err);
  }
}

/**
 * No-op for the Cloudflare API path.
 *
 * The legacy backend used to seed a fake Pro subscription for the E2E
 * workspace. The Seal API currently derives limits from the organization
 * subscription record set up by the auth/app setup flows.
 */
export async function seedProSubscription(): Promise<void> {
  // Intentionally empty until the API exposes a test-only seed endpoint.
}

export async function prepareBackendState(
  request: APIRequestContext
): Promise<void> {
  await purgeE2eDocuments(request);
  await seedProSubscription();
}
