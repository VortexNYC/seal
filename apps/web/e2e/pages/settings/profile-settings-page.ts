import type { Locator, Page } from "@playwright/test";

export class ProfileSettingsPage {
  readonly page: Page;
  readonly heading: Locator;

  // Form fields
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly saveButton: Locator;

  // Navigation
  readonly notificationsLink: Locator;
  readonly usageLink: Locator;
  readonly integrationsLink: Locator;
  readonly securityLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /profile/i });

    // Form fields (adjust selectors based on actual implementation)
    this.firstNameInput = page.getByLabel(/first name/i);
    this.lastNameInput = page.getByLabel(/last name/i);
    this.emailInput = page.getByLabel(/email/i);
    this.saveButton = page.getByRole("button", { name: /save|update/i });

    // Sub-navigation
    this.notificationsLink = page.getByRole("link", {
      name: /notifications/i,
    });
    this.usageLink = page.getByRole("link", { name: /usage/i });
    this.integrationsLink = page.getByRole("link", { name: /integrations/i });
    this.securityLink = page.getByRole("link", { name: /security/i });
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/${slug}/settings/profile`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }): Promise<void> {
    if (data.firstName) {
      await this.firstNameInput.fill(data.firstName);
    }
    if (data.lastName) {
      await this.lastNameInput.fill(data.lastName);
    }
    if (data.email) {
      await this.emailInput.fill(data.email);
    }

    await this.saveButton.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async navigateToNotifications(): Promise<void> {
    await this.notificationsLink.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async navigateToUsage(): Promise<void> {
    await this.usageLink.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async navigateToIntegrations(): Promise<void> {
    await this.integrationsLink.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async navigateToSecurity(): Promise<void> {
    await this.securityLink.click();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
