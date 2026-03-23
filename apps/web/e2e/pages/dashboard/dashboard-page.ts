import type { Locator, Page } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly toggleSidebarButton: Locator;

  // Metric cards (matching actual UI: Total Documents, Pending Signatures, Completed, Completion Rate)
  readonly totalDocumentsCard: Locator;
  readonly pendingSignaturesCard: Locator;
  readonly completedCard: Locator;
  readonly completionRateCard: Locator;

  // Metric values
  readonly totalDocumentsValue: Locator;
  readonly pendingSignaturesValue: Locator;
  readonly completedValue: Locator;
  readonly completionRateValue: Locator;

  // Document activity section
  readonly documentActivitySection: Locator;
  readonly noActivityMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Dashboard" });
    // The sidebar toggle is the icon button near the Dashboard heading
    this.toggleSidebarButton = page.locator(
      'button[aria-label="Toggle Sidebar"], [data-testid="sidebar-toggle"]',
    );

    // Metric cards
    this.totalDocumentsCard = page.locator('[aria-label^="Total Documents:"]');
    this.pendingSignaturesCard = page.locator('[aria-label^="Pending Signatures:"]');
    this.completedCard = page.locator('[aria-label^="Completed:"]');
    this.completionRateCard = page.locator('[aria-label^="Completion Rate:"]');

    // Metric values - the large numbers in each card
    this.totalDocumentsValue = this.totalDocumentsCard.locator(".font-serif");
    this.pendingSignaturesValue = this.pendingSignaturesCard.locator(".font-serif");
    this.completedValue = this.completedCard.locator(".font-serif");
    this.completionRateValue = this.completionRateCard.locator(".font-serif");

    // Document activity section - use partial text match
    this.documentActivitySection = page.locator("text=Document Activity");
    this.noActivityMessage = page.getByText("No document activity yet");
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/${slug}/home`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async getTotalDocuments(): Promise<number> {
    const text = await this.totalDocumentsValue.first().textContent();
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

  async getCompletionRate(): Promise<string> {
    return (await this.completionRateValue.first().textContent()) || "0%";
  }

  async hasDocumentActivity(): Promise<boolean> {
    return !(await this.noActivityMessage.isVisible());
  }

  async navigateToSidebarItem(sectionTitle: string, itemTitle: string): Promise<void> {
    const sectionId = toTestIdSegment(sectionTitle);
    const itemId = toTestIdSegment(itemTitle);
    const sectionButton = this.page.getByTestId(`sidebar-section-${sectionId}`);
    const itemLink = this.page.getByTestId(`sidebar-link-${sectionId}-${itemId}`);

    if (!(await itemLink.isVisible().catch(() => false))) {
      await sectionButton.click();
    }

    await itemLink.click();
  }
}

function toTestIdSegment(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}
