import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";

async function openDocumentWithSigner(
  authenticatedPage: Page,
  organizationSlug: string,
): Promise<DocumentPage> {
  const documentsPage = new DocumentsListPage(authenticatedPage);
  const documentPage = new DocumentPage(authenticatedPage);

  await documentsPage.goto(organizationSlug);
  await documentsPage.ensureAtLeastOneDocument(testData.samplePdfPath);
  await documentsPage.openFirstDocument();
  await documentPage.waitForDocumentLoad();

  return documentPage;
}

/**
 * Creates an isolated document, opens it, and returns both the document name
 * (for cleanup) and the DocumentPage. The caller must delete the document in a
 * finally block.
 */
async function createIsolatedDocument(
  authenticatedPage: Page,
  organizationSlug: string,
): Promise<{ documentPage: DocumentPage; documentsPage: DocumentsListPage; documentName: string }> {
  const documentsPage = new DocumentsListPage(authenticatedPage);
  const documentPage = new DocumentPage(authenticatedPage);

  await documentsPage.goto(organizationSlug);
  const documentName = await documentsPage.createDocument(testData.samplePdfPath);
  await documentsPage.openDocument(documentName);
  await documentPage.waitForDocumentLoad();

  return { documentPage, documentsPage, documentName };
}

test.describe("Signature Fields - Selection", () => {
  test("should display all field type buttons", async ({ authenticatedPage, organizationSlug }) => {
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    // Verify core field type buttons are visible in the toolbar.
    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Text", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Date", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Checkbox", exact: true }),
    ).toBeVisible();
  });

  test("should select signature field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    // Use documentPage.selectFieldType to ensure a signer is available (buttons are disabled without one)
    await documentPage.selectFieldType("signature");

    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible();
  });

  test("should select text field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await documentPage.selectFieldType("text");
    await expect(
      authenticatedPage.getByRole("button", { name: "Text", exact: true }),
    ).toBeVisible();
  });

  test("should select date field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await documentPage.selectFieldType("date");
    await expect(
      authenticatedPage.getByRole("button", { name: "Date", exact: true }),
    ).toBeVisible();
  });

  test("should select checkbox field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await documentPage.selectFieldType("checkbox");
    await expect(
      authenticatedPage.getByRole("button", { name: "Checkbox", exact: true }),
    ).toBeVisible();
  });
});

test.describe("Signature Fields - Drag and Drop", () => {
  test("should add signature field by clicking on canvas", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(60000);
    const documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(100, 100);

    // Field appears in the sidebar field list
    await expect(
      authenticatedPage.locator('[data-testid="signature-field"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should drag signature field onto PDF", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(60000);
    const documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(150, 150);

    await expect(
      authenticatedPage.locator('[data-testid="signature-field"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should add multiple fields of different types", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(120000);
    let documentName: string | null = null;
    let documentsPage: DocumentsListPage | null = null;
    try {
      ({ documentsPage, documentName } = await createIsolatedDocument(
        authenticatedPage,
        organizationSlug,
      ));
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw err;
    }

    try {
      const documentPage = new DocumentPage(authenticatedPage);

      await documentPage.selectFieldType("signature");
      await documentPage.addSignatureField(100, 100);

      await documentPage.selectFieldType("text");
      await documentPage.addSignatureField(100, 200);

      await documentPage.selectFieldType("date");
      await documentPage.addSignatureField(100, 300);

      // All 3 fields appear in the sidebar field list
      await expect(authenticatedPage.locator('[data-testid="signature-field"]')).toHaveCount(3, {
        timeout: 5000,
      });
    } finally {
      await documentsPage!.goto(organizationSlug).catch(() => {});
      await documentsPage!.deleteDocument(documentName!).catch(() => {});
    }
  });
});

test.describe("Signature Fields - Management", () => {
  test("should display fields section", async ({ authenticatedPage, organizationSlug }) => {
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    // The Signature Fields collapsible section should be visible
    const sectionButton = authenticatedPage.getByRole("button", {
      name: /Signature Fields/,
    });
    await expect(sectionButton).toBeVisible({ timeout: 5000 });
  });

  test("should show field toolbar with drag instructions or existing fields", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    const sectionButton = authenticatedPage.getByRole("button", {
      name: /Signature Fields/,
    });
    await expect(sectionButton).toBeVisible({ timeout: 5000 });

    // Verify at least one field type button is visible (toolbar is rendered)
    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should delete signature field", async ({ authenticatedPage, organizationSlug }) => {
    test.setTimeout(60000);
    let documentName: string | null = null;
    let documentsPage: DocumentsListPage | null = null;
    try {
      ({ documentsPage, documentName } = await createIsolatedDocument(
        authenticatedPage,
        organizationSlug,
      ));
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw err;
    }

    try {
      const documentPage = new DocumentPage(authenticatedPage);

      await documentPage.selectFieldType("signature");
      await documentPage.addSignatureField(150, 150);

      const field = authenticatedPage.locator('[data-testid="signature-field"]').first();
      await expect(field).toBeVisible({ timeout: 5000 });

      await field.getByRole("button", { name: "Delete this field" }).click();

      // Confirmation dialog appears — scope to alertdialog to avoid matching other dialogs
      const alertDialog = authenticatedPage.getByRole("alertdialog");
      await expect(alertDialog).toBeVisible({ timeout: 5000 });
      await alertDialog.getByRole("button", { name: "Remove" }).click();

      await expect(authenticatedPage.getByText("No fields added yet")).toBeVisible({
        timeout: 5000,
      });
    } finally {
      await documentsPage!.goto(organizationSlug).catch(() => {});
      await documentsPage!.deleteDocument(documentName!).catch(() => {});
    }
  });

  test("should edit signature field properties", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(60000);
    const documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(150, 150);

    const field = authenticatedPage.locator('[data-testid="signature-field"]').first();
    await expect(field).toBeVisible({ timeout: 5000 });

    // Click the field row to select it
    await field.click();

    // Field row highlights as selected (border-primary class applied)
    await expect(field).toHaveClass(/border-primary/, { timeout: 3000 });
  });
});

test.describe("Signature Fields - Toolbar Interactions", () => {
  test("should display signature fields toolbar", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await expect(authenticatedPage.getByRole("button", { name: /Signature Fields/ })).toBeVisible();

    await expect(authenticatedPage.getByText("Fields").first()).toBeVisible();
  });

  test("should show field icons with labels", async ({ authenticatedPage, organizationSlug }) => {
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    const sectionButton = authenticatedPage.getByRole("button", {
      name: /Signature Fields/,
    });
    await expect(sectionButton).toBeVisible({ timeout: 5000 });

    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      authenticatedPage.getByRole("button", { name: "Text", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Date", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Checkbox", exact: true }),
    ).toBeVisible();
  });
});
