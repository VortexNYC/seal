import type { Locator, Page } from "@playwright/test";

import { waitForConvexMutation } from "../../fixtures/convex-helpers";

export class DocumentPage {
  readonly page: Page;
  readonly documentTitle: Locator;
  readonly documentCanvas: Locator;
  readonly addFieldButton: Locator;
  readonly sendButton: Locator;
  readonly fieldTypeDropdown: Locator;

  constructor(page: Page) {
    this.page = page;
    this.documentTitle = page.locator('[data-testid="document-title"]');
    this.documentCanvas = page.locator("canvas");
    this.addFieldButton = page.getByRole("button", { name: /add field/i });
    this.sendButton = page.getByRole("button", { name: /send/i });
    this.fieldTypeDropdown = page.locator('[data-testid="field-type-select"]');
  }

  async goto(slug: string, documentId: string): Promise<void> {
    await this.page.goto(`/${slug}/documents/${documentId}`);
    await this.page.waitForLoadState("networkidle");
  }

  async addSignatureField(x: number, y: number): Promise<void> {
    // Click on canvas to add field
    await this.documentCanvas.click({ position: { x, y } });

    // Wait for field to be created
    await waitForConvexMutation(this.page, "createSignatureField");
  }

  async selectFieldType(fieldType: "signature" | "text" | "date" | "checkbox"): Promise<void> {
    await this.fieldTypeDropdown.click();
    await this.page.getByRole("option", { name: fieldType }).click();
  }

  async sendDocument(): Promise<void> {
    await this.sendButton.click();
    await waitForConvexMutation(this.page, "sendDocument");
  }

  async getDocumentTitle(): Promise<string> {
    return (await this.documentTitle.textContent()) || "";
  }

  async waitForDocumentLoad(): Promise<void> {
    // Wait for PDF to render
    await this.documentCanvas.waitFor({ state: "visible" });
    await this.page.waitForLoadState("networkidle");
  }
}
