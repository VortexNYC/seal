import { expect, test } from "@playwright/test";

import { HomePage } from "../pages/home-page";
import { trackBrowserErrors } from "../utils/browser-assertions";

const APP_URL = process.env.VITE_APP_URL || "https://app.seal.nyc";

test.describe("landing homepage", () => {
  test("renders homepage shell and critical sections without browser errors", async ({ page }) => {
    const browserErrors = trackBrowserErrors(page);
    const homePage = new HomePage(page);

    await homePage.goto();

    await expect(homePage.heroHeading()).toBeVisible();
    await page.getByRole("heading", { name: /like having a legal assistant review every clause/i }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /like having a legal assistant review every clause/i })).toBeVisible();
    await page.getByRole("heading", { name: /it.s time to stop juggling tools and start getting more deals/i }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /it.s time to stop juggling tools and start getting more deals/i })).toBeVisible();

    const startFreeCount = await homePage.startFreeLinks().count();
    expect(startFreeCount).toBeGreaterThan(0);

    for (let i = 0; i < startFreeCount; i += 1) {
      await expect(homePage.startFreeLinks().nth(i)).toHaveAttribute("href", `${APP_URL}/waitlist`);
    }

    await browserErrors.assertNoErrors();
  });

  test("desktop navigation reaches public routes and in-page anchors", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop navigation assertions are covered in desktop projects.");

    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(page.getByTestId("desktop-nav")).toBeVisible();
    await Promise.all([page.waitForURL(/\/docs$/), homePage.desktopNavLink("Docs").click()]);
    await expect(page).toHaveURL(/\/docs$/);
    await expect(page.locator("body")).toContainText("Docs");

    await page.goto("/");
    await homePage.waitForReady();

    await Promise.all([page.waitForURL(/\/compare$/), homePage.desktopNavLink("Compare").click()]);
    await expect(page).toHaveURL(/\/compare$/);
    await expect(page.getByRole("heading", { level: 1, name: /we built a document platform/i })).toBeVisible();

    await Promise.all([page.waitForURL(/\/developer$/), homePage.desktopNavLink("Developer").click()]);
    await expect(page).toHaveURL(/\/developer$/);
    await expect(page.getByRole("heading", { name: "Developer Documentation" }).first()).toBeVisible();
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
    await Promise.all([page.waitForURL(/\/compare$/), homePage.mobileMenuLink("Compare").click()]);
    await expect(page).toHaveURL(/\/compare$/);
    await expect(page.getByRole("heading", { level: 1, name: /we built a document platform/i })).toBeVisible();
  });
});
