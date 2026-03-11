import { expect, test } from "@playwright/test";

import { HomePage } from "../pages/home-page";
import { trackBrowserErrors } from "../utils/browser-assertions";

const APP_URL = "https://app.seal.co";

test.describe("landing homepage", () => {
  test("renders homepage shell and critical sections without browser errors", async ({ page }) => {
    const browserErrors = trackBrowserErrors(page);
    const homePage = new HomePage(page);

    await homePage.goto();

    await expect(homePage.heroHeading()).toBeVisible();
    await expect(page.getByRole("heading", { name: /three things, done exceptionally well/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /simple pricing, no surprises/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /questions\? answers\./i })).toBeVisible();

    const startFreeCount = await homePage.startFreeLinks().count();
    expect(startFreeCount).toBeGreaterThan(0);

    for (let i = 0; i < startFreeCount; i += 1) {
      await expect(homePage.startFreeLinks().nth(i)).toHaveAttribute("href", `${APP_URL}/sign-up`);
    }

    const signInCount = await homePage.signInLinks().count();
    expect(signInCount).toBeGreaterThan(0);

    for (let i = 0; i < signInCount; i += 1) {
      await expect(homePage.signInLinks().nth(i)).toHaveAttribute("href", `${APP_URL}/sign-in`);
    }

    await browserErrors.assertNoErrors();
  });

  test("desktop navigation reaches public routes and in-page anchors", async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop navigation assertions are covered in desktop projects.");

    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(page.getByTestId("desktop-nav")).toBeVisible();
    await homePage.desktopNavLink("Pricing").click();
    await expect(homePage.pricingSection()).toBeInViewport();

    await Promise.all([page.waitForURL(/\/integrations$/), homePage.desktopNavLink("Integrations").click()]);
    await expect(page).toHaveURL(/\/integrations$/);
    await expect(page.getByRole("heading", { level: 1, name: /built to connect/i })).toBeVisible();

    await Promise.all([page.waitForURL(/\/docs$/), homePage.desktopNavLink("Docs").click()]);
    await expect(page).toHaveURL(/\/docs$/);
    await expect(page.locator("body")).toContainText("Seal Docs");

    await page.goto("/");
    await homePage.waitForReady();

    await Promise.all([page.waitForURL(/\/changelog$/), homePage.desktopNavLink("Changelog").click()]);
    await expect(page).toHaveURL(/\/changelog$/);
    await expect(page.getByRole("heading", { level: 1, name: /changelog/i })).toBeVisible();
  });

  test("mobile menu opens and navigates correctly", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile menu behavior is covered in mobile projects.");

    const homePage = new HomePage(page);
    await homePage.goto();

    await homePage.mobileMenuButton().tap();
    await expect(homePage.mobileNav()).toBeVisible();
    await expect(homePage.mobileMenuLink("Docs")).toBeVisible();

    await homePage.mobileMenuLink("Pricing").click();
    await expect(homePage.pricingSection()).toBeInViewport();

    await homePage.mobileMenuButton().tap();
    await Promise.all([page.waitForURL(/\/integrations$/), homePage.mobileMenuLink("Integrations").click()]);
    await expect(page).toHaveURL(/\/integrations$/);
    await expect(page.getByRole("heading", { level: 1, name: /built to connect/i })).toBeVisible();
  });
});
