import { expect, test } from "@playwright/test";

test.describe("Authentication", () => {
	test("should display login page when not authenticated", async ({ page }) => {
		await page.goto("/");

		// Should redirect to Clerk sign-in
		await expect(page).toHaveURL(/sign-in/);

		// Should show Clerk sign-in component
		await expect(page.locator('[data-clerk-element="sign-in"]')).toBeVisible();
	});

	test("should login with valid credentials", async ({ page }) => {
		const testEmail = process.env.TEST_USER_EMAIL || "test@seal-test.com";
		const testPassword = process.env.TEST_USER_PASSWORD || "TestPassword123!";

		await page.goto("/");

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
		await page.goto("/");

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
