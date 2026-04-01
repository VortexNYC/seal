import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";

function isDocumentQuotaLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("monthly document limit");
}

test.describe("Document Management", () => {
  test("should create a new document", async ({ authenticatedPage, organizationSlug }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    await documentsPage.goto(organizationSlug);

    const initialCount = await documentsPage.getDocumentCount();

    // This test explicitly validates the UI upload flow — must use UI creation.
    let createdName: string | null = null;
    try {
      createdName = await documentsPage.createDocument(testData.samplePdfPath);
    } catch (error) {
      if (isDocumentQuotaLimitError(error)) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw error;
    }

    try {
      await documentsPage.waitForAnyDocumentRow();
      await expect(documentsPage.getDocumentRowByName(createdName)).toBeVisible();
      expect(await documentsPage.getDocumentCount()).toBeGreaterThan(initialCount);
    } finally {
      await documentsPage.goto(organizationSlug);
      await documentsPage.deleteDocument(createdName).catch(() => {});
    }
  });

  test("should search for documents", async ({
    authenticatedPage,
    organizationSlug,
    createApiDocument,
  }) => {
    let docName = "";
    try {
      const doc = await createApiDocument();
      docName = doc.name;
    } catch (error) {
      if (isDocumentQuotaLimitError(error)) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw error;
    }

    const documentsPage = new DocumentsListPage(authenticatedPage);
    await documentsPage.goto(organizationSlug);
    await documentsPage.waitForAnyDocumentRow();
    await documentsPage.searchDocuments(docName);
    await authenticatedPage.waitForTimeout(1000);

    expect(await documentsPage.getDocumentCount()).toBeGreaterThan(0);
    await expect(documentsPage.getDocumentRowByName(docName)).toBeVisible();
    // createApiDocument fixture auto-deletes after test
  });

  test("should open document editor", async ({
    authenticatedPage,
    organizationSlug,
    createApiDocument,
  }) => {
    let docId: string | null = null;
    try {
      const doc = await createApiDocument();
      docId = doc.id;
    } catch (error) {
      if (isDocumentQuotaLimitError(error)) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw error;
    }

    await authenticatedPage.goto(`/${organizationSlug}/documents/${docId}`);
    await expect(authenticatedPage).toHaveURL(/\/documents\/[a-z0-9]+$/);
    // createApiDocument fixture auto-deletes after test
  });
});

test.describe("Document Editing", () => {
  test("should add signature field to document", async ({
    authenticatedPage,
    organizationSlug,
    createApiDocument,
  }) => {
    test.setTimeout(60000);
    const documentPage = new DocumentPage(authenticatedPage);

    let docId: string | null = null;
    try {
      const doc = await createApiDocument();
      docId = doc.id;
    } catch (error) {
      if (isDocumentQuotaLimitError(error)) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw error;
    }

    await authenticatedPage.goto(`/${organizationSlug}/documents/${docId}`);
    await documentPage.waitForDocumentLoad();

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(100, 100);

    await expect(
      authenticatedPage.getByRole("button", { name: /open field properties/i }).first(),
    ).toBeVisible();
    // createApiDocument fixture auto-deletes after test
  });

  test.skip("should keep send action enabled when a fresh draft already has a signer", // STALE: send button requires at least one recipient; fresh drafts no longer
  // auto-add the creator as a signer. The Document Lifecycle test covers send
  // after a recipient is added.
  async () => {});
});

test.describe("Document Lifecycle", () => {
  test("should add signature field and keep validation state for send", async ({
    authenticatedPage,
    organizationSlug,
    createApiDocument,
  }) => {
    test.setTimeout(60000);
    const documentsPage = new DocumentsListPage(authenticatedPage);
    const documentPage = new DocumentPage(authenticatedPage);

    let docId: string | null = null;
    let docName = "";
    try {
      const doc = await createApiDocument();
      docId = doc.id;
      docName = doc.name;
    } catch (error) {
      if (isDocumentQuotaLimitError(error)) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw error;
    }

    await authenticatedPage.goto(`/${organizationSlug}/documents/${docId}`);
    await documentPage.waitForDocumentLoad();

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(100, 100);

    await expect(documentPage.sendButton).toBeEnabled();

    await documentsPage.goto(organizationSlug);
    await documentsPage.waitForAnyDocumentRow();
    await expect(documentsPage.getDocumentRowByName(docName)).toBeVisible();
    // createApiDocument fixture auto-deletes after test
  });
});
