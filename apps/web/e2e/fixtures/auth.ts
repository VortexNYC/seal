import { test as base, type Page } from "@playwright/test";

type AuthFixtures = {
	authenticatedPage: Page;
	organizationSlug: string;
};

/**
 * Extended test with authentication fixtures
 *
 * Note: Clerk uses short-lived JWTs (60s), so we perform fresh login for each test
 * to ensure reliable authentication. The login flow is quick with Clerk test mode.
 */
export const test = base.extend<AuthFixtures>({
	/**
	 * Provides an authenticated page with a logged-in user
	 */
	authenticatedPage: async ({ page }, use) => {
		// Always perform fresh login (Clerk JWTs are short-lived)
		await performLogin(page);

		// Wait for redirect to org-specific URL
		// The app redirects: sign-in -> /app -> /{org-slug}/home
		await page.waitForURL(/\/[\w-]+\/home/, { timeout: 15000 });

		await use(page);
	},

	/**
	 * Provides the organization slug for the authenticated user
	 */
	organizationSlug: async ({ authenticatedPage }, use) => {
		// Extract organization slug from URL
		const url = authenticatedPage.url();
		const match = url.match(/\/([\w-]+)\/home/);
		const slug = match ? match[1] : "test-org";

		await use(slug);
	},
});

/**
 * Perform login using Clerk with email code verification
 */
async function performLogin(page: Page): Promise<void> {
	const testEmail =
		process.env.TEST_USER_EMAIL || "sealtest001+clerk_test@example.com";
	const testEmailCode = process.env.TEST_EMAIL_CODE || "424242";

	// Navigate directly to sign-in page
	await page.goto("/sign-in");

	// Wait for Clerk sign-in component
	await page.waitForSelector('text="Sign in to Seal"', {
		timeout: 10000,
	});

	// Fill in email
	await page.getByLabel(/email address/i).fill(testEmail);
	await page.getByRole("button", { name: "Continue", exact: true }).click();

	// Wait for OTP code screen
	await page.waitForSelector('text="Check your email"', { timeout: 10000 });

	// Wait a moment for Clerk OTP to initialize
	await page.waitForTimeout(500);

	// Type the OTP code directly (Clerk test mode accepts 424242 for +clerk_test emails)
	await page.keyboard.type(testEmailCode);

	// Wait for redirect to authenticated area (may go to /app or org-specific path)
	await page.waitForURL(/\/(app|.*\/home)/, { timeout: 30000 });
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
