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
		const testEmail = process.env.TEST_USER_EMAIL || "test@seal-test.com";
		const testPassword = process.env.TEST_USER_PASSWORD || "TestPassword123!";

		// Navigate directly to sign-in page
		await page.goto("/sign-in");

		// Wait for Clerk sign-in component to load
		await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

		// Fill in credentials
		await page.getByLabel(/email address/i).fill(testEmail);
		await page.getByRole("button", { name: "Continue", exact: true }).click();

		// Wait for password field and fill
		await page.getByLabel(/password/i).fill(testPassword);
		await page.getByRole("button", { name: "Continue", exact: true }).click();

		// Should redirect to authenticated area
		await expect(page).toHaveURL(/\/.*\/home/);
	});

	test("should show error with invalid credentials", async ({ page }) => {
		// Navigate directly to sign-in page
		await page.goto("/sign-in");

		// Wait for Clerk sign-in component to load
		await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

		// Fill in invalid credentials
		await page.getByLabel(/email address/i).fill("invalid@email.com");
		await page.getByRole("button", { name: "Continue", exact: true }).click();

		// Wait for password field and fill
		await page.getByLabel(/password/i).fill("wrongpassword");
		await page.getByRole("button", { name: "Continue", exact: true }).click();

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
