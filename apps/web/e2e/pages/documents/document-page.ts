import { expect, type Locator, type Page } from "@playwright/test";

import { waitForConvexMutation } from "../../fixtures/convex-helpers";

export class DocumentPage {
  readonly page: Page;
  readonly documentTitle: Locator;
  readonly documentCanvas: Locator;
  readonly documentDropTarget: Locator;
  readonly documentPreview: Locator;
  readonly backButton: Locator;
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly zoomLevelSelect: Locator;
  readonly mobileZoomLevel: Locator;
  readonly resetZoomButton: Locator;
  readonly fitButton: Locator;
  readonly recipientsSectionButton: Locator;
  readonly detailsSectionButton: Locator;
  readonly activitySectionButton: Locator;
  readonly addFieldButton: Locator;
  readonly sendButton: Locator;
  readonly addMyselfAsSignerButton: Locator;
  readonly recipientSelectorDialog: Locator;
  readonly placeFieldButton: Locator;
  selectedFieldType: "signature" | "text" | "date" | "checkbox";

  constructor(page: Page) {
    this.page = page;
    this.documentTitle = page.locator('[data-testid="document-title"]');
    this.documentCanvas = page.locator("canvas");
    this.documentDropTarget = page.locator(".react-pdf__Page").first();
    this.documentPreview = page.getByText("Document Preview").first();
    this.backButton = page.getByRole("button", { name: /^Back$/ });
    this.zoomInButton = page.getByRole("button", { name: "Zoom in" });
    this.zoomOutButton = page.getByRole("button", { name: "Zoom out" });
    this.zoomLevelSelect = page.getByRole("combobox").first();
    this.mobileZoomLevel = page
      .locator("span:not([data-slot='select-value'])")
      .filter({ hasText: /^\d+%$/ })
      .first();
    this.resetZoomButton = page.getByRole("button", { name: "Reset" });
    this.fitButton = page.getByRole("button", { name: "Fit" });
    this.recipientsSectionButton = page.getByRole("button", { name: /^Recipients/ });
    this.detailsSectionButton = page.getByRole("button", { name: /^Details$/ });
    this.activitySectionButton = page.getByRole("button", { name: /^Activity/ });
    this.addFieldButton = page.getByRole("button", { name: /add field/i });
    this.sendButton = page.getByRole("button", { name: /send/i });
    this.addMyselfAsSignerButton = page.getByRole("button", { name: /add myself as signer/i });
    this.recipientSelectorDialog = page.getByRole("dialog", { name: /assign field to recipient/i });
    this.placeFieldButton = page.getByRole("button", { name: /place field/i });
    this.selectedFieldType = "signature";
  }

  async goto(slug: string, documentId: string): Promise<void> {
    await this.page.goto(`/${slug}/documents/${documentId}`, { waitUntil: "domcontentloaded" });
  }

  async addSignatureField(x: number, y: number): Promise<void> {
    await this.ensureSignerAvailable();

    const fieldButton = this.page.getByRole("button", {
      name: new RegExp(`^${this.selectedFieldLabel}$`, "i"),
    });
    await fieldButton.waitFor({ state: "visible", timeout: 5000 });
    await expect(fieldButton).toBeEnabled();
    const dropTargetBox = await this.documentDropTarget.boundingBox();
    if (!dropTargetBox) {
      throw new Error("Could not determine the PDF page bounds for field placement.");
    }

    const dropClientX = dropTargetBox.x + x;
    const dropClientY = dropTargetBox.y + y;
    const dataTransfer = await this.page.evaluateHandle(() => new DataTransfer());

    await fieldButton.dispatchEvent("dragstart", { dataTransfer });
    await this.documentDropTarget.dispatchEvent("dragover", {
      dataTransfer,
      clientX: dropClientX,
      clientY: dropClientY,
    });
    await this.documentDropTarget.dispatchEvent("drop", {
      dataTransfer,
      clientX: dropClientX,
      clientY: dropClientY,
    });

    await this.recipientSelectorDialog.waitFor({ state: "visible", timeout: 5000 });
    await this.placeFieldButton.click();

    // Wait for field to be created
    await waitForConvexMutation(this.page, "createField");
    await this.recipientSelectorDialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }

  async selectFieldType(fieldType: "signature" | "text" | "date" | "checkbox"): Promise<void> {
    this.selectedFieldType = fieldType;
    await this.ensureSignerAvailable();

    const fieldButton = this.page.getByRole("button", {
      name: new RegExp(`^${this.selectedFieldLabel}$`, "i"),
    });
    await fieldButton.waitFor({ state: "visible", timeout: 5000 });
    await expect(fieldButton).toBeEnabled();
  }

  async sendDocument(): Promise<void> {
    await this.sendButton.click();
    await waitForConvexMutation(this.page, "sendDocument");
  }

  async getDocumentTitle(): Promise<string> {
    return (await this.documentTitle.textContent()) || "";
  }

  async getVisibleZoomText(): Promise<string> {
    if (await this.zoomLevelSelect.isVisible().catch(() => false)) {
      return ((await this.zoomLevelSelect.textContent()) || "").trim();
    }

    if (await this.mobileZoomLevel.isVisible().catch(() => false)) {
      return ((await this.mobileZoomLevel.textContent()) || "").trim();
    }

    // Neither visible yet — wait briefly for either
    await this.zoomLevelSelect
      .or(this.mobileZoomLevel)
      .first()
      .waitFor({ state: "visible", timeout: 3000 });

    if (await this.zoomLevelSelect.isVisible().catch(() => false)) {
      return ((await this.zoomLevelSelect.textContent()) || "").trim();
    }
    return ((await this.mobileZoomLevel.textContent()) || "").trim();
  }

  async hasDesktopOnlyZoomControls(): Promise<boolean> {
    return await this.fitButton.isVisible().catch(() => false);
  }

  async waitForDocumentLoad(): Promise<void> {
    // Wait for the document page to fully render. The "Document Preview" heading
    // appears once the PDF URL resolves OR in the loading placeholder, so race
    // it against the Signature Fields collapsible button which is always present.
    await Promise.race([
      this.documentPreview.waitFor({ state: "visible", timeout: 10000 }),
      this.page
        .getByRole("button", { name: /Signature Fields/ })
        .waitFor({ state: "visible", timeout: 10000 }),
    ]);
    // Canvas may take an extra beat to paint after the wrapper appears.
    await this.documentCanvas.waitFor({ state: "visible", timeout: 5000 }).catch(() => {
      /* canvas may not exist for non-PDF docs; continue */
    });
    await this.page.waitForLoadState("domcontentloaded");
  }

  private get selectedFieldLabel(): string {
    switch (this.selectedFieldType) {
      case "checkbox":
        return "Checkbox";
      case "date":
        return "Date";
      case "text":
        return "Text";
      default:
        return "Signature";
    }
  }

  private async ensureSignerAvailable(): Promise<void> {
    const needsSigner = await this.addMyselfAsSignerButton.isVisible().catch(() => false);

    if (!needsSigner) {
      return;
    }

    await this.addMyselfAsSignerButton.click();
    await this.page.getByRole("button", { name: /add as signer/i }).click();
    await this.addMyselfAsSignerButton.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }
}
