import { mkdir } from "node:fs/promises";
import path from "node:path";

/* oxlint-disable react-hooks/rules-of-hooks */
import { expect, test as base, type Locator, type Page } from "@playwright/test";

type AuthFixtures = {
  authenticatedPage: Page;
  organizationSlug: string;
};

type WorkerFixtures = {
  authSession: {
    organizationSlug: string;
    storageStatePath: string;
  };
};

/**
 * Extended test with authentication fixtures
 *
 * Log in once per worker, then give each test its own isolated browser context
 * seeded from that authenticated storage state. This keeps tests isolated while
 * avoiding dozens of repeated OTP sign-ins that can throttle CI.
 */
export const test = base.extend<AuthFixtures, WorkerFixtures>({
  authSession: [
    async ({ browser }, use, testInfo) => {
      const baseURL =
        typeof testInfo.project.use.baseURL === "string" ? testInfo.project.use.baseURL : undefined;

      if (!baseURL) {
        throw new Error("Playwright baseURL is required for the authenticated worker session.");
      }

      const authDir = path.join(testInfo.project.outputDir, ".auth");
      const storageStatePath = path.join(authDir, `worker-${testInfo.workerIndex}.json`);

      await mkdir(authDir, { recursive: true });

      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();

      try {
        await performLogin(page);
        await waitForAuthenticatedHome(page, 30000);

        const organizationSlug = extractOrganizationSlug(page.url());
        await page.context().storageState({ path: storageStatePath });

        await use({
          organizationSlug,
          storageStatePath,
        });
      } finally {
        await context.close();
      }
    },
    { scope: "worker" },
  ],

  storageState: async ({ authSession }, use) => {
    await use(authSession.storageStatePath);
  },

  /**
   * Provides an authenticated page with a logged-in user
   */
  authenticatedPage: async ({ page, authSession }, use) => {
    await page.goto(`/${authSession.organizationSlug}/home`, {
      waitUntil: "domcontentloaded",
    });

    // Clerk should refresh the session from the seeded browser state. If the
    // worker's session expires during a long run, recover with a fresh sign-in.
    if (!isAuthenticatedUrl(page.url())) {
      await performLogin(page);
      await waitForAuthenticatedHome(page, 30000);
    }

    await use(page);
  },

  /**
   * Provides the organization slug for the authenticated user
   */
  organizationSlug: async ({ authSession }, use) => {
    await use(authSession.organizationSlug);
  },
});

/**
 * Perform login using Clerk with email code verification
 */
async function performLogin(page: Page): Promise<void> {
  const testEmail = process.env.TEST_USER_EMAIL || "sealtest001+clerk_test@example.com";
  const testEmailCode = process.env.TEST_EMAIL_CODE || "424242";

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

async function waitForAuthenticatedHome(page: Page, timeout: number): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (isAuthenticatedHomeUrl(page.url())) {
      return;
    }

    const authError = await getVisibleAuthError(page);
    if (authError) {
      throw new Error(`Authentication failed before reaching the workspace home: ${authError}`);
    }

    await page.waitForTimeout(250);
  }

  await page.waitForURL(/\/[\w-]+\/home/, { timeout: 1000 });
}

function isAuthenticatedHomeUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return /\/[\w-]+\/home(?:\/|$)/.test(pathname);
  } catch {
    return false;
  }
}

function isAuthenticatedUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return /\/(app|[\w-]+\/home|[\w-]+\/onboarding\/choose-organization)/.test(pathname);
  } catch {
    return false;
  }
}

function extractOrganizationSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/^\/([\w-]+)\/home(?:\/|$)/);
    return match?.[1] ?? "test-org";
  } catch {
    return "test-org";
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
      if (await locator.first().isVisible()) {
        return;
      }
    }

    const authError = await getVisibleAuthError(page);
    if (authError) {
      throw new Error(`Authentication flow failed before the next step rendered: ${authError}`);
    }

    await page.waitForTimeout(250);
  }

  if (isAuthenticatedUrl(page.url())) {
    return;
  }

  await expect(candidates[0]).toBeVisible({ timeout: 1000 });
}

async function getVisibleAuthError(page: Page): Promise<string | null> {
  const authErrorLocator = page
    .getByText(/too many requests|try again|incorrect|invalid|wrong/i)
    .first();

  if (!(await authErrorLocator.isVisible().catch(() => false))) {
    return null;
  }

  const text = (await authErrorLocator.textContent())?.trim();
  return text || "Unknown authentication error";
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
