import { expect, test } from "@playwright/test";

import {
  getTestWorkspaceConfig,
  isAuthenticatedUrl,
  signInTestUser,
} from "../fixtures/auth-helpers";

function getSignInPromptMatcher() {
  return /sign in/i;
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

    // Users are redirected to the sign-in flow when not authenticated.
    await expect(page).toHaveURL("/sign-in");
    await expect(
      page.getByRole("heading", { name: getSignInPromptMatcher() }).first()
    ).toBeVisible();
  });

  test("should keep unauthenticated users on sign-in when accessing app", async ({
    page,
  }) => {
    await page.goto("/app");

    await expect(page).toHaveURL("/sign-in", { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: getSignInPromptMatcher() }).first()
    ).toBeVisible();
  });

  test("should login with valid credentials", async ({ page }) => {
    test.setTimeout(90000);

    // Better-Auth email+password sign-in (signs up + onboards on first run).
    await signInTestUser(page);

    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/(app|.*\/home|.*\/onboarding)/, {
      timeout: 30000,
    });
    expect(isAuthenticatedUrl(page.url())).toBe(true);
  });

  test("should reject invalid credentials", async ({ page }) => {
    const { email } = getTestWorkspaceConfig();

    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: getSignInPromptMatcher() }).first()
    ).toBeVisible();

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "definitely-the-wrong-password");
    await page.click('button[type="submit"], button:has-text("Sign in")');

    // Better-Auth rejects the credentials: the app stays on /sign-in (no
    // authenticated redirect). An error message is shown but its exact copy is
    // owned by the vortex-auth <SignIn> component, so we assert on the gate.
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/sign-in/);
    expect(isAuthenticatedUrl(page.url())).toBe(false);
  });
});
