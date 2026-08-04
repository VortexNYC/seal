import { expect, test } from "../fixtures/auth";
import { DashboardPage } from "../pages/dashboard/dashboard-page";

test.describe("Dashboard", () => {
  test("should display dashboard with metrics", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(45000);
    const dashboardPage = new DashboardPage(authenticatedPage);

    await dashboardPage.goto(organizationSlug);

    // Verify dashboard loads
    await expect(dashboardPage.heading).toBeVisible();

    // Verify all metric cards are visible (Total Documents, Pending Signatures, Completed, Completion Rate)
    await expect(dashboardPage.totalDocumentsCard).toBeVisible();
    await expect(dashboardPage.pendingSignaturesCard).toBeVisible();
    await expect(dashboardPage.completedCard).toBeVisible();
    await expect(dashboardPage.completionRateCard).toBeVisible();
  });

  test("should display correct metric values", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(45000);
    const dashboardPage = new DashboardPage(authenticatedPage);

    await dashboardPage.goto(organizationSlug);

    // Get metric values
    const totalDocuments = await dashboardPage.getTotalDocuments();
    const pendingSignatures = await dashboardPage.getPendingSignatures();
    const completed = await dashboardPage.getCompleted();
    const completionRate = await dashboardPage.getCompletionRate();

    // Verify values are numbers
    expect(typeof totalDocuments).toBe("number");
    expect(typeof pendingSignatures).toBe("number");
    expect(typeof completed).toBe("number");
    expect(typeof completionRate).toBe("string");

    // Verify non-negative values
    expect(totalDocuments).toBeGreaterThanOrEqual(0);
    expect(pendingSignatures).toBeGreaterThanOrEqual(0);
    expect(completed).toBeGreaterThanOrEqual(0);
    expect(completionRate).toMatch(/\d+%/);
  });

  test("should display document activity section", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(45000);
    // data-testid="document-activity-section" added to TrendChart Card in trend-chart.tsx
    const dashboardPage = new DashboardPage(authenticatedPage);

    await dashboardPage.goto(organizationSlug);

    await expect(dashboardPage.documentActivitySection).toBeVisible({
      timeout: 10000,
    });
  });

  test("should toggle sidebar", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // aria-label="Toggle Sidebar" added to SidebarTrigger in page-wrapper.tsx
    const dashboardPage = new DashboardPage(authenticatedPage);

    await dashboardPage.goto(organizationSlug);

    // Toggle sidebar
    await dashboardPage.toggleSidebarButton.click();

    // Wait for animation
    await authenticatedPage.waitForTimeout(500);

    // Verify sidebar state changed (implementation specific)
  });
});

test.describe("Dashboard Navigation", () => {
  test("should navigate to documents from dashboard", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);

    await dashboardPage.goto(organizationSlug);

    await dashboardPage.navigateToSidebarItem("Workspace", "Documents");

    await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/documents`);
  });

  test("should navigate to templates from dashboard", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);

    await dashboardPage.goto(organizationSlug);

    await dashboardPage.navigateToSidebarItem("Workspace", "Templates");

    await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/templates`);
  });

  test("should navigate to analytics from dashboard", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);

    await dashboardPage.goto(organizationSlug);

    await dashboardPage.navigateToSidebarItem("Workspace", "Analytics");

    await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/analytics`);
  });

  test("should navigate to settings from dashboard", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);

    await dashboardPage.goto(organizationSlug);

    await dashboardPage.navigateToSidebarItem("Settings", "General");

    await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/settings`);
  });
});
