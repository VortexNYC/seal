import type { Locator, Page } from "@playwright/test";

import { pollUntil } from "../../fixtures/poll";

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly toggleSidebarButton: Locator;

  readonly totalDocumentsCard: Locator;
  readonly pendingSignaturesCard: Locator;
  readonly completedCard: Locator;
  readonly completionRateCard: Locator;

  readonly recentDocumentsSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Dashboard" });
    this.toggleSidebarButton = page
      .locator(
        'button[aria-label="Toggle Sidebar"], [data-testid="sidebar-toggle"]'
      )
      .first();

    this.totalDocumentsCard = page.getByLabel(/^Documents:/);
    this.pendingSignaturesCard = page.getByLabel(/^Pending:/);
    this.completedCard = page.getByLabel(/^Completed:/);
    this.completionRateCard = page.getByLabel(/^Completion:/);

    this.recentDocumentsSection = page.getByTestId("recent-documents");
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/${slug}/home`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async getTotalDocuments(): Promise<number> {
    const card = this.totalDocumentsCard;
    await card.waitFor({ timeout: 15000 });
    const text = await card.getAttribute("aria-label");
    const match = text?.match(/Documents:\s*(\d+)/);
    return Number.parseInt(match?.[1] ?? "0", 10);
  }

  async getPendingSignatures(): Promise<number> {
    const card = this.pendingSignaturesCard;
    await card.waitFor({ timeout: 10000 });
    const text = await card.getAttribute("aria-label");
    const match = text?.match(/Pending:\s*(\d+)/);
    return Number.parseInt(match?.[1] ?? "0", 10);
  }

  async getCompleted(): Promise<number> {
    const card = this.completedCard;
    await card.waitFor({ timeout: 10000 });
    const text = await card.getAttribute("aria-label");
    const match = text?.match(/Completed:\s*(\d+)/);
    return Number.parseInt(match?.[1] ?? "0", 10);
  }

  async getCompletionRate(): Promise<string> {
    const card = this.completionRateCard;
    await card.waitFor({ timeout: 10000 });
    const text = await card.getAttribute("aria-label");
    const match = text?.match(/Completion:\s*(\d+%)/);
    return match?.[1] ?? "0%";
  }

  async navigateToSidebarItem(
    sectionTitle: string,
    itemTitle: string
  ): Promise<void> {
    if (await this.navigateViaQuickActionIfAvailable(itemTitle)) {
      return;
    }

    const sectionButton = this.page.getByRole("button", {
      name: sectionTitle,
      exact: true,
    });
    const itemLink = this.page.getByRole("link", {
      name: itemTitle,
      exact: true,
    });

    await sectionButton.waitFor({ state: "visible", timeout: 5000 });

    if (!(await itemLink.isVisible().catch(() => false))) {
      await this.openMobileSidebarIfNeeded(sectionButton, itemLink);
    }

    if (!(await itemLink.isVisible().catch(() => false))) {
      await sectionButton.click();
    }

    await itemLink.waitFor({ state: "visible", timeout: 10000 });
    await itemLink.click();
  }

  private async openMobileSidebarIfNeeded(
    sectionButton: Locator,
    itemLink: Locator
  ): Promise<void> {
    const viewportWidth = this.page.viewportSize()?.width;

    if (viewportWidth && viewportWidth < 768) {
      if (
        (await sectionButton.isVisible().catch(() => false)) ||
        (await itemLink.isVisible().catch(() => false))
      ) {
        return;
      }

      const mobileTrigger = this.page.getByRole("button", {
        name: "Toggle Sidebar",
      });

      await mobileTrigger.waitFor({ state: "visible", timeout: 5000 });

      const attemptOpen = async (attempt: number): Promise<void> => {
        if (attempt >= 2) return;
        await mobileTrigger.click();

        if (await this.waitForAnyVisible([sectionButton, itemLink], 2000)) {
          return;
        }

        await this.page.waitForTimeout(500);
        return attemptOpen(attempt + 1);
      };
      await attemptOpen(0);
    }
  }

  private async navigateViaQuickActionIfAvailable(
    itemTitle: string
  ): Promise<boolean> {
    const viewportWidth = this.page.viewportSize()?.width;

    if (!viewportWidth || viewportWidth >= 768) {
      return false;
    }

    const quickActionMatchers: Record<string, RegExp> = {
      Analytics: /^Analytics\b/i,
      Documents: /^Documents\b|^All documents\b/i,
      Templates: /^Templates\b/i,
    };

    const quickActionMatcher = quickActionMatchers[itemTitle];

    if (!quickActionMatcher) {
      return false;
    }

    const quickActionButton = this.page
      .getByRole("button", { name: quickActionMatcher })
      .first();

    if (!(await quickActionButton.isVisible().catch(() => false))) {
      return false;
    }

    await quickActionButton.click();
    return true;
  }

  private async waitForAnyVisible(
    locators: Locator[],
    timeoutMs: number
  ): Promise<boolean> {
    const anyVisible = await pollUntil(
      async () => {
        const visibilities = await Promise.all(
          locators.map((locator) => locator.isVisible().catch(() => false))
        );
        return visibilities.some(Boolean) || undefined;
      },
      { deadline: Date.now() + timeoutMs, intervalMs: 100 }
    );

    return anyVisible === true;
  }
}
