/* oxlint-disable react-hooks/rules-of-hooks */
import { clerk } from "@clerk/testing/playwright";
import { expect, test as base, type Locator, type Page } from "@playwright/test";

import {
  ensureWorkspaceForAuthenticatedUser,
  getTestWorkspaceConfig,
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
      await performLogin(page);
    }

    const landedOnWorkspaceHome = await page
      .waitForURL(/\/[\w-]+\/home/, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (!landedOnWorkspaceHome) {
      await ensureWorkspaceForAuthenticatedUser(page);
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
 * Perform login using Clerk's official Playwright helper.
 * This avoids brittle UI-driven authentication and is much more stable under parallel load.
 */
async function performLogin(page: Page): Promise<void> {
  const { email: testEmail, emailCode: testEmailCode } = getTestWorkspaceConfig();

  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

  if (isAuthenticatedUrl(page.url())) {
    return;
  }

  const shouldUseClerkTesting = Boolean(
    process.env.CLERK_FAPI && (process.env.CLERK_SECRET_KEY || process.env.CLERK_TESTING_TOKEN),
  );

  if (shouldUseClerkTesting) {
    await clerk.loaded({ page });
    await clerk.signIn({
      page,
      signInParams: {
        strategy: "email_code",
        identifier: testEmail,
      },
    });
  } else {
    await waitForElementWithFallback(page, [
      page.getByRole("heading", { name: /sign in/i }),
      page.getByText(/sign in to seal/i),
      page.getByText(/sign in/i),
    ]);

    if (isAuthenticatedUrl(page.url())) {
      return;
    }

    await fillFieldWithFallback(page, testEmail);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await waitForElementWithFallback(page, [
      page.getByRole("heading", { name: /check your email/i }),
      page.getByText(/check your email/i),
      page.getByText(/verification code/i),
    ]);

    await page.waitForTimeout(500);
    await fillOtpCode(page, testEmailCode);
  }

  if (shouldUseClerkTesting) {
    await page.goto("/app", { waitUntil: "domcontentloaded" });
  }

  // Wait for redirect to authenticated area (or onboarding flow that still requires auth context)
  await page.waitForURL(/\/(app|.*\/home|.*\/onboarding\/choose-organization)/, {
    timeout: 30000,
  });
}

function isAuthenticatedUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return /\/(app|[\w-]+\/home|[\w-]+\/onboarding\/choose-organization)/.test(pathname);
  } catch {
    return false;
  }
}

async function fillFieldWithFallback(page: Page, value: string): Promise<void> {
  const candidates: Locator[] = [
    page.getByLabel(/email address/i),
    page.getByLabel(/email/i),
    page.getByRole("textbox", { name: /email/i }),
    page.locator('input[type="email"]'),
  ];

  for (const locator of candidates) {
    if ((await locator.count()) > 0) {
      await locator.first().fill(value);
      return;
    }
  }

  await page.locator("input").first().fill(value);
}

async function fillOtpCode(page: Page, code: string): Promise<void> {
  const singleInputs = page.locator('input[name="code"], input[autocomplete="one-time-code"]');
  const digitInputs = page.locator(
    '[data-testid="otp-input"], [data-testid="clerk-otp-code-input"]',
  );
  const roleInputs = page.getByRole("textbox", { name: /code/i });

  const singleCount = await singleInputs.count();
  if (singleCount > 0) {
    await singleInputs.first().fill(code);
    return;
  }

  const digitCount = await digitInputs.count();
  if (digitCount >= 2) {
    for (let index = 0; index < Math.min(digitCount, code.length); index++) {
      await digitInputs.nth(index).fill(code[index] ?? "");
    }
    return;
  }

  const roleCount = await roleInputs.count();
  if (roleCount > 0) {
    await roleInputs.first().fill(code);
    return;
  }

  await page.keyboard.type(code);
}

async function waitForElementWithFallback(page: Page, candidates: Locator[]): Promise<void> {
  const start = Date.now();
  const timeoutMs = 30000;

  while (Date.now() - start < timeoutMs) {
    if (isAuthenticatedUrl(page.url())) {
      return;
    }

    for (const locator of candidates) {
      if (
        await locator
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        return;
      }
    }
    await page.waitForTimeout(250);
  }

  if (isAuthenticatedUrl(page.url())) {
    return;
  }

  await expect(candidates[0]).toBeVisible({ timeout: 1000 });
}
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
