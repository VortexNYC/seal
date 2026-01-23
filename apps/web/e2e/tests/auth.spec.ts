import { expect, test } from "@playwright/test";

test.describe("Authentication", () => {
	test("should display landing page with sign-in options when not authenticated", async ({
		page,
	}) => {
		await page.goto("/");

		// Should show the public landing page (not redirect to sign-in)
		await expect(page).toHaveURL("/");

		// Should show Sign In link for unauthenticated users (nav has one, hero has one)
		await expect(
			page.getByRole("navigation").getByRole("link", { name: "Sign In" }),
		).toBeVisible();
	});

	test("should navigate to sign-in page when clicking Sign In", async ({
		page,
	}) => {
		await page.goto("/");

		// Click Sign In link
		await page.getByRole("link", { name: "Sign In" }).first().click();

		// Should navigate to sign-in page
		await expect(page).toHaveURL(/sign-in/);

		// Should show Clerk sign-in component (check for visible sign-in form elements)
		await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
	});

	test("should login with valid credentials", async ({ page }) => {
		const testEmail =
			process.env.TEST_USER_EMAIL || "sealtest001+clerk_test@example.com";
		const testEmailCode = process.env.TEST_EMAIL_CODE || "424242";

		// Navigate directly to sign-in page
		await page.goto("/sign-in");

		// Wait for Clerk sign-in component to load
		await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

		// Fill in email
		await page.getByLabel(/email address/i).fill(testEmail);
		await page.getByRole("button", { name: "Continue", exact: true }).click();

		// Wait for OTP code screen and inputs to be ready
		await expect(
			page.getByRole("heading", { name: /check your email/i }),
		).toBeVisible();

		// Wait a moment for Clerk OTP to initialize
		await page.waitForTimeout(500);

		// Type the OTP code directly (Clerk test mode accepts 424242 for +clerk_test emails)
		await page.keyboard.type(testEmailCode);

		// Should redirect to authenticated area (may go to /app, /home, or org-specific path)
		await expect(page).toHaveURL(/\/(app|.*\/home)/, { timeout: 30000 });
	});

	test("should show error with invalid credentials", async ({ page }) => {
		const testEmail =
			process.env.TEST_USER_EMAIL || "sealtest001+clerk_test@example.com";

		// Navigate directly to sign-in page
		await page.goto("/sign-in");

		// Wait for Clerk sign-in component to load
		await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

		// Fill in email
		await page.getByLabel(/email address/i).fill(testEmail);
		await page.getByRole("button", { name: "Continue", exact: true }).click();

		// Wait for OTP code screen
		await expect(
			page.getByRole("heading", { name: /check your email/i }),
		).toBeVisible();

		// Wait a moment for Clerk OTP to initialize
		await page.waitForTimeout(500);

		// Type an invalid OTP code directly
		await page.keyboard.type("000000");

		// Should show error message (Clerk shows error after auto-submit)
		await expect(page.getByText(/incorrect/i).first()).toBeVisible({
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
		await expect(
			page.getByRole("heading", { name: /choose organization/i }),
		).toBeVisible();
	});
});
