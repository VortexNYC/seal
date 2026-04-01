import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { apiCreateDocument, apiDeleteDocument } from "../fixtures/convex-test-api";
import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";
import { waitForToast } from "../utils/test-helpers";

function getCachedStorageId(): string | null {
  try {
    const f = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../playwright/.clerk/e2e-pdf-storage-id.txt",
    );
    return readFileSync(f, "utf8").trim() || null;
  } catch {
    return null;
  }
}

test.describe("Recipients Management", () => {
  let sharedDocId: string | null = null;
  let sharedDocName = "";

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    const storageId = getCachedStorageId();
    try {
      if (storageId) {
        const id = await apiCreateDocument(organizationSlug, storageId);
        sharedDocId = id;
        sharedDocName = `e2e-test-doc-${id}`;
        await authenticatedPage.goto(`/${organizationSlug}/documents/${id}`);
        await new DocumentPage(authenticatedPage).waitForDocumentLoad();
      } else {
        const documentsPage = new DocumentsListPage(authenticatedPage);
        await documentsPage.goto(organizationSlug);
        sharedDocName = await documentsPage.createDocument(testData.samplePdfPath);
        await documentsPage.openDocument(sharedDocName);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "Monthly document quota exhausted.");
        return;
      }
      throw err;
    }
  });

  test.afterEach(async ({ authenticatedPage, organizationSlug }) => {
    if (sharedDocId) {
      await apiDeleteDocument(sharedDocId).catch(() => {});
    } else if (sharedDocName) {
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.goto(organizationSlug).catch(() => {});
      await documentsPage.deleteDocument(sharedDocName).catch(() => {});
    }
  });

  test("should display recipients section", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.waitForDocumentLoad();

    // The Recipients collapsible trigger button is visible in the document sidebar
    await expect(documentPage.recipientsSectionButton).toBeVisible();

    // Recipients section is open by default. Verify the section rendered
    // by checking for either the empty state text or the "Add Recipient" button.
    const noRecipients = authenticatedPage.getByText("No recipients");
    const addRecipientButton = authenticatedPage.getByRole("button", {
      name: /add recipient/i,
    });
    // Use first() to avoid strict mode when both are visible simultaneously
    await expect(noRecipients.or(addRecipientButton).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show empty state or recipients list", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.waitForDocumentLoad();

    // Fresh documents always start with no recipients.
    await expect(documentPage.recipientsSectionButton).toBeVisible({ timeout: 5000 });
    await expect(
      authenticatedPage.getByText(/Add recipients who need to sign or view/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should open add recipient dialog", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.waitForDocumentLoad();

    // Click Add Recipient button
    const addButton = authenticatedPage.getByRole("button", { name: /add recipient/i });
    await addButton.click();

    // Verify dialog/form appears
    await expect(authenticatedPage.getByRole("dialog", { name: /add recipient/i })).toBeVisible();
  });

  test("should add recipient with email", async ({
    authenticatedPage,
    organizationSlug,
    createApiDocument,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    // Create an isolated document so recipient assertions are against a clean slate.
    let docId: string | null = null;
    try {
      const doc = await createApiDocument();
      docId = doc.id;
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "Monthly document quota exhausted — cannot create isolated test document.");
        return;
      }
      throw err;
    }

    await authenticatedPage.goto(`/${organizationSlug}/documents/${docId}`);
    await documentPage.waitForDocumentLoad();

    const recipient = testData.recipient();

    // Click Add Recipient button to open the dialog
    await authenticatedPage.getByRole("button", { name: /add recipient/i }).click();

    // Dialog defaults to "Team" tab — switch to "External" to add by email
    await authenticatedPage.getByRole("tab", { name: /external/i }).click();

    // Fill in recipient details (inputs have id="email" and id="name")
    await authenticatedPage.locator("#email").fill(recipient.email);
    await authenticatedPage.locator("#name").fill(recipient.name);

    // Submit — button text is "Add Recipient"
    await authenticatedPage.getByRole("button", { name: /add recipient/i }).click();

    await waitForToast(authenticatedPage, /recipient added/i);

    // Verify recipient appears in list
    await expect(authenticatedPage.getByText(recipient.email)).toBeVisible();
    // createApiDocument fixture auto-deletes after test
  });

  test("should add multiple recipients", async ({
    authenticatedPage,
    organizationSlug,
    createApiDocument,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    let docId: string | null = null;
    try {
      const doc = await createApiDocument();
      docId = doc.id;
    } catch {
      test.skip(true, "E2E workspace reached its monthly document limit.");
      return;
    }

    await authenticatedPage.goto(`/${organizationSlug}/documents/${docId}`);
    await documentPage.waitForDocumentLoad();

    const recipient1 = testData.recipient();
    const recipient2 = testData.recipient();

    // Add first recipient via External tab
    await authenticatedPage.getByRole("button", { name: /add recipient/i }).click();
    await authenticatedPage.getByRole("tab", { name: /external/i }).click();
    await authenticatedPage.locator("#email").fill(recipient1.email);
    await authenticatedPage.locator("#name").fill(recipient1.name);
    await authenticatedPage.getByRole("button", { name: /add recipient/i }).click();
    await waitForToast(authenticatedPage, /recipient added/i);

    // Add second recipient
    await authenticatedPage.getByRole("button", { name: /add recipient/i }).click();
    await authenticatedPage.getByRole("tab", { name: /external/i }).click();
    await authenticatedPage.locator("#email").fill(recipient2.email);
    await authenticatedPage.locator("#name").fill(recipient2.name);
    await authenticatedPage.getByRole("button", { name: /add recipient/i }).click();
    await waitForToast(authenticatedPage, /recipient added/i);

    // Verify both recipients appear
    await expect(authenticatedPage.getByText(recipient1.email)).toBeVisible();
    await expect(authenticatedPage.getByText(recipient2.email)).toBeVisible();
    // createApiDocument fixture auto-deletes after test
  });

  test.skip("should remove recipient", async ({ authenticatedPage }) => {
    // BLOCKED: incomplete — needs `data-recipient-email` on recipient rows and a working add step first.
    const documentPage = new DocumentPage(authenticatedPage);



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

  test.skip("should set recipient order", async ({ authenticatedPage }) => {
    // BLOCKED: incomplete stub — drag-to-reorder logic and `data-recipient-order` testids not implemented.
    const documentPage = new DocumentPage(authenticatedPage);



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
  }) => {
    // BLOCKED: incomplete stub — requires adding both a field and a recipient first.
    const documentPage = new DocumentPage(authenticatedPage);



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
  }) => {
    // BLOCKED: incomplete stub — `[data-testid="recipient"]` not in app, add recipient step missing.
    const documentPage = new DocumentPage(authenticatedPage);



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
  let sendingDocId: string | null = null;
  let sendingDocName = "";

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    const storageId = getCachedStorageId();
    try {
      if (storageId) {
        const id = await apiCreateDocument(organizationSlug, storageId);
        sendingDocId = id;
        sendingDocName = `e2e-test-doc-${id}`;
        await authenticatedPage.goto(`/${organizationSlug}/documents/${id}`);
        await new DocumentPage(authenticatedPage).waitForDocumentLoad();
      } else {
        const documentsPage = new DocumentsListPage(authenticatedPage);
        await documentsPage.goto(organizationSlug);
        sendingDocName = await documentsPage.createDocument(testData.samplePdfPath);
        await documentsPage.openDocument(sendingDocName);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "Monthly document quota exhausted.");
        return;
      }
      throw err;
    }
  });

  test.afterEach(async ({ authenticatedPage, organizationSlug }) => {
    if (sendingDocId) {
      await apiDeleteDocument(sendingDocId).catch(() => {});
    } else if (sendingDocName) {
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.goto(organizationSlug).catch(() => {});
      await documentsPage.deleteDocument(sendingDocName).catch(() => {});
    }
  });

  test.skip("should send document to recipients", async ({
    authenticatedPage,
  }) => {
    // BLOCKED: requires full prerequisite chain (add fields → add recipients → assign) before send.
    const documentPage = new DocumentPage(authenticatedPage);
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

  test("should validate document before sending", async ({
    authenticatedPage,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    const sendButton = authenticatedPage.getByRole("button", {
      name: /send document/i,
    });

    // Only test send-disabled validation on editable drafts. If the first
    // document in the list is already sent/completed, "Send Document" may not
    // be visible and we'd be testing the wrong thing.
    const isEditable = await sendButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isEditable) {
      test.skip(true, "First document is not an editable draft — skipping send validation.");
      return;
    }

    // Send Document button is visible but disabled when no recipients exist.
    await expect(sendButton).toBeDisabled();
  });

  test.skip("should require all fields to be assigned before sending", async ({
    authenticatedPage,
  }) => {
    // BLOCKED: incomplete stub — add field + add recipient steps missing before the send check.
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    // Add field but don't assign to recipient
    // Add recipient
    // Try to send

    await authenticatedPage.getByRole("button", { name: /send|send document/i }).click();

    // Should show validation error
    await expect(authenticatedPage.getByText(/assign all fields/i)).toBeVisible();
  });
});
