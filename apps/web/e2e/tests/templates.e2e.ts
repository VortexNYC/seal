import {
  createSignableDocument,
  type SignableDocument,
} from "../factories/document-factory";
import { test as authTest, expect } from "../fixtures/auth";
import { ensurePdfStorageId } from "../fixtures/convex-test-api";
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
 * Both have been resolved: backend.setup now seeds the pro subscription,
 * and the page object + tests have been rewritten to drive the real UI
 * path. The remaining gaps (instantiating a doc from a template,
 * editing/deleting templates) are kept here as `.skip` with explicit
 * follow-up notes, not silent dead code.
 */

const test = authTest.extend<{ signableDoc: SignableDocument }>({
  signableDoc: async ({ organizationSlug }, run) => {
    const storageId = await ensurePdfStorageId(sampleDocumentPath);
    // workflowStatus="draft" so the doc is canEdit=true in the editor — that's
    // the precondition for the "Save as Template" sidebar button to render.
    const doc = await createSignableDocument({
      organizationSlug,
      storageId,
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
    await saveDocumentAsTemplate(authenticatedPage, {
      templateName,
      description: "E2E template smoke",
    });

    const templatesPage = new TemplatesPage(authenticatedPage);
    await templatesPage.goto(organizationSlug);
    await templatesPage.expectTemplateVisible(templateName);
  });

  // Follow-ups (intentionally not implemented in this PR):
  //   - instantiate a document from a template (the "Use Template" menu on
  //     each template card)
  //   - edit template name and description (the edit dialog's selectors)
  // Captured as separate work; not added as `test.skip(title, "reason")`
  // because that signature is `(condition, description)` and incorrectly
  // skips siblings in the describe block.
});

test.describe("Templates list", () => {
  test("templates page renders for the seeded workspace", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const templatesPage = new TemplatesPage(authenticatedPage);
    await templatesPage.goto(organizationSlug);
    await expect(templatesPage.heading).toBeVisible({ timeout: 10_000 });
    await expect(
      authenticatedPage.getByText(/something went wrong/i)
    ).not.toBeVisible({
      timeout: 1_000,
    });
  });
});
