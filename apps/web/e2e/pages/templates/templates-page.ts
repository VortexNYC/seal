import type { Locator, Page } from "@playwright/test";

import { waitForConvexMutation } from "../../fixtures/convex-helpers";

export class TemplatesPage {
  readonly page: Page;
  readonly createTemplateButton: Locator;
  readonly templateGrid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createTemplateButton = page.getByRole("button", {
      name: /create template|new template/i,
    });
    this.templateGrid = page.locator('[data-testid="templates-grid"]');
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/${slug}/templates`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async createTemplate(name: string, pdfPath: string): Promise<void> {
    await this.createTemplateButton.click();

    // Fill template name
    await this.page.fill('[data-testid="template-name"]', name);

    // Upload file
    await this.page.locator('input[type="file"]').setInputFiles(pdfPath);

    // Submit
    await this.page.getByRole("button", { name: /save|create/i }).click();

    await waitForConvexMutation(this.page, "createTemplate");
  }

  async openTemplate(templateName: string): Promise<void> {
    await this.page.getByRole("link", { name: templateName }).click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async useTemplate(templateName: string): Promise<void> {
    // Find template card and click "Use Template" button
    const templateCard = this.page.locator('[data-testid="template-card"]', {
      hasText: templateName,
    });
    await templateCard.getByRole("button", { name: /use template/i }).click();

    await waitForConvexMutation(this.page, "createDocumentFromTemplate");
  }
}
