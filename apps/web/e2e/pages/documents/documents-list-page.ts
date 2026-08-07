import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

import {
  ensureAuthenticatedWorkspaceHome,
  ensureConvexAuth,
} from "../../fixtures/auth-helpers";
import { pollUntil } from "../../fixtures/poll";

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
    this.heading = page.getByRole("heading", {
      name: /^Documents$/,
      exact: true,
    });
    this.createDocumentButton = page
      .getByRole("button", {
        name: /upload document|create document|new document/i,
      })
      .first();
    this.draftsFilterButton = page.getByRole("button", {
      name: "Drafts",
      exact: true,
    });
    this.documentTable = page.locator("table");
    this.searchInput = page.getByPlaceholder(
      "Search documents by name or description..."
    );
    this.documentRows = page.locator("table tbody tr");
    this.emptyDocumentsState = page.getByText(/^No documents yet$/);
    this.authRequiredError = page.getByText(/authentication required/i).first();
  }

  async goto(slug: string): Promise<void> {
    const targetUrl = `/${slug}/documents`;

    await ensureConvexAuth(this.page).catch(async () => {
      await ensureAuthenticatedWorkspaceHome(this.page);
    });

    const attemptNavigation = async (attempt: number): Promise<boolean> => {
      if (attempt >= 3) return false;
      await this.page.goto(targetUrl, { waitUntil: "domcontentloaded" });

      if (await this.waitForDocumentsShell(15000).catch(() => false)) {
        return true;
      }

      if (await this.authRequiredError.isVisible().catch(() => false)) {
        await this.recoverFromAuthError(targetUrl);
      }
      return attemptNavigation(attempt + 1);
    };

    if (await attemptNavigation(0)) return;

    throw new Error(
      "Documents page did not become ready after multiple navigation attempts."
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
      const cancelButton = uploadDialog
        .getByRole("button", { name: /cancel|close/i })
        .first();
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
      const cancelButton = uploadDialog
        .getByRole("button", { name: /cancel|close/i })
        .first();
      await cancelButton.click().catch(() => {});
      throw new Error("monthly document limit");
    }

    const uploadPdfButton = uploadDialog.getByRole("button", {
      name: /upload pdf/i,
    });
    if ((await uploadPdfButton.count()) > 0) {
      await this.waitForUploadDialogReady(
        uploadDialog,
        uploadPdfButton,
        fileName
      );
      await uploadPdfButton.click();
      await uploadDialog
        .waitFor({ state: "hidden", timeout: 10000 })
        .catch(() => {
          // Fallback if the dialog remains open; continue to wait on row creation.
        });
    }

    const rowOutcome = await pollUntil(
      async (): Promise<"named-row" | "row-count" | undefined> => {
        const isFileVisible = await this.page
          .getByText(fileName)
          .isVisible()
          .catch(() => false);
        if (isFileVisible) return "named-row";

        const latestCount = await this.getDocumentRowCount();
        if (latestCount > existingCount) return "row-count";
        return undefined;
      },
      { deadline: Date.now() + 10000, intervalMs: 250 }
    );
    const rowDetectedWithName = rowOutcome === "named-row";

    if (!rowDetectedWithName) {
      await this.waitForAnyDocumentRow(10000).catch(() => {
        // Keep the behavior explicit if rows still do not appear.
        throw new Error(
          "Timed out waiting for document row to appear after upload."
        );
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
      if (
        !(
          error instanceof Error &&
          error.message.includes("monthly document limit")
        )
      ) {
        throw error;
      }
      // Quota exceeded — existing documents should be present from previous runs
    }

    await this.documentRows
      .first()
      .waitFor({ state: "visible", timeout: 10000 });
  }

  getDocumentRows(): Locator {
    return this.documentRows;
  }

  async getDocumentRowCount(): Promise<number> {
    return await this.documentRows.count();
  }

  async waitForAnyDocumentRow(timeoutMs = 10000): Promise<void> {
    await this.documentRows
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
  }

  getDocumentRowByName(documentName: string): Locator {
    return this.documentRows.filter({ hasText: documentName }).first();
  }

  async waitForDocumentRowByName(
    documentName: string,
    timeoutMs = 30000
  ): Promise<Locator> {
    const row = this.getDocumentRowByName(documentName);
    const deadline = Date.now() + timeoutMs;

    const poll = async (attempts: number): Promise<Locator | undefined> => {
      if (Date.now() >= deadline) return undefined;

      if (await row.isVisible().catch(() => false)) {
        return row;
      }

      if (await this.searchInput.isVisible().catch(() => false)) {
        await this.searchInput.fill(documentName);
      }

      await this.page.waitForTimeout(500);

      if (await row.isVisible().catch(() => false)) {
        return row;
      }

      const nextAttempts = attempts + 1;
      if (nextAttempts % 6 === 0) {
        await this.page.reload({ waitUntil: "domcontentloaded" });
      }
      return poll(nextAttempts);
    };

    if (await poll(0)) return row;

    await expect(row).toBeVisible({ timeout: 1000 });
    return row;
  }

  async getFirstDocumentName(): Promise<string | null> {
    const firstRow = this.documentRows.first();
    await firstRow.waitFor({ state: "visible", timeout: 10000 });

    const name = await firstRow
      .locator("td")
      .nth(1)
      .locator("p")
      .first()
      .textContent();
    return name?.trim() ?? null;
  }

  async searchDocuments(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async openDocument(documentName: string): Promise<void> {
    const namedRows = this.page
      .locator("table tbody tr")
      .filter({ hasText: documentName });
    const row =
      (await namedRows.count()) > 0
        ? namedRows.first()
        : this.documentRows.first();
    await row.waitFor({ state: "visible", timeout: 10000 });
    await row.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async openFirstDocument(): Promise<void> {
    await this.documentRows
      .first()
      .waitFor({ state: "visible", timeout: 10000 });
    await this.documentRows.first().click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async openFirstDocumentActionsMenu(): Promise<void> {
    const firstRow = this.documentRows.first();
    await firstRow.waitFor({ state: "visible", timeout: 10000 });
    await firstRow
      .getByRole("button", { name: /document actions for/i })
      .click();
  }

  async deleteDocument(documentName: string): Promise<void> {
    const row = this.documentRows.filter({ hasText: documentName }).first();
    await row.waitFor({ state: "visible", timeout: 10000 });
    await row.getByRole("button", { name: /document actions for/i }).click();
    await this.page.getByRole("menuitem", { name: /^delete$/i }).click();
    // Confirm the AlertDialog
    await this.page
      .getByRole("alertdialog")
      .waitFor({ state: "visible", timeout: 5000 });
    await this.page.getByRole("button", { name: /^delete$/i }).click();
    // Wait for the row to disappear
    await row.waitFor({ state: "hidden", timeout: 10000 });
  }

  async getDocumentCount(): Promise<number> {
    const rows = await this.documentRows.count();
    return rows;
  }

  private async waitForDocumentListResolution(
    timeoutMs = 5000
  ): Promise<"rows" | "empty"> {
    const resolution = await pollUntil(
      async (): Promise<"rows" | "empty" | undefined> => {
        if (await this.recoverFromAuthError()) {
          return undefined;
        }

        if ((await this.documentRows.count()) > 0) {
          return "rows";
        }

        if (await this.emptyDocumentsState.isVisible().catch(() => false)) {
          return "empty";
        }

        return undefined;
      },
      { deadline: Date.now() + timeoutMs, intervalMs: 250 }
    );

    if (!resolution) {
      throw new Error(
        "Timed out waiting for the documents list to resolve to rows or an empty state."
      );
    }
    return resolution;
  }

  private async waitForDocumentsShell(timeoutMs = 10000): Promise<boolean> {
    const outcome = await pollUntil(
      async (): Promise<"ready" | "auth-error" | undefined> => {
        const headingVisible = await this.heading
          .isVisible()
          .catch(() => false);
        const createVisible = await this.createDocumentButton
          .isVisible()
          .catch(() => false);
        const searchVisible = await this.searchInput
          .isVisible()
          .catch(() => false);
        const draftsVisible = await this.draftsFilterButton
          .isVisible()
          .catch(() => false);
        const rowsVisible = await this.documentRows
          .first()
          .isVisible()
          .catch(() => false);
        const emptyVisible = await this.emptyDocumentsState
          .isVisible()
          .catch(() => false);
        const shellReady =
          headingVisible &&
          (createVisible ||
            searchVisible ||
            draftsVisible ||
            rowsVisible ||
            emptyVisible);

        if (shellReady) {
          return "ready";
        }

        const authErrorVisible = await this.authRequiredError
          .isVisible()
          .catch(() => false);
        if (authErrorVisible) {
          return "auth-error";
        }

        return undefined;
      },
      { deadline: Date.now() + timeoutMs, intervalMs: 250 }
    );

    return outcome === "ready";
  }

  private async recoverFromAuthError(targetUrl?: string): Promise<boolean> {
    const hasAuthError = await this.authRequiredError
      .isVisible()
      .catch(() => false);

    if (!hasAuthError) {
      return false;
    }

    const retryUrl = targetUrl ?? this.page.url();
    const preferredOrganizationSlug = retryUrl.match(/^\/([\w-]+)\//)?.[1];

    await ensureAuthenticatedWorkspaceHome(
      this.page,
      preferredOrganizationSlug
    );
    await this.page.goto(retryUrl, { waitUntil: "domcontentloaded" });

    return true;
  }

  private async waitForUploadDialogReady(
    uploadDialog: Locator,
    uploadPdfButton: Locator,
    fileName: string,
    timeoutMs = 5000
  ): Promise<void> {
    const selectedFile = uploadDialog.getByText(fileName, { exact: true });

    const ready = await pollUntil(
      async () => {
        const fileIsListed = await selectedFile.isVisible().catch(() => false);
        if (
          fileIsListed &&
          (await uploadPdfButton.isEnabled().catch(() => false))
        ) {
          return true;
        }
        return undefined;
      },
      { deadline: Date.now() + timeoutMs, intervalMs: 250 }
    );

    if (!ready) {
      throw new Error(
        "Timed out waiting for the upload dialog to register the selected PDF."
      );
    }
  }
}
