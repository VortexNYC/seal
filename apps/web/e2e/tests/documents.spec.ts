import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";

function isDocumentQuotaLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("monthly document limit");
}

async function createDocumentOrFallback(
  documentsPage: DocumentsListPage,
): Promise<{ createdName: string | null; existingName: string | null }> {
  try {
    return {
      createdName: await documentsPage.createDocument(testData.samplePdfPath),
      existingName: null,
    };
  } catch (error) {
    if (!isDocumentQuotaLimitError(error)) {
      throw error;
    }

    await documentsPage.waitForAnyDocumentRow();
    return {
      createdName: null,
      existingName: await documentsPage.getFirstDocumentName(),
    };
  }
}

test.describe("Document Management", () => {
  test("should create a new document", async ({ authenticatedPage, organizationSlug }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);
    await documentsPage.waitForAnyDocumentRow();

    const initialCount = await documentsPage.getDocumentCount();

    // Create document
    const { createdName } = await createDocumentOrFallback(documentsPage);

    if (!createdName) {
      test.skip(true, "E2E workspace reached its monthly document limit.");
      return;
    }

    await documentsPage.waitForAnyDocumentRow();

    // Verify document was created
    const newCount = await documentsPage.getDocumentCount();
    await expect(documentsPage.getDocumentRowByName(createdName)).toBeVisible();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test("should search for documents", async ({ authenticatedPage, organizationSlug }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);
    const { createdName, existingName } = await createDocumentOrFallback(documentsPage);
    const documentName = createdName ?? existingName;

    if (!documentName) {
      test.skip(true, "No searchable documents are available in the E2E workspace.");
      return;
    }

    await documentsPage.waitForAnyDocumentRow();

    // Search for a document
    await documentsPage.searchDocuments(documentName);

    // Wait for search results
    await authenticatedPage.waitForTimeout(1000);

    // Verify search results are displayed
    expect(await documentsPage.getDocumentCount()).toBeGreaterThan(0);
    await expect(documentsPage.getDocumentRowByName(documentName)).toBeVisible();
  });

  test("should open document editor", async ({ authenticatedPage, organizationSlug }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);
    const { createdName, existingName } = await createDocumentOrFallback(documentsPage);
    const documentName = createdName ?? existingName;

    if (!documentName) {
      test.skip(true, "No documents are available to open in the E2E workspace.");
      return;
    }

    await documentsPage.waitForAnyDocumentRow();
    await documentsPage.openDocument(documentName);

    // Verify we're on the document page
    await expect(authenticatedPage).toHaveURL(/\/documents\/[a-z0-9]+$/);
  });
});

test.describe("Document Editing", () => {
  // Drag-and-drop + recipient selector + Convex mutation is genuinely multi-step
  test("should add signature field to document", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(60000);
    const documentsPage = new DocumentsListPage(authenticatedPage);
    const documentPage = new DocumentPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);
    const { createdName, existingName } = await createDocumentOrFallback(documentsPage);
    const documentName = createdName ?? existingName;

    if (!documentName) {
      test.skip(true, "No documents are available to edit in the E2E workspace.");
      return;
    }

    await documentsPage.openDocument(documentName);

    await documentPage.waitForDocumentLoad();

    // Add signature field
    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(100, 100);

    // Verify field was added
    await expect(
      authenticatedPage.getByRole("button", { name: /open field properties/i }).first(),
    ).toBeVisible();
  });

  test("should keep send action enabled when a fresh draft already has a signer", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    const documentPage = new DocumentPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);
    const { createdName } = await createDocumentOrFallback(documentsPage);

    if (!createdName) {
      test.skip(
        true,
        "Fresh draft documents are unavailable because the E2E workspace hit its document limit.",
      );
      return;
    }

    await documentsPage.openDocument(createdName);

    await documentPage.waitForDocumentLoad();

    await expect(documentPage.sendButton).toBeEnabled();
  });
});

test.describe("Document Lifecycle", () => {
  test("should add signature field and keep validation state for send", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(60000);
    const documentsPage = new DocumentsListPage(authenticatedPage);
    const documentPage = new DocumentPage(authenticatedPage);

    // 1. Create document
    await documentsPage.goto(organizationSlug);
    const { createdName, existingName } = await createDocumentOrFallback(documentsPage);
    const documentName = createdName ?? existingName;

    if (!documentName) {
      test.skip(true, "No documents are available for lifecycle checks in the E2E workspace.");
      return;
    }

    // 2. Add signature fields
    await documentsPage.openDocument(documentName);
    await documentPage.waitForDocumentLoad();

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(100, 100);

    await expect(documentPage.sendButton).toBeEnabled();

    // 4. Return to list and confirm row exists
    await documentsPage.goto(organizationSlug);
    await documentsPage.waitForAnyDocumentRow();
    await expect(documentsPage.getDocumentRowByName(documentName)).toBeVisible();
  });
});
