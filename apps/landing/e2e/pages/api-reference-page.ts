import { expect, type Locator, type Page } from "@playwright/test";

export class ApiReferencePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/docs/api-reference");
    await this.waitForReady();
  }

  async waitForReady(): Promise<void> {
    await expect(this.loadingFallback()).toHaveCount(0);
    await expect(this.titleHeading()).toBeVisible();
  }

  downloadJsonButton(): Locator {
    return this.page.getByRole("button", { name: /download openapi document json/i }).first();
  }

  loadingFallback(): Locator {
    return this.page.getByText(/loading api reference/i);
  }

  navigationMenuButton(): Locator {
    return this.page.getByRole("button", { name: /open sidebar|collapse sidebar/i }).first();
  }

  titleHeading(): Locator {
    return this.page.getByRole("heading", { name: /api reference/i }).first();
  }
}
