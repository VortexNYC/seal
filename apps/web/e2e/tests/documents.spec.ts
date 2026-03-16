import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";

test.describe("Document Management", () => {
  test("should create a new document", async ({ authenticatedPage, organizationSlug }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);

    const initialCount = await documentsPage.getDocumentCount();

    // Create document
    await documentsPage.createDocument(testData.samplePdfPath);

    // Verify document was created
    const newCount = await documentsPage.getDocumentCount();
    expect(newCount).toBe(initialCount + 1);
  });

  test("should search for documents", async ({ authenticatedPage, organizationSlug }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);

    // Search for a document
    await documentsPage.searchDocuments("test");

    // Wait for search results
    await authenticatedPage.waitForTimeout(1000);

    // Verify search results are displayed
    expect(await documentsPage.getDocumentCount()).toBeGreaterThan(0);
  });

  test("should open document editor", async ({ authenticatedPage, organizationSlug }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);
    const documentName = await documentsPage.createDocument(testData.samplePdfPath);

    await documentsPage.waitForAnyDocumentRow();
    await documentsPage.openDocument(documentName);

    // Verify we're on the document page
    await expect(authenticatedPage).toHaveURL(/\/documents\/[a-z0-9]+$/);
  });
});

test.describe("Document Editing", () => {
  test("should add signature field to document", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    const documentPage = new DocumentPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);
    const documentName = await documentsPage.createDocument(testData.samplePdfPath);
    await documentsPage.openDocument(documentName);

    await documentPage.waitForDocumentLoad();

    // Add signature field
    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(100, 100);

    // Verify field was added
    await expect(authenticatedPage.locator('[data-testid="signature-field"]')).toBeVisible();
  });

  test("should keep send action disabled before recipients are added", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    const documentPage = new DocumentPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);
    const documentName = await documentsPage.createDocument(testData.samplePdfPath);
    await documentsPage.openDocument(documentName);

    await documentPage.waitForDocumentLoad();

    await expect(documentPage.sendButton).toBeDisabled();
  });
});

test.describe("Document Lifecycle", () => {
  test("should add signature field and keep validation state for send", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    const documentPage = new DocumentPage(authenticatedPage);

    // 1. Create document
    await documentsPage.goto(organizationSlug);
    const documentName = await documentsPage.createDocument(testData.samplePdfPath);

    // 2. Add signature fields
    await documentsPage.openDocument(documentName);
    await documentPage.waitForDocumentLoad();

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(100, 100);

    await expect(documentPage.sendButton).toBeDisabled();

    // 4. Return to list and confirm row exists
    await documentsPage.goto(organizationSlug);
    await documentsPage.waitForAnyDocumentRow();
    await expect(documentsPage.documentRows).toContainText(documentName);
  });
});
