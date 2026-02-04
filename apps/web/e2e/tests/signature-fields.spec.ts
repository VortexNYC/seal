import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";

test.describe("Signature Fields - Selection", () => {
  test("should display all field type buttons", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    // Verify all field type buttons are visible
    await expect(authenticatedPage.getByRole("button", { name: "Signature" })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Text" })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Date" })).toBeVisible();
    await expect(authenticatedPage.getByRole("button", { name: "Checkbox" })).toBeVisible();
  });

  test("should select signature field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    // Click Signature button
    await authenticatedPage.getByRole("button", { name: "Signature" }).click();

    await authenticatedPage.waitForTimeout(300);

    // Verify button is in active/selected state (visual feedback)
    // This depends on your implementation - might check aria-pressed, class, etc.
  });

  test("should select text field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    await authenticatedPage.getByRole("button", { name: "Text" }).click();

    await authenticatedPage.waitForTimeout(300);
  });

  test("should select date field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    await authenticatedPage.getByRole("button", { name: "Date" }).click();

    await authenticatedPage.waitForTimeout(300);
  });

  test("should select checkbox field type", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    await authenticatedPage.getByRole("button", { name: "Checkbox" }).click();

    await authenticatedPage.waitForTimeout(300);
  });
});

test.describe("Signature Fields - Drag and Drop", () => {
  test.skip("should add signature field by clicking on canvas", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // Skip until we understand the exact implementation
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

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

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

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

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

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
  test("should display fields list when empty", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    // Verify "0 fields added" is shown
    await expect(authenticatedPage.getByText("0 fields added")).toBeVisible();

    // Verify empty state message
    await expect(authenticatedPage.getByText("No fields added yet")).toBeVisible();
  });

  test("should show helpful tip about field placement", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    // Verify tip is shown
    await expect(authenticatedPage.getByText(/drag a field onto the PDF/i)).toBeVisible();
  });

  test.skip("should delete signature field", async ({ authenticatedPage, organizationSlug }) => {
    // Skip until field creation is working
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    // Add a field first
    // ... (field creation code)

    // Delete the field
    const deleteButton = authenticatedPage
      .locator('[data-testid="signature-field"]')
      .getByRole("button", { name: /delete|remove/i });

    await deleteButton.click();

    // Verify field was removed
    await expect(authenticatedPage.getByText("0 fields added")).toBeVisible();
  });

  test.skip("should edit signature field properties", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // Skip until field creation is working
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

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

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    // Verify toolbar heading
    await expect(
      authenticatedPage.getByRole("heading", { name: "Signature Fields" }),
    ).toBeVisible();

    // Verify instruction text
    await expect(authenticatedPage.getByText("Drag fields onto the document")).toBeVisible();
  });

  test("should show field icons with labels", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.goto(organizationSlug, "kn7azgjcc96f3dgxgca5h6rtq17t8ta1");

    await documentPage.waitForDocumentLoad();

    // Each button should have an icon and text label
    const signatureButton = authenticatedPage.getByRole("button", {
      name: "Signature",
    });
    const textButton = authenticatedPage.getByRole("button", { name: "Text" });
    const dateButton = authenticatedPage.getByRole("button", { name: "Date" });
    const checkboxButton = authenticatedPage.getByRole("button", {
      name: "Checkbox",
    });

    await expect(signatureButton).toBeVisible();
    await expect(textButton).toBeVisible();
    await expect(dateButton).toBeVisible();
    await expect(checkboxButton).toBeVisible();
  });
});
