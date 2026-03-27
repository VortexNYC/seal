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
    this.totalDocumentsCard = page.getByText("Total Documents").locator("..");
    this.pendingSignaturesCard = page.getByText("Pending Signatures").locator("..");
    this.completedCard = page.getByText("Completed").first().locator("..");
    this.completionRateCard = page.getByText("Completion Rate").locator("..");

    // Metric values - the large numbers in each card
    this.totalDocumentsValue = this.totalDocumentsCard.locator(
      'div:has-text("0"), div:has-text("1"), div:has-text("2")',
    );
    this.pendingSignaturesValue = this.pendingSignaturesCard.locator(
      'div:has-text("0"), div:has-text("1"), div:has-text("2")',
    );
    this.completedValue = this.completedCard.locator(
      'div:has-text("0"), div:has-text("1"), div:has-text("2")',
    );
    this.completionRateValue = this.completionRateCard.locator('div:has-text("%")');

    // Document activity section - use partial text match
    this.documentActivitySection = page.locator("text=Document Activity");
    this.noActivityMessage = page.getByText("No document activity yet");
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/${slug}/home`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async getTotalDocuments(): Promise<number> {
    // Get the value from the Total Documents card
    const card = this.page.locator('[class*="card"]').filter({
      hasText: "Total Documents",
    });
    const valueEl = card.locator("div").filter({ hasText: /^\d+$/ }).first();
    const text = await valueEl.textContent();
    return Number.parseInt(text || "0", 10);
  }

  async getPendingSignatures(): Promise<number> {
    const card = this.page.locator('[class*="card"]').filter({
      hasText: "Pending Signatures",
    });
    const valueEl = card.locator("div").filter({ hasText: /^\d+$/ }).first();
    const text = await valueEl.textContent();
    return Number.parseInt(text || "0", 10);
  }

  async getCompleted(): Promise<number> {
    // Be specific to avoid matching "0 completed this month"
    const card = this.page
      .locator('[class*="card"]')
      .filter({ hasText: "Completed" })
      .filter({ hasNotText: "Completion Rate" })
      .first();
    const valueEl = card.locator("div").filter({ hasText: /^\d+$/ }).first();
    const text = await valueEl.textContent();
    return Number.parseInt(text || "0", 10);
  }

  async getCompletionRate(): Promise<string> {
    const card = this.page.locator('[class*="card"]').filter({
      hasText: "Completion Rate",
    });
    const valueEl = card.locator("div").filter({ hasText: /\d+%/ }).first();
    return (await valueEl.textContent()) || "0%";
  }

  async hasDocumentActivity(): Promise<boolean> {
    return !(await this.noActivityMessage.isVisible());
  }

  async navigateToSidebarItem(sectionTitle: string, itemTitle: string): Promise<void> {
    if (await this.navigateViaQuickActionIfAvailable(itemTitle)) {
      return;
    }

    const sectionButton = this.page.getByRole("button", { name: sectionTitle, exact: true });
    const itemLink = this.page.getByRole("link", { name: itemTitle, exact: true });

    // Wait for the sidebar to populate — section buttons depend on Convex queries
    // for permissions and org data that may not have resolved yet.
    await sectionButton.waitFor({ state: "visible", timeout: 15000 });

    if (!(await itemLink.isVisible().catch(() => false))) {
      await this.openMobileSidebarIfNeeded(sectionButton, itemLink);
    }

    if (!(await itemLink.isVisible().catch(() => false))) {
      // Section is collapsed — click to expand
      await sectionButton.click();
    }

    await itemLink.waitFor({ state: "visible", timeout: 10000 });
    await itemLink.click();
  }

  private async openMobileSidebarIfNeeded(
    sectionButton: Locator,
    itemLink: Locator,
  ): Promise<void> {
    const viewportWidth = this.page.viewportSize()?.width;

    if (viewportWidth && viewportWidth < 768) {
      if (
        (await sectionButton.isVisible().catch(() => false)) ||
        (await itemLink.isVisible().catch(() => false))
      ) {
        return;
      }

      const mobileTrigger = this.page.getByRole("button", { name: "Toggle Sidebar" });

      await mobileTrigger.waitFor({ state: "visible", timeout: 5000 });

      for (let attempt = 0; attempt < 2; attempt++) {
        await mobileTrigger.click();

        if (await this.waitForAnyVisible([sectionButton, itemLink], 2000)) {
          return;
        }

        await this.page.waitForTimeout(500);
      }
    }
  }

  private async navigateViaQuickActionIfAvailable(itemTitle: string): Promise<boolean> {
    const viewportWidth = this.page.viewportSize()?.width;

    if (!viewportWidth || viewportWidth >= 768) {
      return false;
    }

    const quickActionMatchers: Record<string, RegExp> = {
      Analytics: /^Analytics\b/i,
      Documents: /^Documents\b/i,
      Templates: /^Templates\b/i,
    };

    const quickActionMatcher = quickActionMatchers[itemTitle];

    if (!quickActionMatcher) {
      return false;
    }

    const quickActionButton = this.page.getByRole("button", { name: quickActionMatcher }).first();

    if (!(await quickActionButton.isVisible().catch(() => false))) {
      return false;
    }

    await quickActionButton.click();
    return true;
  }

  private async waitForAnyVisible(locators: Locator[], timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      for (const locator of locators) {
        if (await locator.isVisible().catch(() => false)) {
          return true;
        }
      }

      await this.page.waitForTimeout(100);
    }

    return false;
  }
}
