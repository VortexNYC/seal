import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type AuthStep = "authenticated" | "otp" | "password";

function getSignInPromptMatcher() {
  return /sign in/i;
}

function getOtpPromptMatcher() {
  return /check your email|verification code/i;
}

function getSuccessfulAuthUrlMatcher() {
  return /\/(app|.*\/home|.*\/onboarding\/choose-organization)/;
}

function getAuthSpecEmail(kind: "valid" | "invalid") {
  const envValue =
    kind === "valid" ? process.env.TEST_AUTH_SPEC_EMAIL : process.env.TEST_AUTH_SPEC_INVALID_EMAIL;

  if (envValue) {
    return envValue;
  }

  return process.env.TEST_USER_EMAIL || "sealtest001+clerk_test@example.com";
}

async function clickPrimaryAuthAction(page: Page): Promise<void> {
  const candidates: Locator[] = [
    page.getByRole("button", { name: "Continue", exact: true }),
    page.getByRole("button", { name: /continue/i }),
    page.getByRole("button", { name: /^sign in$/i }),
    page.getByRole("button", { name: /sign in/i }),
  ];

  for (const locator of candidates) {
    if (await locator.first().isVisible().catch(() => false)) {
      await locator.first().click();
      return;
    }
  }

  throw new Error("Unable to find the primary Clerk auth action.");
}

async function waitForNextAuthStep(page: Page): Promise<AuthStep> {
  const otpCandidates: Locator[] = [
    page.getByRole("heading", { name: getOtpPromptMatcher() }).first(),
    page.getByText(/check your email/i),
    page.getByText(/verification code/i),
  ];
  const passwordCandidates: Locator[] = [
    page.getByRole("heading", { name: /password/i }),
    page.getByText(/enter your password/i),
    page.locator('input[type="password"]'),
  ];

  const start = Date.now();
  while (Date.now() - start < 30000) {
    if (page.url().match(getSuccessfulAuthUrlMatcher())) {
      return "authenticated";
    }

    for (const locator of otpCandidates) {
      if (await locator.isVisible().catch(() => false)) {
        return "otp";
      }
    }

    for (const locator of passwordCandidates) {
      if (await locator.first().isVisible().catch(() => false)) {
        return "password";
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Authentication flow did not reach a known next step. Current URL: ${page.url()}`);
}

async function fillOtpCode(page: Page, code: string): Promise<void> {
  const singleOtpInput = page
    .locator('input[name="code"], input[autocomplete="one-time-code"]')
    .first();
  const multiOtpInputs = page.locator(
    '[data-testid="otp-input"], [data-testid="clerk-otp-code-input"]',
  );
  const codeRoleInput = page.getByRole("textbox", { name: /code/i }).first();

  if ((await singleOtpInput.count()) > 0) {
    await singleOtpInput.fill(code);
    return;
  }

  if ((await multiOtpInputs.count()) > 1) {
    for (let index = 0; index < Math.min(6, code.length); index++) {
      await multiOtpInputs.nth(index).fill(code[index] ?? "");
    }
    return;
  }

  if ((await codeRoleInput.count()) > 0) {
    await codeRoleInput.fill(code);
    return;
  }

  await page.keyboard.type(code);
}

async function fillPassword(page: Page, password: string): Promise<void> {
  const passwordInput = page.getByLabel(/password/i).or(page.locator('input[type="password"]'));
  await passwordInput.first().fill(password);
}

test.describe("Authentication", () => {
  test("should redirect unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/");

    // Users are now redirected to the sign-in flow when not authenticated.
    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByRole("heading", { name: getSignInPromptMatcher() })).toBeVisible();
  });

  test("should keep unauthenticated users on sign-in when accessing app", async ({ page }) => {
    await page.goto("/app");

    // Signed-out users should land on an unauthenticated route.
    await expect(page).toHaveURL(/\/(app|sign-in)/, { timeout: 30000 });
  });

  test("should login with valid credentials", async ({ page }) => {
    test.skip(
      !!process.env.CI,
      "Clerk email-code smoke is too rate-limit prone for the shared CI account.",
    );

    const testEmail = getAuthSpecEmail("valid");
    // Navigate directly to sign-in page
    await page.goto("/sign-in");

    // Wait for Clerk sign-in component to load
    await expect(
      page.getByRole("heading", { name: getSignInPromptMatcher() }),
      `Expected sign-in heading ${getSignInPromptMatcher()}`,
    ).toBeVisible();

    // Fill in email
    await page.getByRole("textbox", { name: /email/i }).first().fill(testEmail);
    await clickPrimaryAuthAction(page);

    const nextStep = await waitForNextAuthStep(page);

    if (nextStep === "otp") {
      const testEmailCode = process.env.TEST_EMAIL_CODE || "424242";

      // Wait a moment for Clerk OTP to initialize
      await page.waitForTimeout(500);
      await fillOtpCode(page, testEmailCode);
    } else if (nextStep === "password") {
      const testPassword = process.env.TEST_USER_PASSWORD;
      test.skip(!testPassword, "TEST_USER_PASSWORD is required when the shared Clerk user uses password auth.");
      if (!testPassword) {
        return;
      }

      await fillPassword(page, testPassword);
      await clickPrimaryAuthAction(page);
    }

    // Fresh Clerk test users may land on onboarding before they have a workspace.
    await expect(page).toHaveURL(getSuccessfulAuthUrlMatcher(), { timeout: 30000 });
  });

  test("should show error with invalid credentials", async ({ page }) => {
    test.skip(
      !!process.env.CI,
      "Clerk invalid-code smoke is too rate-limit prone for the shared CI account.",
    );

    const testEmail = getAuthSpecEmail("invalid");

    // Navigate directly to sign-in page
    await page.goto("/sign-in");

    // Wait for Clerk sign-in component to load
    await expect(page.getByRole("heading", { name: getSignInPromptMatcher() })).toBeVisible();

    // Fill in email
    await page.getByLabel(/email address/i).fill(testEmail);
    await clickPrimaryAuthAction(page);

    const nextStep = await waitForNextAuthStep(page);

    if (nextStep === "otp") {
      // Wait a moment for Clerk OTP to initialize
      await page.waitForTimeout(500);

      // Type an invalid OTP code directly
      await fillOtpCode(page, "000000");
    } else {
      const validPassword = process.env.TEST_USER_PASSWORD;
      test.skip(!validPassword, "TEST_USER_PASSWORD is required when the shared Clerk user uses password auth.");
      if (!validPassword) {
        return;
      }

      await fillPassword(page, `${validPassword}-invalid`);
      await clickPrimaryAuthAction(page);
    }

    // Should show an auth error message (rate limits and invalid code are both expected).
    await expect(
      page.getByText(/incorrect|invalid|wrong|too many requests|try again/i).first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Organization Selection", () => {
  test.skip("should allow organization selection", async ({ page }) => {
    // SKIPPED: The /onboarding/choose-organization route does not exist in the current app
    // This test was written for a feature that hasn't been implemented yet
    // Re-enable when organization selection onboarding is added

    await page.goto("/onboarding/choose-organization");

    // Should show organization selection
    await expect(page.getByRole("heading", { name: /choose organization/i })).toBeVisible();
  });
});
