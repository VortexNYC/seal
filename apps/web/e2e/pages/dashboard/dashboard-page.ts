import type { Locator, Page } from "@playwright/test";

export class DashboardPage {
	readonly page: Page;
	readonly heading: Locator;
	readonly toggleSidebarButton: Locator;

	// Metric cards
	readonly totalDocumentsCard: Locator;
	readonly teamMembersCard: Locator;
	readonly pendingSignaturesCard: Locator;
	readonly completedCard: Locator;

	// Metric values
	readonly totalDocumentsValue: Locator;
	readonly teamMembersValue: Locator;
	readonly pendingSignaturesValue: Locator;
	readonly completedValue: Locator;

	// Recent activity
	readonly recentActivitySection: Locator;
	readonly noActivityMessage: Locator;

	constructor(page: Page) {
		this.page = page;
		this.heading = page.getByRole("heading", { name: "Dashboard" });
		this.toggleSidebarButton = page.getByRole("button", {
			name: "Toggle Sidebar",
		});

		// Metric cards
		this.totalDocumentsCard = page
			.locator('text="Total Documents"')
			.locator("..");
		this.teamMembersCard = page.locator('text="Team Members"').locator("..");
		this.pendingSignaturesCard = page
			.locator('text="Pending Signatures"')
			.locator("..");
		this.completedCard = page.locator('text="Completed"').locator("..");

		// Metric values
		this.totalDocumentsValue =
			this.totalDocumentsCard.locator("[class*='text-']");
		this.teamMembersValue = this.teamMembersCard.locator("[class*='text-']");
		this.pendingSignaturesValue =
			this.pendingSignaturesCard.locator("[class*='text-']");
		this.completedValue = this.completedCard.locator("[class*='text-']");

		// Recent activity
		this.recentActivitySection = page
			.locator('text="Recent Activity"')
			.locator("..");
		this.noActivityMessage = page.getByText("No recent activity");
	}

	async goto(slug: string): Promise<void> {
		await this.page.goto(`/${slug}/home`);
		await this.page.waitForLoadState("networkidle");
	}

	async getTotalDocuments(): Promise<number> {
		const text = await this.totalDocumentsValue.first().textContent();
		return Number.parseInt(text || "0", 10);
	}

	async getTeamMembers(): Promise<number> {
		const text = await this.teamMembersValue.first().textContent();
		return Number.parseInt(text || "0", 10);
	}

	async getPendingSignatures(): Promise<number> {
		const text = await this.pendingSignaturesValue.first().textContent();
		return Number.parseInt(text || "0", 10);
	}

	async getCompleted(): Promise<number> {
		const text = await this.completedValue.first().textContent();
		return Number.parseInt(text || "0", 10);
	}

	async hasRecentActivity(): Promise<boolean> {
		return !(await this.noActivityMessage.isVisible());
	}
}
