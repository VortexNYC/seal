/* oxlint-disable react-hooks/rules-of-hooks */
import { expect, test as base, type Page } from "@playwright/test";

import { getTestWorkspaceConfig, isAuthenticatedUrl, signInTestUser } from "./auth-helpers";

type AuthFixtures = {
  authenticatedPage: Page;
  organizationSlug: string;
};

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
