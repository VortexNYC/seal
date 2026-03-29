import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Locator, Page } from "@playwright/test";

import { waitForClerkConvexToken } from "../../fixtures/auth-helpers";

export class DocumentsListPage {
  readonly page: Page;
  readonly createDocumentButton: Locator;
  readonly documentTable: Locator;
  readonly searchInput: Locator;
  readonly documentRows: Locator;
  readonly emptyDocumentsState: Locator;
  readonly authRequiredError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createDocumentButton = page
      .getByRole("button", {
        name: /upload document|create document|new document/i,
      })
      .first();
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
      if (!recovered) {
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

    const uploadDialog = this.page.getByRole("dialog", { name: /upload documents/i });
    const dialogFileInput = uploadDialog.locator('input[type="file"]');

    // Keep document names unique so repeated runs create new rows even with seeded files.
    const fileBuffer = readFileSync(resolve(process.cwd(), pdfPath));
    const fileName = `sample-document-${Date.now()}.pdf`;
    await dialogFileInput.setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: fileBuffer,
    });

    const uploadPdfButton = uploadDialog.getByRole("button", { name: /upload pdf/i });
    if ((await uploadPdfButton.count()) > 0) {
      await this.waitForUploadDialogReady(uploadDialog, uploadPdfButton, fileName);
      await uploadPdfButton.click();
      await uploadDialog.waitFor({ state: "hidden", timeout: 30000 }).catch(() => {
        // Fallback if the dialog remains open; continue to wait on row creation.
      });
    }

    const start = Date.now();
    const timeout = 30000;
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
      await this.waitForAnyDocumentRow(30000).catch(() => {
        // Keep the behavior explicit if rows still do not appear.
        throw new Error("Timed out waiting for document row to appear after upload.");
      });
    }

    return fileName;
  }

  async ensureAtLeastOneDocument(pdfPath: string): Promise<void> {
    const initialState = await this.waitForDocumentListResolution();
    if (initialState === "rows") return;

    await this.createDocument(pdfPath);
    await this.documentRows.first().waitFor({ state: "visible", timeout: 30000 });
  }

  getDocumentRows(): Locator {
    return this.documentRows;
  }

  async getDocumentRowCount(): Promise<number> {
    return await this.documentRows.count();
  }

  async waitForAnyDocumentRow(timeoutMs = 30000): Promise<void> {
    await this.documentRows.first().waitFor({ state: "visible", timeout: timeoutMs });
  }

  getDocumentRowByName(documentName: string): Locator {
    return this.documentRows.filter({ hasText: documentName }).first();
  }

  async getFirstDocumentName(): Promise<string | null> {
    const firstRow = this.documentRows.first();
    await firstRow.waitFor({ state: "visible", timeout: 30000 });

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
    await row.waitFor({ state: "visible", timeout: 30000 });
    await row.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async openFirstDocument(): Promise<void> {
    await this.documentRows.first().waitFor({ state: "visible", timeout: 30000 });
    await this.documentRows.first().click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async openFirstDocumentActionsMenu(): Promise<void> {
    const firstRow = this.documentRows.first();
    await firstRow.waitFor({ state: "visible", timeout: 30000 });
    await firstRow.getByRole("button", { name: /document actions for/i }).click();
  }

  async getDocumentCount(): Promise<number> {
    const rows = await this.documentRows.count();
    return rows;
  }

  private async waitForDocumentListResolution(timeoutMs = 15000): Promise<"rows" | "empty"> {
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
    timeoutMs = 15000,
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
