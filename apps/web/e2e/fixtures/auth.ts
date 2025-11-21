import { test as base, type Page } from "@playwright/test";

type AuthFixtures = {
	authenticatedPage: Page;
	organizationSlug: string;
};

/**
 * Extended test with authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
	/**
	 * Provides an authenticated page with a logged-in user
	 * Uses Clerk's session storage to persist authentication
	 */
	authenticatedPage: async ({ page, context }, use) => {
		// Check if we have stored auth state
		const authStatePath = "e2e/.auth/user.json";

		try {
			// Try to load existing auth state
			await context.addCookies(
				JSON.parse(
					await require("node:fs").promises.readFile(authStatePath, "utf-8"),
				),
			);
		} catch {
			// If no auth state exists, perform login
			await performLogin(page);

			// Save authentication state
			const cookies = await context.cookies();
			await require("node:fs").promises.mkdir("e2e/.auth", { recursive: true });
			await require("node:fs").promises.writeFile(
				authStatePath,
				JSON.stringify(cookies),
			);
		}

		// Navigate to the app to verify authentication
		await page.goto("/");

		// Wait for Clerk to initialize
		await page.waitForLoadState("networkidle");

		await use(page);
	},

	/**
	 * Provides the organization slug for the authenticated user
	 */
	organizationSlug: async ({ authenticatedPage }, use) => {
		// Extract organization slug from URL or state
		const url = authenticatedPage.url();
		const match = url.match(/\/([\w-]+)\/home/);
		const slug = match ? match[1] : "test-org";

		await use(slug);
	},
});

/**
 * Perform login using Clerk
 */
async function performLogin(page: Page): Promise<void> {
	const testEmail = process.env.TEST_USER_EMAIL || "test@seal-test.com";
	const testPassword = process.env.TEST_USER_PASSWORD || "TestPassword123!";

	// Navigate to login page
	await page.goto("/");

	// Wait for Clerk sign-in component
	await page.waitForSelector('[data-clerk-element="sign-in"]', {
		timeout: 10000,
	});

	// Fill in credentials
	await page.fill('input[name="identifier"]', testEmail);
	await page.click('button[type="submit"]');

	// Wait for password field
	await page.waitForSelector('input[name="password"]', { timeout: 5000 });
	await page.fill('input[name="password"]', testPassword);
	await page.click('button[type="submit"]');

	// Wait for redirect to authenticated area
	await page.waitForURL("**/home", { timeout: 30000 });
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
