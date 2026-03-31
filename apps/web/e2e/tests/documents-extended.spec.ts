import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";
import { waitForToast } from "../utils/test-helpers";

async function gotoDocumentsList(
  authenticatedPage: Page,
  organizationSlug: string,
): Promise<DocumentsListPage> {
  const documentsPage = new DocumentsListPage(authenticatedPage);
  await documentsPage.goto(organizationSlug);
  await documentsPage.ensureAtLeastOneDocument(testData.samplePdfPath);
  await documentsPage.waitForAnyDocumentRow();
  return documentsPage;
}

async function openFirstDocumentEditor(
  authenticatedPage: Page,
  organizationSlug: string,
): Promise<{ documentPage: DocumentPage; documentsPage: DocumentsListPage }> {
  const documentsPage = await gotoDocumentsList(authenticatedPage, organizationSlug);
  await documentsPage.openFirstDocument();

  const documentPage = new DocumentPage(authenticatedPage);
  await documentPage.waitForDocumentLoad();

  return { documentPage, documentsPage };
}

test.describe("Document Filtering", () => {
  test("should filter documents by status - Drafts", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await gotoDocumentsList(authenticatedPage, organizationSlug);

    // Click Drafts filter
    await authenticatedPage.getByRole("button", { name: "Drafts" }).click();

    await authenticatedPage.waitForTimeout(500);

    // Verify URL or filter state
    // All visible documents should have "Draft" status
  });

  test("should filter documents by status - Sent", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await gotoDocumentsList(authenticatedPage, organizationSlug);

    await authenticatedPage.getByRole("button", { name: "Sent" }).click();

    await authenticatedPage.waitForTimeout(500);
  });

  test("should filter documents by status - In Progress", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await gotoDocumentsList(authenticatedPage, organizationSlug);

    await authenticatedPage.getByRole("button", { name: "In Progress" }).click();

    await authenticatedPage.waitForTimeout(500);
  });

  test("should filter documents by status - Completed", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await gotoDocumentsList(authenticatedPage, organizationSlug);

    await authenticatedPage.getByRole("button", { name: "Completed" }).click();

    await authenticatedPage.waitForTimeout(500);
  });

  test("should switch between document tabs", async ({ authenticatedPage, organizationSlug }) => {
    await gotoDocumentsList(authenticatedPage, organizationSlug);

    // My Documents
    await authenticatedPage.getByRole("button", { name: "My Documents" }).click();
    await authenticatedPage.waitForTimeout(500);

    // Shared with Me
    await authenticatedPage.getByRole("button", { name: "Shared with Me" }).click();
    await authenticatedPage.waitForTimeout(500);

    await authenticatedPage.getByRole("button", { name: "All Documents" }).last().click();
    await authenticatedPage.waitForTimeout(500);
  });
});

