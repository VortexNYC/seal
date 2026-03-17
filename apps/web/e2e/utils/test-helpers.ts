import type { Page } from "@playwright/test";

/**
 * Wait for Convex real-time updates to settle
 */
export async function waitForConvexUpdate(page: Page, timeout = 3000): Promise<void> {
  // Wait briefly for UI updates after Convex mutations.
  await page.waitForLoadState("domcontentloaded", { timeout });
}

/**
 * Wait for specific text to appear on the page
 */
export async function waitForText(
  page: Page,
  text: string,
  options?: { timeout?: number },
): Promise<void> {
  await page.getByText(text).waitFor({ timeout: options?.timeout || 10000 });
}

/**
 * Fill form field by label
 */
export async function fillByLabel(page: Page, label: string, value: string): Promise<void> {
  await page.getByLabel(label).fill(value);
}

/**
 * Click button by text or role
 */
export async function clickButton(
  page: Page,
  name: string,
  options?: { exact?: boolean },
): Promise<void> {
  await page.getByRole("button", { name, exact: options?.exact }).click();
}

/**
 * Navigate and wait for page to load completely
 */
export async function navigateAndWait(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
}

/**
 * Take screenshot with timestamp
 */
export async function takeTimestampedScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await page.screenshot({ path: `screenshots/${name}-${timestamp}.png` });
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page: Page, message: string | RegExp): Promise<void> {
  // Sonner toasts are typically in a [data-sonner-toast] element
  await page.locator("[data-sonner-toast]", { hasText: message }).waitFor();
}

/**
 * Check if element is visible
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).isVisible();
}
