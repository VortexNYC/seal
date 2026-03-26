/* oxlint-disable react-hooks/rules-of-hooks */
import { expect, test as base, type Page } from "@playwright/test";

import {
  isAuthenticatedUrl,
  signInTestUser,
  waitForClerkConvexToken,
} from "./auth-helpers";

type AuthFixtures = {
  authenticatedPage: Page;
  organizationSlug: string;
};

/**
 * Extended test with authentication fixtures
 *
 * Prefer the Playwright storage state created by the setup project.
 * If state is missing locally, fall back to the direct login helper/UI flow.
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Provides an authenticated page with a logged-in user
   */
  authenticatedPage: async ({ page }, use) => {
    await page.goto("/app", { waitUntil: "domcontentloaded" });

    if (!isAuthenticatedUrl(page.url())) {
      // signInTestUser handles sign-in + workspace setup per Clerk's protocol
      await signInTestUser(page);
    }

    const landedOnWorkspaceHome = await page
      .waitForURL(/\/[\w-]+\/home/, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (!landedOnWorkspaceHome) {
      await page.goto("/app", { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/[\w-]+\/home/, { timeout: 15000 });
    }

    await ensureAuthenticatedAppReady(page);

    await use(page);
  },

  /**
   * Provides the organization slug for the authenticated user
   */
  organizationSlug: async ({ authenticatedPage }, use) => {
    // Extract organization slug from URL
    const url = authenticatedPage.url();
    const match = url.match(/\/([\w-]+)\/home/);
    const slug = match ? match[1] : "test-org";

    await use(slug);
  },
});

/**
 * Helper to sign out
 */
export async function signOut(page: Page): Promise<void> {
  // Click user menu
  await page.click('[data-testid="user-menu"]');

  // Click sign out
  await page.click('[data-testid="sign-out-button"]');

  // Wait for redirect to login
  await page.waitForURL("**/sign-in", { timeout: 10000 });
}

async function ensureAuthenticatedAppReady(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await waitForClerkConvexToken(page);

    const hasAuthRouteError = await page
      .getByText(/authentication required/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (!hasAuthRouteError) {
      return;
    }

    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/[\w-]+\/home/, { timeout: 15000 });
  }

  await expect(page.getByText(/authentication required/i).first()).not.toBeVisible();
}

export { expect } from "@playwright/test";
