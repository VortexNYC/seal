import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { canUseClerkTestingHelpers } from "./clerk-testing-env";

type ClerkWindow = Window & {
  Clerk?: {
    session?: {
      getToken(options?: { template?: "convex"; skipCache?: boolean }): Promise<string | null>;
    } | null;
  };
};

type TestWorkspaceConfig = {
  email: string;
  emailCode: string;
  organizationName: string;
  organizationSlug: string;
};

let clerkTestingSetupPromise: Promise<void> | null = null;

export function getTestWorkspaceConfig(): TestWorkspaceConfig {
  const email =
    process.env.E2E_TEST_USER_EMAIL ||
    process.env.TEST_USER_EMAIL ||
    "sealtest001+clerk_test@example.com";
  const emailCode = process.env.E2E_TEST_EMAIL_CODE || process.env.TEST_EMAIL_CODE || "424242";
  const defaultSlug = buildDefaultOrganizationSlug(email);

  return {
    email,
    emailCode,
    organizationName:
      process.env.E2E_TEST_ORGANIZATION_NAME ||
      process.env.TEST_ORGANIZATION_NAME ||
      "Seal E2E Workspace",
    organizationSlug:
      process.env.E2E_TEST_ORGANIZATION_SLUG || process.env.TEST_ORGANIZATION_SLUG || defaultSlug,
  };
}

export async function performLogin(page: Page): Promise<void> {
  const { email: testEmail, emailCode: testEmailCode } = getTestWorkspaceConfig();

  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

  if (isAuthenticatedUrl(page.url())) {
    return;
  }

  const shouldUseClerkTesting = canUseClerkTestingHelpers();

  if (shouldUseClerkTesting) {
    await ensureClerkTestingSetup();
    await clerk.loaded({ page });
    await clerk.signIn({
      page,
      signInParams: {
        strategy: "email_code",
        identifier: testEmail,
      },
    });
    await page.goto("/app", { waitUntil: "domcontentloaded" });
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

  await page.waitForURL(/\/(app|.*\/home|.*\/onboarding\/choose-organization)/, {
    timeout: 30000,
  });
}

export function isAuthenticatedUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return /\/(app|[\w-]+\/home|[\w-]+\/onboarding\/choose-organization)/.test(pathname);
  } catch {
    return false;
  }
}

export async function ensureWorkspaceForAuthenticatedUser(page: Page): Promise<string> {
  const convexUrl = process.env.VITE_CONVEX_URL;

  if (!convexUrl) {
    throw new Error("missing VITE_CONVEX_URL envar for E2E workspace setup");
  }

  const convexToken = await waitForClerkConvexToken(page);

  if (!convexToken) {
    throw new Error("Failed to fetch Clerk Convex token for E2E workspace setup");
  }

  const workspace = getTestWorkspaceConfig();
  const convex = new ConvexHttpClient(convexUrl, {
    auth: convexToken,
    logger: false,
  });
  const ensurePersonalOrganization = makeFunctionReference<"mutation">(
    "organizations/mutations:ensurePersonalOrganization",
  );
  const hasOrganization = makeFunctionReference<"query">("check_membership:hasOrganization");

  await retry(
    async () => {
      await convex.mutation(ensurePersonalOrganization, {
        organizationName: workspace.organizationName,
        organizationSlug: workspace.organizationSlug,
      });
    },
    {
      attempts: 10,
      delayMs: 1500,
    },
  );

  const membership = await retry(async () => convex.query(hasOrganization, {}), {
    attempts: 10,
    delayMs: 1000,
    isComplete: (result) => Boolean(result.activeOrganizationSlug),
  });

  const activeOrganizationSlug = membership.activeOrganizationSlug;

  if (!activeOrganizationSlug) {
    throw new Error("Workspace setup completed without an active organization slug");
  }

  return activeOrganizationSlug;
}

export async function waitForClerkConvexToken(page: Page): Promise<string> {
  const token = await retry(
    async () =>
      page.evaluate(async () => {
        const clerk = (window as ClerkWindow).Clerk;
        return (await clerk?.session?.getToken({ template: "convex", skipCache: true })) ?? null;
      }),
    {
      attempts: 10,
      delayMs: 500,
      isComplete: (value) => typeof value === "string" && value.length > 0,
    },
  );

  if (!token) {
    throw new Error("Failed to fetch Clerk Convex token for E2E workspace setup");
  }

  return token;
}

async function ensureClerkTestingSetup(): Promise<void> {
  clerkTestingSetupPromise ??= clerkSetup();
  await clerkTestingSetupPromise;
}

async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts: number;
    delayMs: number;
    isComplete?: (value: T) => boolean;
  },
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      const result = await fn();
      if (!options.isComplete || options.isComplete(result)) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < options.attempts) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Retry operation did not complete successfully");
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

function buildDefaultOrganizationSlug(email: string): string {
  const localPart = email.split("@")[0] ?? "seal-e2e";
  const slug = localPart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || "seal-e2e";
}
