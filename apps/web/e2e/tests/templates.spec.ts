import { expect, test } from "../fixtures/auth";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { TemplatesPage } from "../pages/templates/templates-page";
import { testData } from "../utils/test-data";

test.describe("Template Management", () => {
  // Templates are created from the document actions menu ("Save as Template"),
  // not from the templates page directly. The templates page only lists existing templates.
  // These tests need a pre-existing template to work; skip until seeded test data is available.

  test.skip("should create a new template", async ({ authenticatedPage, organizationSlug }) => {
    const templatesPage = new TemplatesPage(authenticatedPage);

    await templatesPage.goto(organizationSlug);

    const templateName = testData.templateName();

    await templatesPage.createTemplate(templateName, testData.samplePdfPath);

    await expect(authenticatedPage.getByText(templateName)).toBeVisible();
  });

  test.skip("should use template to create document", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const templatesPage = new TemplatesPage(authenticatedPage);
    const _documentsPage = new DocumentsListPage(authenticatedPage);

    await templatesPage.goto(organizationSlug);
    const templateName = testData.templateName();
    await templatesPage.createTemplate(templateName, testData.samplePdfPath);

    await templatesPage.useTemplate(templateName);

    await expect(authenticatedPage).toHaveURL(/\/documents\/[a-z0-9]+$/);
  });

  test.skip("should edit template", async ({ authenticatedPage, organizationSlug }) => {
    const templatesPage = new TemplatesPage(authenticatedPage);

    await templatesPage.goto(organizationSlug);

    const templateName = testData.templateName();

    await templatesPage.createTemplate(templateName, testData.samplePdfPath);

    await templatesPage.openTemplate(templateName);

    await expect(authenticatedPage).toHaveURL(/\/templates\/[a-z0-9]+$/);
  });
});
