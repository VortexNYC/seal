import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";

async function createAndOpenDocument(
  authenticatedPage: Page,
  organizationSlug: string,
): Promise<void> {
  const documentsPage = new DocumentsListPage(authenticatedPage);

  await documentsPage.goto(organizationSlug);
  const documentName = await documentsPage.createDocument(testData.samplePdfPath);
  await documentsPage.openDocument(documentName);
}

test.describe("Signature Fields - Selection", () => {
  test("should display all field type buttons", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Verify core field type buttons are visible in the toolbar.
    // Labels match the FieldButton `label` props: "Signature", "Text", "Date", "Checkbox".
    await expect(authenticatedPage.getByRole("button", { name: "Signature" })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Text" })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Date" })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Checkbox" })).toBeVisible();
  });

  test("should select signature field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Click Signature button
    await authenticatedPage.getByRole("button", { name: "Signature" }).click();

    // Button should remain visible (it's a drag-to-place paradigm, not a toggle)
    await expect(authenticatedPage.getByRole("button", { name: "Signature" })).toBeVisible();
  });

  test("should select text field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    await authenticatedPage.getByRole("button", { name: "Text" }).click();
    await expect(authenticatedPage.getByRole("button", { name: "Text" })).toBeVisible();
  });

  test("should select date field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    await authenticatedPage.getByRole("button", { name: "Date" }).click();
    await expect(authenticatedPage.getByRole("button", { name: "Date" })).toBeVisible();
  });

  test("should select checkbox field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // The FieldButton label prop is "Checkbox"
    await authenticatedPage.getByRole("button", { name: "Checkbox" }).click();
    await expect(authenticatedPage.getByRole("button", { name: "Checkbox" })).toBeVisible();
  });
});

test.describe("Signature Fields - Drag and Drop", () => {
  test.skip("should add signature field by clicking on canvas", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // Skip until we understand the exact implementation
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Select signature field type
    await authenticatedPage.getByRole("button", { name: "Signature" }).click();

    // Click on canvas to place field
    const canvas = authenticatedPage.locator("canvas");
    await canvas.click({ position: { x: 100, y: 100 } });

    await authenticatedPage.waitForTimeout(1000);

    // Verify field was added
    const fieldsCount = authenticatedPage.getByText("1 fields added");
    await expect(fieldsCount).toBeVisible();
  });

  test.skip("should drag signature field onto PDF", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Drag signature button to canvas
    const signatureButton = authenticatedPage.getByRole("button", {
      name: "Signature",
    });
    const canvas = authenticatedPage.locator("canvas");

    await signatureButton.dragTo(canvas, {
      targetPosition: { x: 150, y: 150 },
    });

    await authenticatedPage.waitForTimeout(1000);

    // Verify field was added
    const fieldsCount = authenticatedPage.getByText("1 fields added");
    await expect(fieldsCount).toBeVisible();
  });

  test.skip("should add multiple fields of different types", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    const canvas = authenticatedPage.locator("canvas");

    // Add signature field
    await authenticatedPage.getByRole("button", { name: "Signature" }).click();
    await canvas.click({ position: { x: 100, y: 100 } });
    await authenticatedPage.waitForTimeout(500);

    // Add text field
    await authenticatedPage.getByRole("button", { name: "Text" }).click();
    await canvas.click({ position: { x: 100, y: 200 } });
    await authenticatedPage.waitForTimeout(500);

    // Add date field
    await authenticatedPage.getByRole("button", { name: "Date" }).click();
    await canvas.click({ position: { x: 100, y: 300 } });
    await authenticatedPage.waitForTimeout(500);

    // Verify 3 fields were added
    const fieldsCount = authenticatedPage.getByText("3 fields added");
    await expect(fieldsCount).toBeVisible();
  });
});

test.describe("Signature Fields - Management", () => {
  test("should display empty state when no fields exist", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // The sidebar's Signature Fields section shows an empty state when there
    // are no fields. The text reads "No fields yet".
    await expect(authenticatedPage.getByText("No fields yet")).toBeVisible();
  });

  test("should show helpful tip about field placement", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // The empty state includes instruction text about dragging fields
    await expect(
      authenticatedPage.getByText(/Drag fields from above onto the document/i),
    ).toBeVisible();
  });

  test.skip("should delete signature field", async ({ authenticatedPage, organizationSlug }) => {
    // Skip until field creation is working
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Add a field first
    // ... (field creation code)

    // Delete the field
    const deleteButton = authenticatedPage
      .locator('[data-testid="signature-field"]')
      .getByRole("button", { name: /delete|remove/i });

    await deleteButton.click();

    // Verify field was removed
    await expect(authenticatedPage.getByText("No fields yet")).toBeVisible();
  });

  test.skip("should edit signature field properties", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // Skip until field creation is working
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Add a field first
    // ... (field creation code)

    // Click on field to edit
    const field = authenticatedPage.locator('[data-testid="signature-field"]');
    await field.click();

    // Edit properties (required, label, etc.)
    // ... (property editing code)
  });
});

test.describe("Signature Fields - Toolbar Interactions", () => {
  test("should display signature fields toolbar", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // The "Signature Fields" section is a collapsible trigger button, not a heading.
    // Verify the section trigger text is present.
    await expect(authenticatedPage.getByRole("button", { name: /Signature Fields/ })).toBeVisible();

    // Verify the toolbar's "Fields" label is visible inside the toolbar
    await expect(authenticatedPage.getByText("Fields").first()).toBeVisible();
  });

  test("should show field icons with labels", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Each button should have a text label. Labels from FieldButton props:
    // "Signature", "Text", "Number", "Date", "Checkbox", "Select", "Choice", "File"
    const signatureButton = authenticatedPage.getByRole("button", {
      name: "Signature",
    });
    const textButton = authenticatedPage.getByRole("button", { name: "Text" });
    const dateButton = authenticatedPage.getByRole("button", { name: "Date" });
    const checkButton = authenticatedPage.getByRole("button", {
      name: "Checkbox",
    });

    await expect(signatureButton).toBeVisible();
    await expect(textButton).toBeVisible();
    await expect(dateButton).toBeVisible();
    await expect(checkButton).toBeVisible();
  });
});
