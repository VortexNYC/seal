import type { Locator, Page } from "@playwright/test";
import { waitForConvexMutation } from "../../fixtures/convex-helpers";

export class DocumentsListPage {
	readonly page: Page;
	readonly createDocumentButton: Locator;
	readonly uploadInput: Locator;
	readonly documentTable: Locator;
	readonly searchInput: Locator;

	constructor(page: Page) {
		this.page = page;
		this.createDocumentButton = page.getByRole("button", {
			name: /create document|new document/i,
		});
		this.uploadInput = page.locator('input[type="file"]');
		this.documentTable = page.locator('[data-testid="documents-table"]');
		this.searchInput = page.locator('[data-testid="search-documents"]');
	}

	async goto(slug: string): Promise<void> {
		await this.page.goto(`/${slug}/documents`);
		await this.page.waitForLoadState("networkidle");
	}

	async createDocument(pdfPath: string): Promise<void> {
		await this.createDocumentButton.click();

		// Upload file
		await this.uploadInput.setInputFiles(pdfPath);

		// Wait for upload to complete
		await waitForConvexMutation(this.page, "createDocument");
	}

	async searchDocuments(query: string): Promise<void> {
		await this.searchInput.fill(query);
		await this.page.waitForTimeout(500); // Debounce
	}

	async openDocument(documentName: string): Promise<void> {
		await this.page.getByRole("link", { name: documentName }).click();
		await this.page.waitForLoadState("networkidle");
	}

	async getDocumentCount(): Promise<number> {
		const rows = await this.documentTable.locator("tr").count();
		return rows - 1; // Subtract header row
	}
}
