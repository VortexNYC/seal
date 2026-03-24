import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";
import { waitForToast } from "../utils/test-helpers";

async function createAndOpenDocument(
  authenticatedPage: Page,
  organizationSlug: string,
): Promise<void> {
  const documentsPage = new DocumentsListPage(authenticatedPage);

  await documentsPage.goto(organizationSlug);
  const documentName = await documentsPage.createDocument(testData.samplePdfPath);
  await documentsPage.openDocument(documentName);
}

test.describe("Recipients Management", () => {
  test("should display recipients section", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Verify Recipients section is visible
    await expect(documentPage.recipientsSectionButton).toBeVisible();

    // Verify at least one recipient field state is displayed.
    await expect(authenticatedPage.getByText("No recipients")).toBeVisible();
  });

  test("should show empty state when no recipients", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Verify empty state message
    await expect(authenticatedPage.getByText(/no recipients/i)).toBeVisible();
  });

  test.skip("should open add recipient dialog", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Click Add button
    const addButton = authenticatedPage.getByRole("button", { name: /add/i });
    await addButton.click();

    // Verify dialog/form appears
    await expect(authenticatedPage.getByRole("dialog", { name: /add recipient/i })).toBeVisible();
  });

  test.skip("should add recipient with email", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    const recipient = testData.recipient();

    // Click Add button
    await authenticatedPage.getByRole("button", { name: /add/i }).click();

    // Fill in recipient details
    await authenticatedPage.getByLabel(/email/i).fill(recipient.email);
    await authenticatedPage.getByLabel(/name/i).fill(recipient.name);

    // Submit
    await authenticatedPage.getByRole("button", { name: /add|save/i }).click();

    await waitForToast(authenticatedPage, /added/i);

    // Verify recipient appears in list
    await expect(authenticatedPage.getByText(recipient.email)).toBeVisible();
  });

  test.skip("should add multiple recipients", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    const recipient1 = testData.recipient();
    const recipient2 = testData.recipient();

    // Add first recipient
    await authenticatedPage.getByRole("button", { name: /add/i }).click();
    await authenticatedPage.getByLabel(/email/i).fill(recipient1.email);
    await authenticatedPage.getByLabel(/name/i).fill(recipient1.name);
    await authenticatedPage.getByRole("button", { name: /add|save/i }).click();

    await authenticatedPage.waitForTimeout(500);

    // Add second recipient
    await authenticatedPage.getByRole("button", { name: /add/i }).click();
    await authenticatedPage.getByLabel(/email/i).fill(recipient2.email);
    await authenticatedPage.getByLabel(/name/i).fill(recipient2.name);
    await authenticatedPage.getByRole("button", { name: /add|save/i }).click();

    await authenticatedPage.waitForTimeout(500);

    // Verify both recipients appear
    await expect(authenticatedPage.getByText(recipient1.email)).toBeVisible();
    await expect(authenticatedPage.getByText(recipient2.email)).toBeVisible();
  });

  test.skip("should remove recipient", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Add a recipient first
    const recipient = testData.recipient();
    // ... (add recipient code)

    // Remove the recipient
    const removeButton = authenticatedPage
      .locator(`[data-recipient-email="${recipient.email}"]`)
      .getByRole("button", { name: /remove|delete/i });

    await removeButton.click();

    // Confirm removal
    await authenticatedPage.getByRole("button", { name: /confirm|yes/i }).click();

    await waitForToast(authenticatedPage, /removed/i);

    // Verify recipient is gone
    await expect(authenticatedPage.getByText(recipient.email)).not.toBeVisible();
  });

  test.skip("should set recipient order", async ({ authenticatedPage, organizationSlug }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Add multiple recipients
    // ... (add recipients code)

    // Drag to reorder
    const recipient1 = authenticatedPage.locator('[data-recipient-order="1"]');
    const recipient2 = authenticatedPage.locator('[data-recipient-order="2"]');

    await recipient1.dragTo(recipient2);

    await authenticatedPage.waitForTimeout(500);

    // Verify order changed
  });

  test.skip("should assign fields to specific recipient", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Add recipient
    // ... (add recipient code)

    // Add signature field
    // ... (add field code)

    // Assign field to recipient
    const field = authenticatedPage.locator('[data-testid="signature-field"]');
    await field.click();

    // Select recipient from dropdown
    await authenticatedPage.getByRole("combobox", { name: /assign to/i }).click();
    await authenticatedPage.getByRole("option", { name: /recipient 1/i }).click();

    await authenticatedPage.waitForTimeout(500);

    // Verify field is assigned (visual indicator on field)
  });
});

test.describe("Recipients - Authentication Methods", () => {
  test.skip("should configure recipient authentication method", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Add recipient
    // ... (add recipient code)

    // Click on recipient to edit
    const recipient = authenticatedPage.locator('[data-testid="recipient"]');
    await recipient.click();

    // Select authentication method
    await authenticatedPage.getByRole("combobox", { name: /authentication/i }).click();

    // Options might include: Email, SMS, None
    await authenticatedPage.getByRole("option", { name: /email/i }).click();

    await authenticatedPage.waitForTimeout(500);
  });
});

test.describe("Document Sending", () => {
  test.skip("should send document to recipients", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Prerequisites:
    // - Add signature fields
    // - Add recipients
    // - Assign fields to recipients

    // Click Send button
    await authenticatedPage.getByRole("button", { name: /send|send document/i }).click();

    // Confirm send
    await authenticatedPage.getByRole("button", { name: /confirm|send/i }).click();

    await waitForToast(authenticatedPage, /sent/i);

    // Verify document status changed to "Sent"
    await expect(authenticatedPage.getByText("Sent")).toBeVisible();
  });

  test.skip("should validate document before sending", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Try to send without recipients
    await authenticatedPage.getByRole("button", { name: /send|send document/i }).click();

    // Should show error/validation message
    await expect(authenticatedPage.getByText(/add recipients/i)).toBeVisible();
  });

  test.skip("should require all fields to be assigned before sending", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await createAndOpenDocument(authenticatedPage, organizationSlug);

    await documentPage.waitForDocumentLoad();

    // Add field but don't assign to recipient
    // Add recipient
    // Try to send

    await authenticatedPage.getByRole("button", { name: /send|send document/i }).click();

    // Should show validation error
    await expect(authenticatedPage.getByText(/assign all fields/i)).toBeVisible();
  });
});
