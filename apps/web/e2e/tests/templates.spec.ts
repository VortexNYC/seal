import { expect, test } from "../fixtures/auth";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { TemplatesPage } from "../pages/templates/templates-page";
import { testData } from "../utils/test-data";

test.describe("Template Management", () => {
	test("should create a new template", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const templatesPage = new TemplatesPage(authenticatedPage);

		await templatesPage.goto(organizationSlug);

		const templateName = testData.templateName();

		// Create template
		await templatesPage.createTemplate(templateName, testData.samplePdfPath);

		// Verify template was created
		await expect(authenticatedPage.getByText(templateName)).toBeVisible();
	});

	test("should use template to create document", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const templatesPage = new TemplatesPage(authenticatedPage);
		const _documentsPage = new DocumentsListPage(authenticatedPage);

		// Create a template first
		await templatesPage.goto(organizationSlug);
		const templateName = testData.templateName();
		await templatesPage.createTemplate(templateName, testData.samplePdfPath);

		// Use the template
		await templatesPage.useTemplate(templateName);

		// Verify document was created from template
		await expect(authenticatedPage).toHaveURL(/\/documents\/[a-z0-9]+$/);
	});

	test("should edit template", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const templatesPage = new TemplatesPage(authenticatedPage);

		await templatesPage.goto(organizationSlug);

		const templateName = testData.templateName();

		// Create template
		await templatesPage.createTemplate(templateName, testData.samplePdfPath);

		// Open template for editing
		await templatesPage.openTemplate(templateName);

		// Verify we're on the template editor
		await expect(authenticatedPage).toHaveURL(/\/templates\/[a-z0-9]+$/);
	});
});
