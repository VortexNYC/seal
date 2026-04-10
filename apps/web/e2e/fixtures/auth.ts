/* oxlint-disable react-hooks/rules-of-hooks */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test as base, type Page } from "@playwright/test";

import { ensureAuthenticatedWorkspaceHome, getTestWorkspaceConfig } from "./auth-helpers";
import { apiCreateDocument, apiDeleteDocument, ensurePdfStorageId } from "./convex-test-api";

type AuthFixtures = {
  authenticatedPage: Page;
  organizationSlug: string;
  /** Create a document via Convex API (~300ms) and return its ID and name. Auto-deletes after test. */
  createApiDocument: () => Promise<{ id: string; name: string }>;
};

/** Shared in-memory cache of the PDF storageId across all workers in a process */
let cachedStorageId: string | null = null;

async function getStorageId(): Promise<string> {
  if (cachedStorageId) return cachedStorageId;

  try {
    const { readFileSync } = await import("node:fs");
    const storageFile = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../playwright/.clerk/e2e-pdf-storage-id.txt",
    );
    cachedStorageId = readFileSync(storageFile, "utf8").trim() || null;
  } catch {
    cachedStorageId = null;
  }

  if (cachedStorageId) {
    return cachedStorageId;
  }

  const pdfPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "sample-document.pdf");
  cachedStorageId = await ensurePdfStorageId(pdfPath);
  return cachedStorageId;
}

/**
 * Extended test with authentication fixtures
 *
 * The setup project saves storageState with a valid Clerk session.
 * This fixture verifies we're authenticated and lands on the workspace home.
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await ensureAuthenticatedWorkspaceHome(page);
    await use(page);
  },

  createApiDocument: async ({ organizationSlug }, use) => {
    const created: Array<{ id: string }> = [];

    const factory = async () => {
      const storageId = await getStorageId();
      const { id, name } = await apiCreateDocument(organizationSlug, storageId);
      created.push({ id });
      return { id, name };
    };

    await use(factory);

    // Auto-cleanup all docs created during this test
    for (const { id } of created) {
      await apiDeleteDocument(id).catch(() => {});
    }
  },

  organizationSlug: async ({ authenticatedPage }, use) => {
    // Extract from URL first (most reliable when on /home)
    const url = authenticatedPage.url();
    const match = url.match(/\/([\w-]+)\/home/);

    if (match && match[1]) {
      await use(match[1]);
      return;
    }

    // Fallback: use the configured test workspace slug
    const config = getTestWorkspaceConfig();
    await use(config.organizationSlug);
  },
});

export async function signOut(page: Page): Promise<void> {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="sign-out-button"]');
  await page.waitForURL("**/sign-in", { timeout: 10000 });
}

export { expect } from "@playwright/test";
