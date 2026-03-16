import type { Locator, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export class DocumentsListPage {
  readonly page: Page;
  readonly createDocumentButton: Locator;
  readonly documentTable: Locator;
  readonly searchInput: Locator;
  readonly documentRows: Locator;

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
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/${slug}/documents`, { waitUntil: "domcontentloaded" });
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
      await uploadPdfButton.click();
      await uploadDialog.waitFor({ state: "hidden", timeout: 30000 }).catch(() => {
        // Fallback if the dialog remains open; continue to wait on row creation.
      });
    }

    const start = Date.now();
    const timeout = 30000;
    let rowDetectedWithName = false;
    while (Date.now() - start < timeout) {
      const isFileVisible = await this.page.getByText(fileName).isVisible().catch(() => false);
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
    const initialCount = await this.getDocumentRowCount();
    if (initialCount > 0) return;

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
}
