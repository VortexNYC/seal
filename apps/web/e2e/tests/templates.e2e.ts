import {
  createSignableDocument,
  type SignableDocument,
} from "../factories/document-factory";
import { loadSamplePdf } from "../fixtures/api-test-client";
import { test as authTest, expect } from "../fixtures/auth";
import { sampleDocumentPath } from "../fixtures/paths";
import {
  saveDocumentAsTemplate,
  TemplatesPage,
} from "../pages/templates/templates-page";

/**
 * Template Management E2E.
 *
 * The previous version of this suite was permanently `.skip`d because:
 *   1. Pro subscription was a precondition that wasn't seeded at the time.
 *   2. The TemplatesPage object pointed at a "Create Template" button that
 *      doesn't exist — templates are created from the document editor via
 *      "Save as Template".
 *
 * Both have been resolved: backend.setup seeds the pro subscription,
 * and the page object + tests have been rewritten to drive the real UI
 * path. The remaining gaps (instantiating a doc from a template,
 * editing/deleting templates) are kept here as `.skip` with explicit
 * follow-up notes, not silent dead code.
 */

const test = authTest.extend<{ signableDoc: SignableDocument }>({
  signableDoc: async ({ request }, run) => {
    const pdfFile = await loadSamplePdf(sampleDocumentPath);
    // workflowStatus="draft" so the doc is canEdit=true in the editor — that's
    // the precondition for the "Save as Template" sidebar button to render.
    const doc = await createSignableDocument({
      request,
      pdfFile,
      workflowStatus: "draft",
    });
    await run(doc);
  },
});

test.describe("Template Management", () => {
  test("save document as template via the editor sidebar", async ({
    authenticatedPage,
    organizationSlug,
    signableDoc,
  }) => {
    // The seeded doc has one signature field, which is what unblocks the
    // "Save as Template" button (it requires `signatureFields.length > 0`).
    await authenticatedPage.goto(
      `/${organizationSlug}/documents/${signableDoc.documentId}`
    );
    await expect(
      authenticatedPage.getByRole("button", { name: /send document/i })
    ).toBeVisible({
      timeout: 15_000,
    });

    const templateName = `e2e-tpl-${Date.now()}`;
    await saveDocumentAsTemplate(authenticatedPage, { templateName });

    // The sidebar closes and a success toast confirms the template was saved.
    await expect(
      authenticatedPage.getByText(/template saved/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Navigate to the templates list and assert the new template appears.
    await authenticatedPage.goto(`/${organizationSlug}/templates`);
    const templatesPage = new TemplatesPage(authenticatedPage);
    await templatesPage.expectTemplateVisible(templateName, 10_000);
  });
});
