/* oxlint-disable react-hooks/rules-of-hooks */
import { expect, test as base, type Page } from "@playwright/test";

import { getTestWorkspaceConfig, isAuthenticatedUrl, signInTestUser } from "./auth-helpers";
import { apiCreateDocument, apiDeleteDocument } from "./convex-test-api";

type AuthFixtures = {
  authenticatedPage: Page;
  organizationSlug: string;
  /** Create a document via Convex API (~300ms) and return its ID. Auto-deletes after test. */
  createApiDocument: (name?: string) => Promise<{ id: string; name: string }>;
};

/** Shared in-memory cache of the PDF storageId across all workers in a process */
let cachedStorageId: string | null = null;

async function getStorageId(): Promise<string | null> {
  if (cachedStorageId) return cachedStorageId;
  try {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const storageFile = resolve(
      fileURLToPath(import.meta.url),
      "../../../playwright/.clerk/e2e-pdf-storage-id.txt",
    );
    cachedStorageId = readFileSync(storageFile, "utf8").trim() || null;
    return cachedStorageId;
  } catch {
    return null;
  }
}

/**
 * Extended test with authentication fixtures
 *
 * The setup project saves storageState with a valid Clerk session.
 * This fixture verifies we're authenticated and lands on the workspace home.
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto("/app", { waitUntil: "domcontentloaded" });

    // Wait for redirect to resolve — could be /{slug}/home, sign-in, or onboarding
    await page.waitForURL(/\/([\w-]+\/home|[\w-]+\/onboarding|sign-in|app)/, {
      timeout: 8000,
      waitUntil: "domcontentloaded",
    });

    // If we didn't land on an authenticated route, re-authenticate
    if (!isAuthenticatedUrl(page.url())) {
      await signInTestUser(page);
    }

    // Ensure we're on /{slug}/home — if not, navigate there
    if (!page.url().match(/\/[\w-]+\/home/)) {
      await page.goto("/app", { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/[\w-]+\/home/, {
        timeout: 8000,
        waitUntil: "domcontentloaded",
      });
    }

    await use(page);
  },

  createApiDocument: async ({ organizationSlug }, use) => {
    const created: Array<{ id: string }> = [];
    const storageId = await getStorageId();

    const factory = async (name?: string) => {
      if (!storageId) throw new Error("PDF storageId not cached — check global.setup.ts ran");
      const docName = name ?? `e2e-test-doc-${Date.now()}`;
      const id = await apiCreateDocument(organizationSlug, storageId);
      created.push({ id });
      return { id, name: docName };
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
