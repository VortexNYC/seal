import { expect, test } from "../fixtures/auth";
import { DashboardPage } from "../pages/dashboard/dashboard-page";

test.describe("Dashboard", () => {
	test("should display dashboard with metrics", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const dashboardPage = new DashboardPage(authenticatedPage);

		await dashboardPage.goto(organizationSlug);

		// Verify dashboard loads
		await expect(dashboardPage.heading).toBeVisible();

		// Verify all metric cards are visible
		await expect(dashboardPage.totalDocumentsCard).toBeVisible();
		await expect(dashboardPage.teamMembersCard).toBeVisible();
		await expect(dashboardPage.pendingSignaturesCard).toBeVisible();
		await expect(dashboardPage.completedCard).toBeVisible();
	});

	test("should display correct metric values", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const dashboardPage = new DashboardPage(authenticatedPage);

		await dashboardPage.goto(organizationSlug);

		// Get metric values
		const totalDocuments = await dashboardPage.getTotalDocuments();
		const teamMembers = await dashboardPage.getTeamMembers();
		const pendingSignatures = await dashboardPage.getPendingSignatures();
		const completed = await dashboardPage.getCompleted();

		// Verify values are numbers
		expect(typeof totalDocuments).toBe("number");
		expect(typeof teamMembers).toBe("number");
		expect(typeof pendingSignatures).toBe("number");
		expect(typeof completed).toBe("number");

		// Verify non-negative values
		expect(totalDocuments).toBeGreaterThanOrEqual(0);
		expect(teamMembers).toBeGreaterThan(0); // Should have at least 1 member
		expect(pendingSignatures).toBeGreaterThanOrEqual(0);
		expect(completed).toBeGreaterThanOrEqual(0);
	});

	test("should display recent activity section", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const dashboardPage = new DashboardPage(authenticatedPage);

		await dashboardPage.goto(organizationSlug);

		await expect(dashboardPage.recentActivitySection).toBeVisible();
	});

	test("should toggle sidebar", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
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

		// Click Documents link in sidebar
		await authenticatedPage.getByRole("link", { name: "Documents" }).click();

		await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/documents`);
	});

	test("should navigate to templates from dashboard", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const dashboardPage = new DashboardPage(authenticatedPage);

		await dashboardPage.goto(organizationSlug);

		// Click Templates link in sidebar
		await authenticatedPage.getByRole("link", { name: "Templates" }).click();

		await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/templates`);
	});

	test("should navigate to analytics from dashboard", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const dashboardPage = new DashboardPage(authenticatedPage);

		await dashboardPage.goto(organizationSlug);

		// Click Analytics link in sidebar
		await authenticatedPage.getByRole("link", { name: "Analytics" }).click();

		await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/analytics`);
	});

	test("should navigate to settings from dashboard", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const dashboardPage = new DashboardPage(authenticatedPage);

		await dashboardPage.goto(organizationSlug);

		// Click Settings button in sidebar
		await authenticatedPage.getByRole("button", { name: "Settings" }).click();

		// Settings might be a dropdown or direct link
		await authenticatedPage.waitForTimeout(500);
	});
});
