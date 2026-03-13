import { expect, type Locator, type Page } from "@playwright/test";

const APP_URL = "https://app.seal.co";

export class HomePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.waitForReady();
  }

  async waitForReady(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { level: 1, name: /docusign doesn.t read your contracts/i }),
    ).toBeVisible();
    await expect(this.page.getByRole("navigation").first()).toBeVisible();
    await expect(this.page.getByRole("contentinfo")).toBeVisible();
  }

  heroHeading(): Locator {
    return this.page.getByRole("heading", {
      level: 1,
      name: /docusign doesn.t read your contracts/i,
    });
  }

  startFreeLinks(): Locator {
    return this.page.locator(`a[href="${APP_URL}/sign-up"]`);
  }

  signInLinks(): Locator {
    return this.page.locator(`header a[href="${APP_URL}/sign-in"]`);
  }

  pricingSection(): Locator {
    return this.page.locator("#pricing");
  }

  faqSection(): Locator {
    return this.page.locator("#faq");
  }

  desktopNavLink(name: string): Locator {
    return this.page.getByTestId("desktop-nav").getByRole("link", { exact: true, name });
  }

  desktopNav(): Locator {
    return this.page.getByTestId("desktop-nav");
  }

  mobileMenuButton(): Locator {
    return this.page.getByTestId("mobile-menu-button");
  }

  mobileNav(): Locator {
    return this.page.getByTestId("mobile-nav");
  }

  mobileMenuLink(name: string): Locator {
    return this.mobileNav().getByRole("link", { exact: true, name });
  }

  footerLink(name: string): Locator {
    return this.page.getByTestId("site-footer").getByRole("link", { exact: true, name });
  }

  footerInner(): Locator {
    return this.page.getByTestId("site-footer-inner");
  }

  footerBrand(): Locator {
    return this.page.getByTestId("site-footer-brand");
  }

  footerLinks(): Locator {
    return this.page.getByTestId("site-footer-links");
  }

  footerGridColumns(): Locator {
    return this.page.getByTestId("site-footer-inner").locator(":scope > *");
  }

  pricingCards(): Locator {
    return this.page.getByTestId("pricing-grid").locator(":scope > *");
  }

  developersCopy(): Locator {
    return this.page.getByTestId("developers-copy");
  }

  developersCodePanel(): Locator {
    return this.page.getByTestId("developers-code-panel");
  }
}
