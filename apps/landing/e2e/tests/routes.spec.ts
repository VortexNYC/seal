import { expect, test } from "@playwright/test";

import { HomePage } from "../pages/home-page";
import { trackBrowserErrors } from "../utils/browser-assertions";

test.describe("landing public routes", () => {
  test("footer links resolve to legal, docs, and changelog routes", async ({ page }) => {
    const homePage = new HomePage(page);
    const visitFooterLink = async (name: "Docs" | "API" | "Changelog" | "Terms" | "Privacy"): Promise<void> => {
      const href = await homePage.footerLink(name).getAttribute("href");
      expect(href).toBeTruthy();
      const targetPage = await page.context().newPage();
      await targetPage.goto(href!);
      return targetPage;
    };

    await page.goto("/");
    await expect(page.getByTestId("site-footer")).toBeVisible();

    await homePage.footerLink("Docs").scrollIntoViewIfNeeded();
    const docsPage = await visitFooterLink("Docs");
    await expect(docsPage).toHaveURL(/\/docs$/);
    await expect(docsPage.locator("body")).toContainText("Seal Docs");
    await docsPage.close();

    const apiPage = await visitFooterLink("API");
    await expect(apiPage).toHaveURL(/\/docs\/api-reference$/);
    await expect(apiPage.getByRole("heading", { name: /api reference/i }).first()).toBeVisible();
    await apiPage.close();

    const changelogPage = await visitFooterLink("Changelog");
    await expect(changelogPage).toHaveURL(/\/changelog$/);
    await expect(changelogPage.getByRole("heading", { level: 1, name: /changelog/i })).toBeVisible();
    await changelogPage.close();

    const termsPage = await visitFooterLink("Terms");
    await expect(termsPage).toHaveURL(/\/terms-of-service$/);
    await expect(termsPage.getByRole("heading", { level: 1, name: /terms of service/i })).toBeVisible();
    await termsPage.close();

    const privacyPage = await visitFooterLink("Privacy");
    await expect(privacyPage).toHaveURL(/\/privacy-policy$/);
    await expect(privacyPage.getByRole("heading", { level: 1, name: /privacy policy/i })).toBeVisible();
    await privacyPage.close();
  });

  test("representative public routes render without blocking errors", async ({ browser }) => {
    const routeChecks = [
      {
        path: "/integrations",
        assert: async (page: Parameters<typeof trackBrowserErrors>[0]) => {
          await expect(page.getByRole("heading", { level: 1, name: /built to connect/i })).toBeVisible();
        },
      },
      {
        path: "/changelog",
        assert: async (page: Parameters<typeof trackBrowserErrors>[0]) => {
          await expect(page.getByRole("heading", { level: 1, name: /changelog/i })).toBeVisible();
        },
      },
      {
        path: "/docs/getting-started",
        assert: async (page: Parameters<typeof trackBrowserErrors>[0]) => {
          await expect(page.getByRole("heading", { name: /getting started/i }).first()).toBeVisible();
        },
      },
      {
        path: "/api-reference",
        assert: async (page: Parameters<typeof trackBrowserErrors>[0]) => {
          await expect(page.getByText(/loading api reference|seal api reference/i).first()).toBeVisible();
        },
      },
      {
        path: "/privacy-policy",
        assert: async (page: Parameters<typeof trackBrowserErrors>[0]) => {
          await expect(page.getByRole("heading", { level: 1, name: /privacy policy/i })).toBeVisible();
        },
      },
      {
        path: "/terms-of-service",
        assert: async (page: Parameters<typeof trackBrowserErrors>[0]) => {
          await expect(page.getByRole("heading", { level: 1, name: /terms of service/i })).toBeVisible();
        },
      },
    ] as const;

    for (const routeCheck of routeChecks) {
      const page = await browser.newPage();
      const browserErrors = trackBrowserErrors(page);

      await page.goto(routeCheck.path);
      await routeCheck.assert(page);
      await browserErrors.assertNoErrors();
      await page.close();
    }
  });
});
