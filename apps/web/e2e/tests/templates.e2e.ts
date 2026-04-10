import { expect, test } from "../fixtures/auth";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { TemplatesPage } from "../pages/templates/templates-page";
import { testData } from "../utils/test-data";

test.describe("Template Management", () => {
  // Templates are created via "Save as Template" in the document editor sidebar.
  // The templates page only lists existing templates — there is no "Create Template" button here.
  //
  // BLOCKED: The E2E test account is on the free tier. "Save as Template" button is disabled
  // until canCreateTemplates=true (requires pro subscription).
  // Fix: seed a pro subscription for the test org in the test Convex deployment, OR add
  // isTestDeployment bypass to use-subscription-limits.ts (same pattern as upload-dialog.tsx:79).

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
