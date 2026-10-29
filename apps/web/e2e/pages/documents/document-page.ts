import { expect, type Locator, type Page } from "@playwright/test";

import {
  FIELD_TYPE_LABELS,
  type FieldType,
} from "../../../src/lib/field-types";
import { waitForApiResponse } from "../../fixtures/api-helpers";

const PRIMARY_FIELD_TYPES: readonly FieldType[] = [
  "signature",
  "initials",
  "name",
  "email",
  "date",
  "text",
  "checkbox",
  "date_signed",
];

const OPTION_FIELD_TYPES: readonly FieldType[] = [
  "checkbox",
  "dropdown",
  "radio",
  "multi_select",
];

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
  readonly fitButton: Locator;
  readonly recipientsSectionButton: Locator;
  readonly detailsSectionButton: Locator;
  readonly activitySectionButton: Locator;
  readonly addFieldButton: Locator;
  readonly sendButton: Locator;
  readonly addMyselfAsSignerButton: Locator;
  readonly recipientSelectorDialog: Locator;
  readonly placeFieldButton: Locator;
  selectedFieldType: FieldType;

  constructor(page: Page) {
    this.page = page;
    this.documentTitle = page.locator('[data-testid="document-title"]');
    this.documentCanvas = page.locator("canvas");
    this.documentDropTarget = page
      .locator('[data-testid="document-canvas-field-overlay"]')
      .first();
    this.documentPreview = page
      .locator('[data-kumo-docs="viewer-shell"]')
      .first();
    this.backButton = page.getByRole("button", { name: /^Back$/ });
    this.zoomInButton = page.getByRole("button", { name: "Zoom in" });
    this.zoomOutButton = page.getByRole("button", { name: "Zoom out" });
    this.zoomLevelSelect = page.getByRole("combobox").first();
    this.mobileZoomLevel = page
      .locator("span:not([data-slot='select-value'])")
      .filter({ hasText: /^\d+%$/ })
      .first();
    this.fitButton = page.getByRole("button", { name: "Fit" });
    this.recipientsSectionButton = page.getByRole("button", {
      name: /^Recipients/,
    });
    this.detailsSectionButton = page.getByRole("button", { name: /^Details$/ });
    this.activitySectionButton = page.getByRole("button", {
      name: /^Activity/,
    });
    this.addFieldButton = page.getByRole("button", { name: /add field/i });
    this.sendButton = page.getByRole("button", { name: /send/i });
    this.addMyselfAsSignerButton = page.getByRole("button", {
      name: /add myself as signer/i,
    });
    this.recipientSelectorDialog = page.getByRole("dialog", {
      name: /assign field to recipient/i,
    });
    this.placeFieldButton = page.getByRole("button", { name: /place field/i });
    this.selectedFieldType = "signature";
  }

  async goto(slug: string, documentId: string): Promise<void> {
    await this.page.goto(`/${slug}/documents/${documentId}`, {
      waitUntil: "domcontentloaded",
    });
  }

  async addSignatureField(x: number, y: number): Promise<void> {
    await this.placeCatalogField(this.selectedFieldType, x, y);
  }

  async selectFieldType(fieldType: FieldType): Promise<void> {
    this.selectedFieldType = fieldType;
    await this.ensureSignerAvailable();

    if (!PRIMARY_FIELD_TYPES.includes(fieldType)) {
      await this.expandMoreFields();
    }

    const fieldButton = this.fieldTypeButton(fieldType);
    await fieldButton.waitFor({ state: "visible", timeout: 5000 });
    await expect(fieldButton).toBeEnabled();
  }

  /** Open the "More fields" section so non-primary types are visible. */
  async expandMoreFields(): Promise<void> {
    const toggle = this.page.getByRole("button", {
      name: /more fields/i,
    });
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    }
  }

  fieldTypeButton(fieldType: FieldType): Locator {
    return this.page.getByRole("button", {
      name: FIELD_TYPE_LABELS[fieldType],
      exact: true,
    });
  }

  /**
   * Drag a catalog field type onto the canvas. For checkbox/dropdown/radio
   * the options dialog opens — `options` supplies the option labels to save.
   */
  async placeCatalogField(
    fieldType: FieldType,
    x: number,
    y: number,
    opts: { options?: string[] } = {}
  ): Promise<void> {
    this.selectedFieldType = fieldType;
    await this.ensureSignerAvailable();

    if (!PRIMARY_FIELD_TYPES.includes(fieldType)) {
      await this.expandMoreFields();
    }

    const fieldButton = this.fieldTypeButton(fieldType);
    await fieldButton.waitFor({ state: "visible", timeout: 5000 });
    await expect(fieldButton).toBeEnabled();

    const dropTargetBox = await this.documentDropTarget.boundingBox();
    if (!dropTargetBox) {
      throw new Error(
        "Could not determine the PDF page bounds for field placement."
      );
    }

    const isOptionType = OPTION_FIELD_TYPES.includes(fieldType);
    // Non-option types POST /signature-fields inside the drop handler —
    // register the waiter before dispatching drop or it races the request.
    const createdResponse = isOptionType
      ? null
      : waitForApiResponse(this.page, "/signature-fields");

    // Real HTML5 drag — synthesizes actual dataTransfer, so the drop
    // handler's getData("fieldType") resolves (dispatchEvent does not).
    await fieldButton.dragTo(this.documentDropTarget, {
      targetPosition: { x, y },
    });

    // Multi-signer docs still show the assign dialog; a sole signer
    // auto-assigns and skips it. Keep the probe short — it runs per field.
    await this.recipientSelectorDialog
      .waitFor({ state: "visible", timeout: 1200 })
      .then(async () => {
        await this.placeFieldButton.click();
        await this.recipientSelectorDialog
          .waitFor({ state: "hidden", timeout: 5000 })
          .catch(() => {});
      })
      .catch(() => {});

    if (isOptionType) {
      const optionsDialog = this.page.getByRole("dialog", {
        name: /options/i,
      });
      await optionsDialog.waitFor({ state: "visible", timeout: 5000 });
      const labels = opts.options ?? ["Option A", "Option B"];
      for (const label of labels) {
        await this.page.getByRole("button", { name: /add option/i }).click();
        await this.page
          .locator('input[placeholder="Enter option label..."]')
          .last()
          .fill(label);
      }
      const optionsCreated = waitForApiResponse(this.page, "/signature-fields");
      await this.page.getByRole("button", { name: /^save$/i }).click();
      await optionsCreated;
      await optionsDialog
        .waitFor({ state: "hidden", timeout: 5000 })
        .catch(() => {});
    } else {
      await createdResponse;
    }
  }

  async sendDocument(): Promise<void> {
    await this.sendButton.click();
    await waitForApiResponse(this.page, "/send");
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
    // Wait for the document page to fully render. Race viewer shell against
    // the Fields collapsible which is always present on draft detail.
    await Promise.race([
      this.documentPreview.waitFor({ state: "visible", timeout: 10000 }),
      this.page
        .getByRole("button", { name: /^Fields/ })
        .waitFor({ state: "visible", timeout: 10000 }),
    ]);
    // Canvas may take an extra beat to paint after the wrapper appears.
    await this.documentCanvas
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => {
        /* canvas may not exist for non-PDF docs; continue */
      });
    await this.page.waitForLoadState("domcontentloaded");
  }

  private get selectedFieldLabel(): string {
    return FIELD_TYPE_LABELS[this.selectedFieldType];
  }

  private async ensureSignerAvailable(): Promise<void> {
    // The button lives inside the Recipients collapsible — expand it only
    // when actually collapsed (a blind click would collapse it instead).
    if (!(await this.addMyselfAsSignerButton.isVisible().catch(() => false))) {
      const recipientsTrigger = this.page.getByRole("button", {
        name: /^recipients/i,
      });
      const expanded = await recipientsTrigger
        .getAttribute("aria-expanded")
        .catch(() => null);
      if (expanded === "false") {
        await recipientsTrigger.click();
      }
      await this.addMyselfAsSignerButton
        .waitFor({ state: "visible", timeout: 3000 })
        .catch(() => {});
    }

    const needsSigner = await this.addMyselfAsSignerButton
      .isVisible()
      .catch(() => false);

    if (!needsSigner) {
      return;
    }

    await this.addMyselfAsSignerButton.click();
    const recipientsPosted = waitForApiResponse(this.page, "/recipients");
    await this.page.getByRole("button", { name: /add as signer/i }).click();
    await recipientsPosted;
    await this.addMyselfAsSignerButton
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => {});
  }
}
