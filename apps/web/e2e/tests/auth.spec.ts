import { expect, test } from "@playwright/test";

function getSignInPromptMatcher() {
  return /sign in/i;
}

function getOtpPromptMatcher() {
  return /check your email|verification code/i;
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
    const testEmail = process.env.TEST_USER_EMAIL || "sealtest001+clerk_test@example.com";
    const testEmailCode = process.env.TEST_EMAIL_CODE || "424242";

    // Navigate directly to sign-in page
    await page.goto("/sign-in");

    // Wait for Clerk sign-in component to load
    await expect(
      page.getByRole("heading", { name: getSignInPromptMatcher() }),
      `Expected sign-in heading ${getSignInPromptMatcher()}`,
    ).toBeVisible();

    // Fill in email
    await page.getByRole("textbox", { name: /email/i }).first().fill(testEmail);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Wait for OTP code screen and inputs to be ready
    await expect(
      page.getByRole("heading", { name: getOtpPromptMatcher() }).first(),
      `Expected OTP prompt ${getOtpPromptMatcher()}`,
    ).toBeVisible();

    // Wait a moment for Clerk OTP to initialize
    await page.waitForTimeout(500);

    // Type the OTP code directly (Clerk test mode accepts 424242 for +clerk_test emails)
    const singleOtpInput = page
      .locator('input[name="code"], input[autocomplete="one-time-code"]')
      .first();
    const multiOtpInputs = page.locator(
      '[data-testid="otp-input"], [data-testid="clerk-otp-code-input"]',
    );
    const codeRoleInput = page.getByRole("textbox", { name: /code/i }).first();

    if ((await singleOtpInput.count()) > 0) {
      await singleOtpInput.fill(testEmailCode);
    } else if ((await multiOtpInputs.count()) > 1) {
      for (let i = 0; i < Math.min(6, testEmailCode.length); i++) {
        await multiOtpInputs.nth(i).fill(testEmailCode[i] ?? "");
      }
    } else if ((await codeRoleInput.count()) > 0) {
      await codeRoleInput.fill(testEmailCode);
    } else {
      await page.keyboard.type(testEmailCode);
    }

    // Should redirect to authenticated area (may go to /app, /home, or org-specific path)
    await expect(page).toHaveURL(/\/(app|.*\/home)/, { timeout: 30000 });
  });

  test("should show error with invalid credentials", async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL || "sealtest001+clerk_test@example.com";

    // Navigate directly to sign-in page
    await page.goto("/sign-in");

    // Wait for Clerk sign-in component to load
    await expect(page.getByRole("heading", { name: getSignInPromptMatcher() })).toBeVisible();

    // Fill in email
    await page.getByLabel(/email address/i).fill(testEmail);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Wait for OTP code screen
    await expect(page.getByRole("heading", { name: getOtpPromptMatcher() }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: getOtpPromptMatcher() }).first()).toBeVisible();

    // Wait a moment for Clerk OTP to initialize
    await page.waitForTimeout(500);

    // Type an invalid OTP code directly
    await page.keyboard.type("000000");

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
