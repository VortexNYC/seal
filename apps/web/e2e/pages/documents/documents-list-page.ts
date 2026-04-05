import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Locator, Page } from "@playwright/test";

import { waitForClerkConvexToken } from "../../fixtures/auth-helpers";

export class DocumentsListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createDocumentButton: Locator;
  readonly draftsFilterButton: Locator;
  readonly documentTable: Locator;
  readonly searchInput: Locator;
  readonly documentRows: Locator;
  readonly emptyDocumentsState: Locator;
  readonly authRequiredError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Documents" });
    this.createDocumentButton = page
      .getByRole("button", {
        name: /upload document|create document|new document/i,
      })
      .first();
    this.draftsFilterButton = page.getByRole("button", { name: "Drafts", exact: true });
    this.documentTable = page.locator("table");
    this.searchInput = page.getByPlaceholder("Search documents by name or description...");
    this.documentRows = page.locator("table tbody tr");
    this.emptyDocumentsState = page.getByText(/^No documents yet$/);
    this.authRequiredError = page.getByText(/authentication required/i).first();
  }

  async goto(slug: string): Promise<void> {
    const targetUrl = `/${slug}/documents`;

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.page.goto(targetUrl, { waitUntil: "domcontentloaded" });

      const recovered = await this.recoverFromAuthError(targetUrl);
      if (!recovered && (await this.waitForDocumentsShell().catch(() => false))) {
        return;
      }
    }

    throw new Error(
      "Documents page stayed on an authentication error after multiple recovery attempts.",
    );
  }

  async createDocument(pdfPath: string): Promise<string> {
    const existingCount = await this.getDocumentRowCount();

    await this.createDocumentButton.click();

    const uploadDialog = this.page.getByRole("dialog", {
      name: /upload documents/i,
    });

    // Fail fast: check for quota limit error before attempting upload
    const quotaError = uploadDialog.getByText(/monthly document limit/i);
    if (await quotaError.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Close dialog and throw identifiable error for createDocumentOrFallback
      const cancelButton = uploadDialog.getByRole("button", { name: /cancel|close/i }).first();
      await cancelButton.click().catch(() => {});
      throw new Error("monthly document limit");
    }

    const dialogFileInput = uploadDialog.locator('input[type="file"]');

    // Keep document names unique so repeated runs create new rows even with seeded files.
    const fileBuffer = readFileSync(resolve(process.cwd(), pdfPath));
    const fileName = `sample-document-${Date.now()}.pdf`;
    await dialogFileInput.setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: fileBuffer,
    });

    // Check again after file selection — quota error can appear after file is selected
    if (await quotaError.isVisible({ timeout: 500 }).catch(() => false)) {
      const cancelButton = uploadDialog.getByRole("button", { name: /cancel|close/i }).first();
      await cancelButton.click().catch(() => {});
      throw new Error("monthly document limit");
    }

    const uploadPdfButton = uploadDialog.getByRole("button", {
      name: /upload pdf/i,
    });
    if ((await uploadPdfButton.count()) > 0) {
      await this.waitForUploadDialogReady(uploadDialog, uploadPdfButton, fileName);
      await uploadPdfButton.click();
      await uploadDialog.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {
        // Fallback if the dialog remains open; continue to wait on row creation.
      });
    }

    const start = Date.now();
    const timeout = 10000;
    let rowDetectedWithName = false;
    while (Date.now() - start < timeout) {
      const isFileVisible = await this.page
        .getByText(fileName)
        .isVisible()
        .catch(() => false);
      if (isFileVisible) {
        rowDetectedWithName = true;
        break;
      }

      const latestCount = await this.getDocumentRowCount();
      if (latestCount > existingCount) {
        break;
      }
      await this.page.waitForTimeout(250);
    }

    if (!rowDetectedWithName) {
      await this.waitForAnyDocumentRow(10000).catch(() => {
        // Keep the behavior explicit if rows still do not appear.
        throw new Error("Timed out waiting for document row to appear after upload.");
      });
    }

    return fileName;
  }

  async ensureAtLeastOneDocument(pdfPath: string): Promise<void> {
    const initialState = await this.waitForDocumentListResolution();
    if (initialState === "rows") return;

    try {
      await this.createDocument(pdfPath);
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("monthly document limit"))) {
        throw error;
      }
      // Quota exceeded — existing documents should be present from previous runs
    }

    await this.documentRows.first().waitFor({ state: "visible", timeout: 10000 });
  }

  getDocumentRows(): Locator {
    return this.documentRows;
  }

  async getDocumentRowCount(): Promise<number> {
    return await this.documentRows.count();
  }

  async waitForAnyDocumentRow(timeoutMs = 10000): Promise<void> {
    await this.documentRows.first().waitFor({ state: "visible", timeout: timeoutMs });
  }

  getDocumentRowByName(documentName: string): Locator {
    return this.documentRows.filter({ hasText: documentName }).first();
  }

  async getFirstDocumentName(): Promise<string | null> {
    const firstRow = this.documentRows.first();
    await firstRow.waitFor({ state: "visible", timeout: 10000 });

    const name = await firstRow.locator("td").nth(1).locator("p").first().textContent();
    return name?.trim() ?? null;
  }

  async searchDocuments(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async openDocument(documentName: string): Promise<void> {
    const namedRows = this.page.locator("table tbody tr").filter({ hasText: documentName });
    const row = (await namedRows.count()) > 0 ? namedRows.first() : this.documentRows.first();
    await row.waitFor({ state: "visible", timeout: 10000 });
    await row.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async openFirstDocument(): Promise<void> {
    await this.documentRows.first().waitFor({ state: "visible", timeout: 10000 });
    await this.documentRows.first().click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async openFirstDocumentActionsMenu(): Promise<void> {
    const firstRow = this.documentRows.first();
    await firstRow.waitFor({ state: "visible", timeout: 10000 });
    await firstRow.getByRole("button", { name: /document actions for/i }).click();
  }

  async deleteDocument(documentName: string): Promise<void> {
    const row = this.documentRows.filter({ hasText: documentName }).first();
    await row.waitFor({ state: "visible", timeout: 10000 });
    await row.getByRole("button", { name: /document actions for/i }).click();
    await this.page.getByRole("menuitem", { name: /^delete$/i }).click();
    // Confirm the AlertDialog
    await this.page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 5000 });
    await this.page.getByRole("button", { name: /^delete$/i }).click();
    // Wait for the row to disappear
    await row.waitFor({ state: "hidden", timeout: 10000 });
  }

  async getDocumentCount(): Promise<number> {
    const rows = await this.documentRows.count();
    return rows;
  }

  private async waitForDocumentListResolution(timeoutMs = 5000): Promise<"rows" | "empty"> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await this.recoverFromAuthError()) {
        continue;
      }

      if ((await this.documentRows.count()) > 0) {
        return "rows";
      }

      if (await this.emptyDocumentsState.isVisible().catch(() => false)) {
        return "empty";
      }

      await this.page.waitForTimeout(250);
    }

    throw new Error(
      "Timed out waiting for the documents list to resolve to rows or an empty state.",
    );
  }

  private async waitForDocumentsShell(timeoutMs = 10000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await this.authRequiredError.isVisible().catch(() => false)) {
        return false;
      }

      const shellReady =
        (await this.heading.isVisible().catch(() => false)) &&
        ((await this.createDocumentButton.isVisible().catch(() => false)) ||
          (await this.searchInput.isVisible().catch(() => false)) ||
          (await this.draftsFilterButton.isVisible().catch(() => false)) ||
          (await this.documentRows
            .first()
            .isVisible()
            .catch(() => false)) ||
          (await this.emptyDocumentsState.isVisible().catch(() => false)));

      if (shellReady) {
        return true;
      }

      await this.page.waitForTimeout(250);
    }

    return false;
  }

  private async recoverFromAuthError(targetUrl?: string): Promise<boolean> {
    const hasAuthError = await this.authRequiredError.isVisible().catch(() => false);

    if (!hasAuthError) {
      return false;
    }

    await waitForClerkConvexToken(this.page);

    if (targetUrl) {
      await this.page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    } else {
      await this.page.reload({ waitUntil: "domcontentloaded" });
    }

    return true;
  }

  private async waitForUploadDialogReady(
    uploadDialog: Locator,
    uploadPdfButton: Locator,
    fileName: string,
    timeoutMs = 5000,
  ): Promise<void> {
    const selectedFile = uploadDialog.getByText(fileName, { exact: true });
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const fileIsListed = await selectedFile.isVisible().catch(() => false);
      if (fileIsListed && (await uploadPdfButton.isEnabled().catch(() => false))) {
        return;
      }

      await this.page.waitForTimeout(250);
    }

    throw new Error("Timed out waiting for the upload dialog to register the selected PDF.");
  }
}
