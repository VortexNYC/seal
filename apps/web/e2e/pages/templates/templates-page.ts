import type { Locator, Page } from "@playwright/test";

/**
 * Templates list page (/{slug}/templates).
 *
 * Note: there is no "Create Template" button on this page. Templates are
 * created from the document editor via "Save as Template" (see the doc-page
 * helpers). This object covers the list/view side only.
 */
export class TemplatesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly templateListContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", {
      name: /^Templates$/,
      exact: true,
    });
    // The page renders templates either as table rows or grid cards depending
    // on view mode; both surface a per-row/per-card "Template actions for X"
    // button, which is the most stable cross-view anchor.
    this.templateListContainer = page.locator("body");
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/${slug}/templates`);
    await this.page.waitForLoadState("domcontentloaded");
    await this.heading.waitFor({ state: "visible", timeout: 10_000 });
  }

  /**
   * Resolve the row/card for a named template. Works in both table and grid
   * view because both render `aria-label="Template actions for <name>"`.
   */
  templateActionsButton(templateName: string): Locator {
    return this.page.getByRole("button", {
      name: `Template actions for ${templateName}`,
    });
  }

  async expectTemplateVisible(
    templateName: string,
    timeoutMs = 10_000
  ): Promise<void> {
    await this.page.getByText(templateName, { exact: false }).first().waitFor({
      state: "visible",
      timeout: timeoutMs,
    });
  }
}

/**
 * Drive the "Save as Template" flow from the document editor. The button
 * only appears when `canEdit && signatureFields.length > 0`, so the caller
 * must seed the document with at least one signature field first
 * (see `createSignableDocument` in the document factory).
 */
export async function saveDocumentAsTemplate(
  page: Page,
  options: { templateName: string; description?: string }
): Promise<void> {
  await page.getByRole("button", { name: /save as template/i }).click();

  const dialog = page.getByRole("dialog", { name: /save as template/i });
  await dialog.waitFor({ state: "visible", timeout: 5_000 });

  const nameInput = dialog.getByLabel(/template name/i);
  await nameInput.fill(options.templateName);

  if (options.description) {
    await dialog.getByLabel(/description/i).fill(options.description);
  }

  await dialog.getByRole("button", { name: /save template/i }).click();
  await dialog.waitFor({ state: "hidden", timeout: 10_000 });
}
