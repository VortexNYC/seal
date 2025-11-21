import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";

test.describe("Document Management", () => {
	test("should create a new document", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);

		const initialCount = await documentsPage.getDocumentCount();

		// Create document
		await documentsPage.createDocument(testData.samplePdfPath);

		// Verify document was created
		const newCount = await documentsPage.getDocumentCount();
		expect(newCount).toBe(initialCount + 1);
	});

	test("should search for documents", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);

		// Search for a document
		await documentsPage.searchDocuments("test");

		// Wait for search results
		await authenticatedPage.waitForTimeout(1000);

		// Verify search results are displayed
		expect(await documentsPage.getDocumentCount()).toBeGreaterThan(0);
	});

	test("should open document editor", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);

		// Assuming there's at least one document
		const documentName = testData.documentName();
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
		const documentPage = new DocumentPage(authenticatedPage);

		// Navigate to a document (you'll need to create one first or use a fixture)
		const documentId = "test-doc-id"; // Replace with actual document ID
		await documentPage.goto(organizationSlug, documentId);

		await documentPage.waitForDocumentLoad();

		// Add signature field
		await documentPage.selectFieldType("signature");
		await documentPage.addSignatureField(100, 100);

		// Verify field was added
		await expect(
			authenticatedPage.locator('[data-testid="signature-field"]'),
		).toBeVisible();
	});

	test("should send document for signature", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentPage = new DocumentPage(authenticatedPage);

		const documentId = "test-doc-id"; // Replace with actual document ID
		await documentPage.goto(organizationSlug, documentId);

		await documentPage.waitForDocumentLoad();

		// Send document
		await documentPage.sendDocument();

		// Verify success message
		await expect(
			authenticatedPage.locator("[data-sonner-toast]", {
				hasText: /sent successfully/i,
			}),
		).toBeVisible();
	});
});

test.describe("Document Lifecycle", () => {
	test("complete document workflow", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);
		const documentPage = new DocumentPage(authenticatedPage);

		// 1. Create document
		await documentsPage.goto(organizationSlug);
		await documentsPage.createDocument(testData.samplePdfPath);

		// 2. Add signature fields
		const documentName = testData.documentName();
		await documentsPage.openDocument(documentName);
		await documentPage.waitForDocumentLoad();

		await documentPage.selectFieldType("signature");
		await documentPage.addSignatureField(100, 100);

		// 3. Send for signature
		await documentPage.sendDocument();

		// 4. Verify document status changed
		await documentsPage.goto(organizationSlug);
		await expect(
			authenticatedPage.locator('[data-testid="document-status"]', {
				hasText: /pending/i,
			}),
		).toBeVisible();
	});
});
