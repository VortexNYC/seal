import { expect, test } from "@playwright/test";

import { ApiReferencePage } from "../pages/api-reference-page";
import { HomePage } from "../pages/home-page";
import { trackBrowserErrors } from "../utils/browser-assertions";

test.describe("landing public routes", () => {
  test("footer links resolve to legal, docs, and changelog routes", async ({ page }) => {
    const homePage = new HomePage(page);
    const visitFooterLink = async (
      name: "Docs" | "API" | "Changelog" | "Terms" | "Privacy",
      assertion: () => Promise<void>,
    ): Promise<void> => {
      await homePage.goto();
      await homePage.footerLink(name).scrollIntoViewIfNeeded();
      await homePage.footerLink(name).click();
      await assertion();
    };

    await visitFooterLink("Docs", async () => {
      await expect(page).toHaveURL(/\/docs$/);
      await expect(page.locator("body")).toContainText("Seal Docs");
    });

    await visitFooterLink("API", async () => {
      await expect(page).toHaveURL(/\/docs\/api-reference$/);
      await expect(page.getByRole("heading", { name: /api reference/i }).first()).toBeVisible();
    });

    await visitFooterLink("Changelog", async () => {
      await expect(page).toHaveURL(/\/changelog$/);
      await expect(page.getByRole("heading", { level: 1, name: /changelog/i })).toBeVisible();
    });

    await visitFooterLink("Terms", async () => {
      await expect(page).toHaveURL(/\/terms-of-service$/);
      await expect(page.getByRole("heading", { level: 1, name: /terms of service/i })).toBeVisible();
    });

    await visitFooterLink("Privacy", async () => {
      await expect(page).toHaveURL(/\/privacy-policy$/);
      await expect(page.getByRole("heading", { level: 1, name: /privacy policy/i })).toBeVisible();
    });
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
          await new ApiReferencePage(page).waitForReady();
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