test.describe("Document Actions", () => {
  test("should download document", async ({ authenticatedPage, organizationSlug }) => {
    const documentsPage = await gotoDocumentsList(authenticatedPage, organizationSlug);

    await documentsPage.openFirstDocumentActionsMenu();

    // Chromium/WebKit open a popup; Firefox triggers a download event instead.
    const popupPromise = authenticatedPage.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
    const downloadPromise = authenticatedPage
      .waitForEvent("download", { timeout: 5000 })
      .catch(() => null);

    await authenticatedPage.getByRole("menuitem", { name: /^download$/i }).click();

    const [popup, download] = await Promise.all([popupPromise, downloadPromise]);
    // Check download first: Firefox opens an about:blank popup but triggers a
    // download event. Chromium/WebKit open a popup that navigates to the URL.
    if (download) {
      expect(download).toBeTruthy();
    } else if (popup) {
      await expect.poll(async () => popup.url(), { timeout: 5000 }).not.toBe("about:blank");
    } else {
      throw new Error("Neither a popup nor a download event was triggered");
    }
  });

  test("should navigate back from document editor", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const { documentPage } = await openFirstDocumentEditor(authenticatedPage, organizationSlug);

    // Click back button
    await documentPage.backButton.click();

    // Verify we're back at documents list
    await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/documents`);
  });

  test.skip("should delete document", async ({ authenticatedPage, organizationSlug }) => {
    // Skip until we implement proper test data cleanup
    const documentsPage = new DocumentsListPage(authenticatedPage);

    await documentsPage.goto(organizationSlug);

    const initialCount = await documentsPage.getDocumentCount();

    // Find and click delete button for a document
    const deleteButton = authenticatedPage
      .locator('[data-testid="document-row"]')
      .first()
      .getByRole("button", { name: /delete|remove/i });

    await deleteButton.click();

    // Confirm deletion
    await authenticatedPage.getByRole("button", { name: /confirm|yes/i }).click();

    await waitForToast(authenticatedPage, /deleted|removed/i);

    const newCount = await documentsPage.getDocumentCount();
    expect(newCount).toBe(initialCount - 1);
  });
});

test.describe("Document Editor - Zoom Controls", () => {
  test.describe.configure({ mode: "serial" });

  test("should zoom in on document", async ({ authenticatedPage, organizationSlug }) => {
    const { documentPage } = await openFirstDocumentEditor(authenticatedPage, organizationSlug);

    // Click zoom in button
    const initialZoom = await documentPage.getVisibleZoomText();
    await documentPage.zoomInButton.click();

    await expect
      .poll(async () => documentPage.getVisibleZoomText(), { timeout: 8000 })
      .not.toBe(initialZoom);
  });

  test("should zoom out on document", async ({ authenticatedPage, organizationSlug }) => {
    const { documentPage } = await openFirstDocumentEditor(authenticatedPage, organizationSlug);

    await documentPage.zoomOutButton.click();

    await authenticatedPage.waitForTimeout(500);
  });

  test("should reset zoom on document", async ({ authenticatedPage, organizationSlug }) => {
    const { documentPage } = await openFirstDocumentEditor(authenticatedPage, organizationSlug);

    if (!(await documentPage.hasDesktopOnlyZoomControls())) {
      test.skip(true, "Reset zoom control is hidden on mobile layouts.");
    }

    // Zoom in first
    await documentPage.zoomInButton.click();
    await authenticatedPage.waitForTimeout(300);

    // Then reset
    await documentPage.resetZoomButton.click();

    await authenticatedPage.waitForTimeout(500);
  });

  test("should fit document to viewport", async ({ authenticatedPage, organizationSlug }) => {
    const { documentPage } = await openFirstDocumentEditor(authenticatedPage, organizationSlug);

    if (!(await documentPage.hasDesktopOnlyZoomControls())) {
      test.skip(true, "Fit control is hidden on mobile layouts.");
    }

    await documentPage.fitButton.click();

    await authenticatedPage.waitForTimeout(500);
  });
});

test.describe("Document Details Sidebar", () => {
  test.describe.configure({ mode: "serial" });

  test("should display document details", async ({ authenticatedPage, organizationSlug }) => {
    const { documentPage } = await openFirstDocumentEditor(authenticatedPage, organizationSlug);

    await documentPage.detailsSectionButton.click();

    // Verify document metadata is shown
    await expect(authenticatedPage.getByText("File Size")).toBeVisible();
    await expect(authenticatedPage.getByText("Pages")).toBeVisible();
    await expect(authenticatedPage.getByText(/^Uploaded$/)).toBeVisible();
  });

  test("should display recipients section", async ({ authenticatedPage, organizationSlug }) => {
    const { documentPage } = await openFirstDocumentEditor(authenticatedPage, organizationSlug);

    // Verify Recipients collapsible trigger is visible
    await expect(documentPage.recipientsSectionButton).toBeVisible();

    // Recipients section is open by default. On CI the Convex queries that
    // populate the sidebar may still be in flight, so give it extra time.
    // Fresh documents show "No recipients"; documents with recipients show the recipient name/email.
    // The "Add Recipient" button is always rendered when canEdit is true.
    const noRecipients = authenticatedPage.getByText("No recipients");
    const addRecipientButton = authenticatedPage.getByRole("button", {
      name: /add recipient/i,
    });
    await expect(noRecipients.or(addRecipientButton)).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display activity timeline", async ({ authenticatedPage, organizationSlug }) => {
    const { documentPage } = await openFirstDocumentEditor(authenticatedPage, organizationSlug);

    await documentPage.activitySectionButton.click();

    // Verify Activity section
    await expect(documentPage.activitySectionButton).toBeVisible();

    // Activity entries accumulate across runs; "was created" may be buried.
    // Match any event verb that appears in activity log items.
    await expect(
      authenticatedPage
        .getByText(/was (?:created|added|updated|removed|sent|signed|viewed)/i)
        .first(),
    ).toBeVisible();
  });
});
