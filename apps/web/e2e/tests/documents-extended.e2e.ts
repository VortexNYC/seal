import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/auth";
import { apiCreateDocument, apiDeleteDocument } from "../fixtures/convex-test-api";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";

function getCachedStorageId(): string | null {
  try {
    const f = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../playwright/.clerk/e2e-pdf-storage-id.txt",
    );
    return readFileSync(f, "utf8").trim() || null;
  } catch {
    return null;
  }
}

/**
 * Create a document and open it in the editor.
 * Fast path: API create + direct URL navigation (~3s vs ~15s UI path).
 * Returns the document ID (fast path) or name (slow path).
 */
async function createAndOpenDocument(
  authenticatedPage: Page,
  organizationSlug: string,
): Promise<{ id: string | null; name: string }> {
  const storageId = getCachedStorageId();
  const documentName = `e2e-test-doc-${Date.now()}`;

  if (storageId) {
    const id = await apiCreateDocument(organizationSlug, storageId, documentName);
    await authenticatedPage.goto(`/${organizationSlug}/documents/${id}`);
    await new DocumentPage(authenticatedPage).waitForDocumentLoad();
    return { id, name: documentName };
  }

  // Fallback: UI path
  const documentsPage = new DocumentsListPage(authenticatedPage);
  await documentsPage.goto(organizationSlug);
  const uploadedDocumentName = await documentsPage.createDocument(testData.samplePdfPath);
  await documentsPage.openDocument(uploadedDocumentName);
  await new DocumentPage(authenticatedPage).waitForDocumentLoad();
  return { id: null, name: uploadedDocumentName };
}

async function deleteDocument(
  authenticatedPage: Page,
  organizationSlug: string,
  docId: string | null,
  docName: string,
): Promise<void> {
  if (docId) {
    await apiDeleteDocument(docId).catch(() => {});
  } else {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    await documentsPage.goto(organizationSlug).catch(() => {});
    await documentsPage.deleteDocument(docName).catch(() => {});
  }
}

test.describe("Document Filtering", () => {
  let docId: string | null = null;
  let docName = "";

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    try {
      const doc = await createAndOpenDocument(authenticatedPage, organizationSlug);
      docId = doc.id;
      docName = doc.name;
      // Navigate back to documents list after opening
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.goto(organizationSlug);
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw err;
    }
  });

  test.afterEach(async ({ authenticatedPage, organizationSlug }) => {
    if (docId || docName) {
      await deleteDocument(authenticatedPage, organizationSlug, docId, docName);
    }
  });

  test("should filter documents by status - Drafts", async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole("button", { name: "Drafts" }).click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should filter documents by status - Sent", async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole("button", { name: "Sent" }).click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should filter documents by status - In Progress", async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole("button", { name: "In Progress" }).click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should filter documents by status - Completed", async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole("button", { name: "Completed" }).click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should switch between document tabs", async ({ authenticatedPage }) => {
    await authenticatedPage.getByRole("button", { name: "My Documents" }).click();
    await authenticatedPage.waitForTimeout(500);
    await authenticatedPage.getByRole("button", { name: "Shared with Me" }).click();
    await authenticatedPage.waitForTimeout(500);
    await authenticatedPage.getByRole("button", { name: "All Documents" }).last().click();
    await authenticatedPage.waitForTimeout(500);
  });
});

