import { expect, test } from "@playwright/test";

test.describe("Authentication", () => {
	test("should display landing page with sign-in options when not authenticated", async ({
		page,
	}) => {
		await page.goto("/");

		// Should show the public landing page (not redirect to sign-in)
		await expect(page).toHaveURL("/");

		// Should show Sign In link for unauthenticated users
		await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
	});

	test("should navigate to sign-in page when clicking Sign In", async ({
		page,
	}) => {
		await page.goto("/");

		// Click Sign In link
		await page.getByRole("link", { name: "Sign In" }).first().click();

		// Should navigate to sign-in page
		await expect(page).toHaveURL(/sign-in/);

		// Should show Clerk sign-in component
		await expect(page.locator('[data-clerk-element="sign-in"]')).toBeVisible();
	});

	test("should login with valid credentials", async ({ page }) => {
		const testEmail = process.env.TEST_USER_EMAIL || "test@seal-test.com";
		const testPassword = process.env.TEST_USER_PASSWORD || "TestPassword123!";

		// Navigate directly to sign-in page
		await page.goto("/sign-in");

		// Wait for Clerk sign-in component to load
		await page.waitForSelector('[data-clerk-element="sign-in"]', {
			timeout: 10000,
		});

		// Fill in credentials
		await page.fill('input[name="identifier"]', testEmail);
		await page.click('button[type="submit"]');

		// Wait for password field
		await page.waitForSelector('input[name="password"]');
		await page.fill('input[name="password"]', testPassword);
		await page.click('button[type="submit"]');

		// Should redirect to authenticated area
		await expect(page).toHaveURL(/\/.*\/home/);
	});

	test("should show error with invalid credentials", async ({ page }) => {
		// Navigate directly to sign-in page
		await page.goto("/sign-in");

		// Wait for Clerk sign-in component to load
		await page.waitForSelector('[data-clerk-element="sign-in"]', {
			timeout: 10000,
		});

		// Fill in invalid credentials
		await page.fill('input[name="identifier"]', "invalid@email.com");
		await page.click('button[type="submit"]');

		await page.waitForSelector('input[name="password"]');
		await page.fill('input[name="password"]', "wrongpassword");
		await page.click('button[type="submit"]');

		// Should show error message
		await expect(page.locator(".cl-formFieldErrorText")).toBeVisible();
	});
});

test.describe("Organization Selection", () => {
	test("should allow organization selection", async ({ page }) => {
		// This test assumes user is already logged in
		// You may need to adjust based on your org selection flow

		await page.goto("/onboarding/choose-organization");

		// Should show organization selection
		await expect(
			page.getByRole("heading", { name: /choose organization/i }),
		).toBeVisible();
	});
});
