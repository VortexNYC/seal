import { expect, test } from "@playwright/test";

import { ApiReferencePage } from "../pages/api-reference-page";
import { HomePage } from "../pages/home-page";
import {
  assertNoHorizontalOverflow,
  expectInline,
  expectStacked,
  getViewportKind,
} from "../utils/responsive-assertions";

test.describe("landing responsive layouts", () => {
  test("homepage adapts shell and section layouts across breakpoints", async ({
    page,
  }, testInfo) => {
    const viewportKind = getViewportKind(testInfo);
    const homePage = new HomePage(page);

    await homePage.goto();
    await assertNoHorizontalOverflow(page);

    const featureCopy = page.getByRole("heading", {
      name: /like having a legal assistant review every clause/i,
    });
    const featureMockup = page.getByText("Series A Term Sheet — Vantage.pdf");
    await featureCopy.scrollIntoViewIfNeeded();

    if (viewportKind === "mobile") {
      await expect(homePage.mobileMenuButton()).toBeVisible();
      await expect(homePage.desktopNav()).toBeHidden();
      await expectStacked(featureCopy, featureMockup);
      await expectStacked(
        homePage.footerGridColumns().nth(0),
        homePage.footerGridColumns().nth(1)
      );
      return;
    }

    await expect(homePage.mobileMenuButton()).toBeHidden();
    await expect(homePage.desktopNav()).toBeVisible();

    if (viewportKind === "tablet") {
      await expectStacked(featureCopy, featureMockup);
      await expectInline(
        homePage.footerGridColumns().nth(0),
        homePage.footerGridColumns().nth(1)
      );
      return;
    }

    await expectInline(featureCopy, featureMockup);
    await expectInline(
      homePage.footerGridColumns().nth(0),
      homePage.footerGridColumns().nth(1)
    );
  });

  test("representative routes stay usable without horizontal overflow", async ({
    page,
  }, testInfo) => {
    const viewportKind = getViewportKind(testInfo);

    await page.goto("/integrations");
    await expect(
      page.getByRole("heading", { level: 1, name: /built to connect/i })
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const integrationCards = page
      .getByTestId("integrations-grid")
      .locator(":scope > *");
    const integrationCtas = page
      .getByTestId("integrations-cta-group")
      .getByRole("link");

    if (viewportKind === "desktop") {
      await expectInline(integrationCards.nth(0), integrationCards.nth(1));
    } else {
      await expectStacked(integrationCards.nth(0), integrationCards.nth(1));
    }

    if (viewportKind === "mobile") {
      await expectStacked(integrationCtas.nth(0), integrationCtas.nth(1));
    } else {
      await expectInline(integrationCtas.nth(0), integrationCtas.nth(1));
    }

    await page.goto("/docs");
    await expect(
      page.getByRole("heading", { name: /documentation/i }).first()
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    if (viewportKind === "mobile") {
      await expect(
        page.getByRole("button", { name: /open sidebar/i }).first()
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("button", { name: /collapse sidebar/i }).first()
      ).toBeVisible();
    }

    await page.goto("/docs/getting-started");
    await expect(
      page.getByRole("heading", { name: /getting started/i }).first()
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const apiReferencePage = new ApiReferencePage(page);
    await apiReferencePage.goto();
    await assertNoHorizontalOverflow(page);

    await expect(apiReferencePage.navigationMenuButton()).toBeVisible();

    await page.goto("/changelog");
    await expect(
      page.getByRole("heading", { level: 1, name: /changelog/i })
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/privacy-policy");
    await expect(
      page.getByRole("heading", { level: 1, name: /privacy policy/i })
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/terms-of-service");
    await expect(
      page.getByRole("heading", { level: 1, name: /terms of service/i })
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test("dynamic page route preserves the current not-found contract", async ({
    page,
  }) => {
    await page.goto("/pages/test-slug");

    await expect(
      page.getByRole("heading", { level: 1, name: "404" })
    ).toBeVisible();
    await expect(page.getByText(/page not found/i)).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