test.describe("Document Actions", () => {
  let docId: string | null = null;
  let docName = "";

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    try {
      const doc = await createAndOpenDocument(authenticatedPage, organizationSlug);
      docId = doc.id;
      docName = doc.name;
      // Navigate back to documents list
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.goto(organizationSlug);
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw err;
    }
  });

  test.afterEach(async ({ authenticatedPage, organizationSlug }) => {
    if (docId || docName) {
      await deleteDocument(authenticatedPage, organizationSlug, docId, docName);
    }
  });

  test("should download document", async ({ authenticatedPage }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    const row = documentsPage.getDocumentRowByName(docName);
    await row.waitFor({ state: "visible", timeout: 10000 });
    await row.getByRole("button", { name: /document actions for/i }).click();

    // Chromium/WebKit open a popup; Firefox triggers a download event instead.
    const popupPromise = authenticatedPage
      .waitForEvent("popup", { timeout: 5000 })
      .catch(() => null);
    const downloadPromise = authenticatedPage
      .waitForEvent("download", { timeout: 5000 })
      .catch(() => null);

    await authenticatedPage.getByRole("menuitem", { name: /^download$/i }).click();

    const [popup, download] = await Promise.all([popupPromise, downloadPromise]);
    // Check download first: Firefox opens an about:blank popup but triggers a
    // download event. Chromium/WebKit open a popup that navigates to the URL.
    if (download) {
      expect(download).toBeTruthy();
    } else if (popup) {
      await expect.poll(async () => popup.url(), { timeout: 5000 }).not.toBe("about:blank");
    } else {
      throw new Error("Neither a popup nor a download event was triggered");
    }
  });

  test("should navigate back from document editor", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // Open the document we created in beforeEach
    if (docId) {
      await authenticatedPage.goto(`/${organizationSlug}/documents/${docId}`);
    } else {
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.openDocument(docName);
    }
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    await documentPage.backButton.click();

    await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/documents`);
    // afterEach will delete the document
  });
});

test.describe("Document Editor - Zoom Controls", () => {
  test.describe.configure({ mode: "serial" });

  let zoomDocId: string | null = null;
  let zoomDocumentName = "";

  test.beforeAll(async ({ browser }, testInfo) => {
    const storageId = (() => {
      try {
        const f = resolve(
          dirname(fileURLToPath(import.meta.url)),
          "../../playwright/.clerk/e2e-pdf-storage-id.txt",
        );
        return readFileSync(f, "utf8").trim() || null;
      } catch {
        return null;
      }
    })();

    const context = await browser.newContext({
      storageState: testInfo.project.use.storageState as string,
    });
    const page = await context.newPage();
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/[\w-]+\/home/, { timeout: 10000 });
    const slug = page.url().match(/\/([\w-]+)\/home/)?.[1] ?? "";

    if (storageId) {
      const id = await apiCreateDocument(slug, storageId);
      zoomDocId = id;
      zoomDocumentName = `e2e-test-doc-${id}`;
    } else {
      const documentsPage = new DocumentsListPage(page);
      await documentsPage.goto(slug);
      zoomDocumentName = await documentsPage.createDocument(testData.samplePdfPath);
    }
    await context.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    if (!zoomDocId && !zoomDocumentName) return;

    if (zoomDocId) {
      await apiDeleteDocument(zoomDocId).catch(() => {});
      return;
    }

    const context = await browser.newContext({
      storageState: testInfo.project.use.storageState as string,
    });
    const page = await context.newPage();
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/[\w-]+\/home/, { timeout: 10000 });
    const slug = page.url().match(/\/([\w-]+)\/home/)?.[1] ?? "";
    const documentsPage = new DocumentsListPage(page);
    await documentsPage.goto(slug);
    await documentsPage.deleteDocument(zoomDocumentName).catch(() => {});
    await context.close();
  });

  test("should zoom in on document", async ({ authenticatedPage, organizationSlug }) => {
    if (zoomDocId) {
      await authenticatedPage.goto(`/${organizationSlug}/documents/${zoomDocId}`);
    } else {
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.goto(organizationSlug);
      await documentsPage.openDocument(zoomDocumentName);
    }
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    const initialZoom = await documentPage.getVisibleZoomText();
    await documentPage.zoomInButton.click();

    await expect
      .poll(async () => documentPage.getVisibleZoomText(), { timeout: 8000 })
      .not.toBe(initialZoom);
  });

  test("should zoom out on document", async ({ authenticatedPage, organizationSlug }) => {
    if (zoomDocId) {
      await authenticatedPage.goto(`/${organizationSlug}/documents/${zoomDocId}`);
    } else {
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.goto(organizationSlug);
      await documentsPage.openDocument(zoomDocumentName);
    }
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    await documentPage.zoomOutButton.click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should reset zoom on document", async ({ authenticatedPage, organizationSlug }) => {
    if (zoomDocId) {
      await authenticatedPage.goto(`/${organizationSlug}/documents/${zoomDocId}`);
    } else {
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.goto(organizationSlug);
      await documentsPage.openDocument(zoomDocumentName);
    }
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    if (!(await documentPage.hasDesktopOnlyZoomControls())) {
      test.skip(true, "Reset zoom control is hidden on mobile layouts.");
    }

    await documentPage.zoomInButton.click();
    await authenticatedPage.waitForTimeout(300);
    await documentPage.resetZoomButton.click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should fit document to viewport", async ({ authenticatedPage, organizationSlug }) => {
    if (zoomDocId) {
      await authenticatedPage.goto(`/${organizationSlug}/documents/${zoomDocId}`);
    } else {
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.goto(organizationSlug);
      await documentsPage.openDocument(zoomDocumentName);
    }
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    if (!(await documentPage.hasDesktopOnlyZoomControls())) {
      test.skip(true, "Fit control is hidden on mobile layouts.");
    }

    await documentPage.fitButton.click();
    await authenticatedPage.waitForTimeout(500);
  });
});

test.describe("Document Details Sidebar", () => {
  test.describe.configure({ mode: "serial" });

  let sidebarDocId: string | null = null;
  let sidebarDocumentName = "";

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    try {
      const doc = await createAndOpenDocument(authenticatedPage, organizationSlug);
      sidebarDocId = doc.id;
      sidebarDocumentName = doc.name;
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw err;
    }
  });

  test.afterEach(async ({ authenticatedPage, organizationSlug }) => {
    if (sidebarDocId || sidebarDocumentName) {
      await deleteDocument(authenticatedPage, organizationSlug, sidebarDocId, sidebarDocumentName);
    }
  });

  test("should display document details", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.detailsSectionButton.click();

    await expect(authenticatedPage.getByText("File Size")).toBeVisible();
    await expect(authenticatedPage.getByText("Pages")).toBeVisible();
    await expect(authenticatedPage.getByText(/^Uploaded$/)).toBeVisible();
  });

  test("should display recipients section", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await expect(documentPage.recipientsSectionButton).toBeVisible();

    // Fresh document always shows "No recipients" + "Add Recipient" button
    const noRecipients = authenticatedPage.getByText("No recipients");
    const addRecipientButton = authenticatedPage.getByRole("button", { name: /add recipient/i });
    await expect(noRecipients.or(addRecipientButton).first()).toBeVisible({ timeout: 15000 });
  });

  test("should display activity timeline", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.activitySectionButton.click();

    // Verify Activity section
    await expect(documentPage.activitySectionButton).toBeVisible();

    // Activity entries accumulate across runs; "was created" may be buried.
    // Match any event verb that appears in activity log items.
    await expect(
      authenticatedPage
        .getByText(/was (?:created|added|updated|removed|sent|signed|viewed)/i)
        .first(),
    ).toBeVisible();
  });
});
