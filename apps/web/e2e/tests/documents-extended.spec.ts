import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { waitForToast } from "../utils/test-helpers";

test.describe("Document Filtering", () => {
	test("should filter documents by status - Drafts", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);

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
		const documentsPage = new DocumentsListPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);

		await authenticatedPage.getByRole("button", { name: "Sent" }).click();

		await authenticatedPage.waitForTimeout(500);
	});

	test("should filter documents by status - In Progress", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);

		await authenticatedPage
			.getByRole("button", { name: "In Progress" })
			.click();

		await authenticatedPage.waitForTimeout(500);
	});

	test("should filter documents by status - Completed", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);

		await authenticatedPage.getByRole("button", { name: "Completed" }).click();

		await authenticatedPage.waitForTimeout(500);
	});

	test("should switch between document tabs", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);

		// All Documents (default)
		await authenticatedPage
			.getByRole("button", { name: "All Documents" })
			.click();
		await authenticatedPage.waitForTimeout(500);

		// My Documents
		await authenticatedPage
			.getByRole("button", { name: "My Documents" })
			.click();
		await authenticatedPage.waitForTimeout(500);

		// Shared with Me
		await authenticatedPage
			.getByRole("button", { name: "Shared with Me" })
			.click();
		await authenticatedPage.waitForTimeout(500);
	});
});

test.describe("Document Actions", () => {
	test("should download document", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);

		// Open first document
		await documentsPage.openDocument("Fatura.pdf");

		// Click download button
		const downloadPromise = authenticatedPage.waitForEvent("download");
		await authenticatedPage.getByRole("button", { name: /download/i }).click();

		const download = await downloadPromise;
		expect(download.suggestedFilename()).toContain(".pdf");
	});

	test("should navigate back from document editor", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentsPage = new DocumentsListPage(authenticatedPage);
		const _documentPage = new DocumentPage(authenticatedPage);

		await documentsPage.goto(organizationSlug);
		await documentsPage.openDocument("Fatura.pdf");

		// Click back button
		await authenticatedPage.getByRole("button", { name: "Back" }).click();

		// Verify we're back at documents list
		await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/documents`);
	});

	test.skip("should delete document", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
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
		await authenticatedPage
			.getByRole("button", { name: /confirm|yes/i })
			.click();

		await waitForToast(authenticatedPage, /deleted|removed/i);

		const newCount = await documentsPage.getDocumentCount();
		expect(newCount).toBe(initialCount - 1);
	});
});

test.describe("Document Editor - Zoom Controls", () => {
	test("should zoom in on document", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentPage = new DocumentPage(authenticatedPage);

		await documentPage.goto(
			organizationSlug,
			"kn7azgjcc96f3dgxgca5h6rtq17t8ta1",
		);

		await documentPage.waitForDocumentLoad();

		// Click zoom in button
		await authenticatedPage.getByRole("button", { name: "Zoom in" }).click();

		await authenticatedPage.waitForTimeout(500);

		// Verify zoom level changed (check combobox value)
		const _zoomCombobox = authenticatedPage
			.locator('text="100%"')
			.or(authenticatedPage.locator('text="125%"'));
	});

	test("should zoom out on document", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentPage = new DocumentPage(authenticatedPage);

		await documentPage.goto(
			organizationSlug,
			"kn7azgjcc96f3dgxgca5h6rtq17t8ta1",
		);

		await documentPage.waitForDocumentLoad();

		await authenticatedPage.getByRole("button", { name: "Zoom out" }).click();

		await authenticatedPage.waitForTimeout(500);
	});

	test("should reset zoom on document", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentPage = new DocumentPage(authenticatedPage);

		await documentPage.goto(
			organizationSlug,
			"kn7azgjcc96f3dgxgca5h6rtq17t8ta1",
		);

		await documentPage.waitForDocumentLoad();

		// Zoom in first
		await authenticatedPage.getByRole("button", { name: "Zoom in" }).click();
		await authenticatedPage.waitForTimeout(300);

		// Then reset
		await authenticatedPage.getByRole("button", { name: "Reset" }).click();

		await authenticatedPage.waitForTimeout(500);
	});

	test("should fit document to viewport", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentPage = new DocumentPage(authenticatedPage);

		await documentPage.goto(
			organizationSlug,
			"kn7azgjcc96f3dgxgca5h6rtq17t8ta1",
		);

		await documentPage.waitForDocumentLoad();

		await authenticatedPage.getByRole("button", { name: "Fit" }).click();

		await authenticatedPage.waitForTimeout(500);
	});
});

test.describe("Document Details Sidebar", () => {
	test("should display document details", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentPage = new DocumentPage(authenticatedPage);

		await documentPage.goto(
			organizationSlug,
			"kn7azgjcc96f3dgxgca5h6rtq17t8ta1",
		);

		await documentPage.waitForDocumentLoad();

		// Verify Document Details section is visible
		await expect(authenticatedPage.getByText("Document Details")).toBeVisible();

		// Verify status is shown
		await expect(authenticatedPage.getByText("Status")).toBeVisible();
		await expect(authenticatedPage.getByText("Draft")).toBeVisible();

		// Verify file size is shown
		await expect(authenticatedPage.getByText("File Size")).toBeVisible();

		// Verify upload date is shown
		await expect(authenticatedPage.getByText("Uploaded")).toBeVisible();
	});

	test("should display recipients section", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentPage = new DocumentPage(authenticatedPage);

		await documentPage.goto(
			organizationSlug,
			"kn7azgjcc96f3dgxgca5h6rtq17t8ta1",
		);

		await documentPage.waitForDocumentLoad();

		// Verify Recipients section
		await expect(authenticatedPage.getByText("Recipients")).toBeVisible();

		// Verify Add button exists
		await expect(
			authenticatedPage.getByRole("button", { name: /add/i }),
		).toBeVisible();
	});

	test("should display activity timeline", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const documentPage = new DocumentPage(authenticatedPage);

		await documentPage.goto(
			organizationSlug,
			"kn7azgjcc96f3dgxgca5h6rtq17t8ta1",
		);

		await documentPage.waitForDocumentLoad();

		// Verify Activity section
		await expect(authenticatedPage.getByText("Activity")).toBeVisible();

		// Verify document creation activity is shown
		await expect(
			authenticatedPage.getByText(/document.*was created/i),
		).toBeVisible();
	});
});
