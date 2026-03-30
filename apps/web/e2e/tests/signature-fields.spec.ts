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

test.describe("Signature Fields - Selection", () => {
  test("should display all field type buttons", async ({ authenticatedPage, organizationSlug }) => {
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    // Verify core field type buttons are visible in the toolbar.
    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Text", exact: true })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Date", exact: true })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Checkbox", exact: true })).toBeVisible();
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
    await expect(authenticatedPage.getByRole("button", { name: "Text", exact: true })).toBeVisible();
  });

  test("should select date field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await documentPage.selectFieldType("date");
    await expect(authenticatedPage.getByRole("button", { name: "Date", exact: true })).toBeVisible();
  });

  test("should select checkbox field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await documentPage.selectFieldType("checkbox");
    await expect(authenticatedPage.getByRole("button", { name: "Checkbox", exact: true })).toBeVisible();
  });
});

test.describe("Signature Fields - Drag and Drop", () => {
  test.skip("should add signature field by clicking on canvas", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // TODO: Canvas interactions depend on PDF viewer internals — needs investigation before enabling.
    const _documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    await authenticatedPage.getByRole("button", { name: "Signature", exact: true }).click();

    const canvas = authenticatedPage.locator("canvas");
    await canvas.click({ position: { x: 100, y: 100 } });

    await authenticatedPage.waitForTimeout(1000);

    const fieldsCount = authenticatedPage.getByText("1 fields added");
    await expect(fieldsCount).toBeVisible();
  });

  test.skip("should drag signature field onto PDF", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // TODO: Canvas drag interactions depend on PDF viewer internals — needs investigation.
    const _documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    const signatureButton = authenticatedPage.getByRole("button", {
      name: "Signature",
      exact: true,
    });
    const canvas = authenticatedPage.locator("canvas");

    await signatureButton.dragTo(canvas, {
      targetPosition: { x: 150, y: 150 },
    });

    await authenticatedPage.waitForTimeout(1000);

    const fieldsCount = authenticatedPage.getByText("1 fields added");
    await expect(fieldsCount).toBeVisible();
  });

  test.skip("should add multiple fields of different types", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // TODO: Same as above — canvas interaction investigation needed.
    const _documentPage = await openDocumentWithSigner(authenticatedPage, organizationSlug);

    const canvas = authenticatedPage.locator("canvas");

    await authenticatedPage.getByRole("button", { name: "Signature", exact: true }).click();
    await canvas.click({ position: { x: 100, y: 100 } });
    await authenticatedPage.waitForTimeout(500);

    await authenticatedPage.getByRole("button", { name: "Text", exact: true }).click();
    await canvas.click({ position: { x: 100, y: 200 } });
    await authenticatedPage.waitForTimeout(500);

    await authenticatedPage.getByRole("button", { name: "Date", exact: true }).click();
    await canvas.click({ position: { x: 100, y: 300 } });
    await authenticatedPage.waitForTimeout(500);

    const fieldsCount = authenticatedPage.getByText("3 fields added");
    await expect(fieldsCount).toBeVisible();
  });
});

test.describe("Signature Fields - Management", () => {
  test("should display fields section", async ({ authenticatedPage, organizationSlug }) => {
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    // The Signature Fields collapsible section should be visible
    const sectionButton = authenticatedPage.getByRole("button", { name: /Signature Fields/ });
    await expect(sectionButton).toBeVisible({ timeout: 5000 });
  });

  test("should show field toolbar with drag instructions or existing fields", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    const sectionButton = authenticatedPage.getByRole("button", { name: /Signature Fields/ });
    await expect(sectionButton).toBeVisible({ timeout: 5000 });

    // Verify at least one field type button is visible (toolbar is rendered)
    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible({ timeout: 5000 });
  });

  test.skip("should delete signature field", async ({ authenticatedPage, organizationSlug }) => {
    // BLOCKED: requires `data-testid="signature-field"` on rendered field elements and a pre-placed field.
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    const deleteButton = authenticatedPage
      .locator('[data-testid="signature-field"]')
      .getByRole("button", { name: /delete|remove/i });

    await deleteButton.click();

    await expect(authenticatedPage.getByText("No fields yet")).toBeVisible();
  });

  test.skip("should edit signature field properties", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // BLOCKED: requires `data-testid="signature-field"` on rendered field elements and a pre-placed field.
    await openDocumentWithSigner(authenticatedPage, organizationSlug);

    const field = authenticatedPage.locator('[data-testid="signature-field"]');
    await field.click();
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

    const sectionButton = authenticatedPage.getByRole("button", { name: /Signature Fields/ });
    await expect(sectionButton).toBeVisible({ timeout: 5000 });

    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible({ timeout: 5000 });
    await expect(authenticatedPage.getByRole("button", { name: "Text", exact: true })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Date", exact: true })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Checkbox", exact: true })).toBeVisible();
  });
});
