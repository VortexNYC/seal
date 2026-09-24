import type { Locator, Page } from "@playwright/test";

export class SettingsPage {
  readonly page: Page;
  readonly heading: Locator;

  // Navigation links
  readonly profileLink: Locator;
  readonly teamLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /settings/i });

    this.profileLink = page.getByRole("link", { name: /profile/i });
    this.teamLink = page.getByRole("link", { name: /team/i });
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/${slug}/settings`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async navigateToProfile(): Promise<void> {
    await this.profileLink.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async navigateToTeam(): Promise<void> {
    await this.teamLink.click();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
