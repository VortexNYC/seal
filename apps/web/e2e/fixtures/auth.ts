/* oxlint-disable react-hooks/rules-of-hooks */
import { expect, test as base, type Locator, type Page } from "@playwright/test";

type AuthFixtures = {
  authenticatedPage: Page;
  organizationSlug: string;
};

/**
 * Extended test with authentication fixtures
 *
 * Note: Clerk uses short-lived JWTs (60s), so we perform fresh login for each test
 * to ensure reliable authentication. The login flow is quick with Clerk test mode.
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Provides an authenticated page with a logged-in user
   */
  authenticatedPage: async ({ page }, use) => {
    // Always perform fresh login (Clerk JWTs are short-lived)
    await performLogin(page);

    // Wait for redirect to org-specific URL
    // The app redirects: sign-in -> /app -> /{org-slug}/home
    await page.waitForURL(/\/[\w-]+\/home/, { timeout: 15000 });

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
 * Perform login using Clerk with email code verification
 */
async function performLogin(page: Page): Promise<void> {
  const testEmail =
    process.env.E2E_TEST_USER_EMAIL ||
    process.env.TEST_USER_EMAIL ||
    "sealtest001+clerk_test@example.com";
  const testEmailCode =
    process.env.E2E_TEST_EMAIL_CODE || process.env.TEST_EMAIL_CODE || "424242";

  // Navigate directly to sign-in page
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

  if (isAuthenticatedUrl(page.url())) {
    return;
  }

  // Wait for Clerk sign-in component
  await waitForElementWithFallback(page, [
    page.getByRole("heading", { name: /sign in/i }),
    page.getByText(/sign in to seal/i),
    page.getByText(/sign in/i),
  ]);

  if (isAuthenticatedUrl(page.url())) {
    return;
  }

  // Fill in email
  await fillFieldWithFallback(page, testEmail);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Wait for OTP code screen
  await waitForElementWithFallback(page, [
    page.getByRole("heading", { name: /check your email/i }),
    page.getByText(/check your email/i),
    page.getByText(/verification code/i),
  ]);

  // Wait a moment for Clerk OTP to initialize
  await page.waitForTimeout(500);

  // Type the OTP code directly (Clerk test mode accepts 424242 for +clerk_test emails)
  await fillOtpCode(page, testEmailCode);

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
    if (await locator.count() > 0) {
      await locator.first().fill(value);
      return;
    }
  }

  await page.locator('input').first().fill(value);
}

async function fillOtpCode(page: Page, code: string): Promise<void> {
  const singleInputs = page.locator('input[name="code"], input[autocomplete="one-time-code"]');
  const digitInputs = page.locator('[data-testid="otp-input"], [data-testid="clerk-otp-code-input"]');
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
      if (await locator.first().isVisible()) {
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

export { expect } from "@playwright/test";
