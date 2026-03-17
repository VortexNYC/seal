import type { Locator, Page } from "@playwright/test";

import { waitForConvexMutation } from "../../fixtures/convex-helpers";

export class DocumentPage {
  readonly page: Page;
  readonly documentTitle: Locator;
  readonly documentCanvas: Locator;
  readonly documentPreview: Locator;
  readonly backButton: Locator;
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly zoomLevelSelect: Locator;
  readonly resetZoomButton: Locator;
  readonly fitButton: Locator;
  readonly recipientsSectionButton: Locator;
  readonly detailsSectionButton: Locator;
  readonly activitySectionButton: Locator;
  readonly addFieldButton: Locator;
  readonly sendButton: Locator;
  readonly fieldTypeDropdown: Locator;

  constructor(page: Page) {
    this.page = page;
    this.documentTitle = page.locator('[data-testid="document-title"]');
    this.documentCanvas = page.locator("canvas");
    this.documentPreview = page.getByText("Document Preview");
    this.backButton = page.getByRole("button", { name: /^Back$/ });
    this.zoomInButton = page.getByRole("button", { name: "Zoom in" });
    this.zoomOutButton = page.getByRole("button", { name: "Zoom out" });
    this.zoomLevelSelect = page.getByRole("combobox").first();
    this.resetZoomButton = page.getByRole("button", { name: "Reset" });
    this.fitButton = page.getByRole("button", { name: "Fit" });
    this.recipientsSectionButton = page.getByRole("button", { name: /^Recipients/ });
    this.detailsSectionButton = page.getByRole("button", { name: /^Details$/ });
    this.activitySectionButton = page.getByRole("button", { name: /^Activity/ });
    this.addFieldButton = page.getByRole("button", { name: /add field/i });
    this.sendButton = page.getByRole("button", { name: /send/i });
    this.fieldTypeDropdown = page.locator('[data-testid="field-type-select"]');
  }

  async goto(slug: string, documentId: string): Promise<void> {
    await this.page.goto(`/${slug}/documents/${documentId}`, { waitUntil: "domcontentloaded" });
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
    await this.documentPreview.waitFor({ state: "visible", timeout: 30000 });
    await this.documentCanvas.waitFor({ state: "visible" });
    await this.page.waitForLoadState("domcontentloaded");
  }
}
