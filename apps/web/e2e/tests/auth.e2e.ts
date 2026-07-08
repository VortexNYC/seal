import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

function getSignInPromptMatcher() {
  return /Sign in to continue/i;
}

test.describe("Authentication", () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  test("should redirect unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/");

    // Users are now redirected to the sign-in flow when not authenticated.
    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByRole("heading", { name: getSignInPromptMatcher() })).toBeVisible();
  });

  test("should keep unauthenticated users on sign-in when accessing app", async ({ page }) => {
    await page.goto("/app");

    await expect(page).toHaveURL("/sign-in", { timeout: 30000 });
    await expect(page.getByRole("heading", { name: getSignInPromptMatcher() })).toBeVisible();
  });

  test("should login with valid credentials", async ({ page }) => {
    const testEmail =
      process.env.E2E_TEST_USER_EMAIL ||
      process.env.TEST_USER_EMAIL ||
      "sealtest001+clerk_test@example.com";

    // Use Clerk's official testing protocol — clerk.signIn() handles the
    // testing token, bot-detection bypass, and sign-in mechanics reliably.
    // Manual OTP entry is fragile because Clerk's DOM structure changes across
    // versions and the individual-digit inputs are hard to target consistently.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await clerk.signIn({
      page,
      signInParams: {
        strategy: "email_code",
        identifier: testEmail,
      },
    });

    // After clerk.signIn() completes, navigate to the app
    await page.goto("/app", { waitUntil: "domcontentloaded" });

    // Should redirect to authenticated area (may go to /app, /home, or org-specific path)
    await expect(page).toHaveURL(/\/(app|.*\/home|.*\/onboarding)/, { timeout: 30000 });
  });

  test("should show error with invalid credentials", async ({ page }) => {
    const bogusEmail = "nonexistent-user-e2e-test@example.com";

    // Navigate directly to sign-in page
    await page.goto("/sign-in");

    // Wait for Clerk sign-in component to load
    await expect(page.getByRole("heading", { name: getSignInPromptMatcher() })).toBeVisible();

    // Fill in an email that doesn't exist in the Clerk instance
    await page.getByRole("textbox", { name: /email/i }).first().fill(bogusEmail);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Should show an auth error message (account not found, invalid, etc.)
    await expect(
      page.getByText(/couldn.t find|not found|incorrect|invalid|no account/i).first(),
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
