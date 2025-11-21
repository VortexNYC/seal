import { expect, test } from "../fixtures/auth";
import { TeamSettingsPage } from "../pages/settings/team-settings-page";
import { testData } from "../utils/test-data";
import { waitForToast } from "../utils/test-helpers";

test.describe("Team Management - Overview", () => {
	test("should display team settings page", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Verify page loads
		await expect(teamPage.heading).toBeVisible();
	});

	test("should display current team members", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Should show at least the current user
		const memberCount = await teamPage.getMemberCount();
		expect(memberCount).toBeGreaterThan(0);
	});

	test("should display invite member button", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		await expect(teamPage.inviteMemberButton).toBeVisible();
	});
});

test.describe("Team Management - Invite Members", () => {
	test.skip("should open invite member dialog", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Click invite button
		await teamPage.inviteMemberButton.click();

		// Verify dialog appears
		await expect(
			authenticatedPage.getByRole("dialog", { name: /invite/i }),
		).toBeVisible();
	});

	test.skip("should invite team member as Admin", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		const memberEmail = testData.email("team-member");

		// Invite member
		await teamPage.inviteMember(memberEmail, "Admin");

		await waitForToast(authenticatedPage, /invitation sent/i);

		// Verify invitation appears in pending invitations
		await expect(authenticatedPage.getByText(memberEmail)).toBeVisible();
	});

	test.skip("should invite team member as Member", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		const memberEmail = testData.email("team-member");

		await teamPage.inviteMember(memberEmail, "Member");

		await waitForToast(authenticatedPage, /invitation sent/i);
	});

	test.skip("should validate email format when inviting", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		await teamPage.inviteMemberButton.click();

		// Enter invalid email
		await authenticatedPage.getByLabel(/email/i).fill("invalid-email");

		await authenticatedPage
			.getByRole("button", { name: /send|invite/i })
			.click();

		// Should show validation error
		await expect(authenticatedPage.getByText(/valid email/i)).toBeVisible();
	});
});

test.describe("Team Management - Member Roles", () => {
	test.skip("should display member roles", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Each member should have a role badge (Owner, Admin, Member)
		const roleElements = authenticatedPage.locator(
			'[data-testid="member-role"]',
		);
		const count = await roleElements.count();

		expect(count).toBeGreaterThan(0);
	});

	test.skip("should change member role", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Change a member's role from Member to Admin
		const memberEmail = "test-member@seal.com";

		await teamPage.updateMemberRole(memberEmail, "Admin");

		await waitForToast(authenticatedPage, /role updated/i);

		// Verify role changed
		const memberRow = authenticatedPage.locator(
			`[data-member-email="${memberEmail}"]`,
		);
		await expect(memberRow.getByText("Admin")).toBeVisible();
	});

	test.skip("should not allow last Owner to change role", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Try to change own role if you're the only owner
		const currentUserEmail = "test@seal.com";

		// Attempt to change role
		const changeRoleButton = authenticatedPage
			.locator(`[data-member-email="${currentUserEmail}"]`)
			.getByRole("button", { name: /change role/i });

		if (await changeRoleButton.isVisible()) {
			await changeRoleButton.click();

			// Should show error or disable Owner option
			const _ownerOption = authenticatedPage.getByRole("option", {
				name: "Member",
			});

			// If there's only one owner, this should fail
		}
	});
});

test.describe("Team Management - Remove Members", () => {
	test.skip("should remove team member", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		const memberEmail = "removable-member@seal.com";

		const initialCount = await teamPage.getMemberCount();

		// Remove member
		await teamPage.removeMember(memberEmail);

		await waitForToast(authenticatedPage, /removed/i);

		// Verify member count decreased
		const newCount = await teamPage.getMemberCount();
		expect(newCount).toBe(initialCount - 1);

		// Verify member is gone
		await expect(authenticatedPage.getByText(memberEmail)).not.toBeVisible();
	});

	test.skip("should confirm before removing member", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Click remove button
		const removeButton = authenticatedPage
			.locator("[data-member]")
			.first()
			.getByRole("button", { name: /remove/i });

		await removeButton.click();

		// Verify confirmation dialog appears
		await expect(
			authenticatedPage.getByRole("dialog", { name: /confirm/i }),
		).toBeVisible();

		await expect(authenticatedPage.getByText(/are you sure/i)).toBeVisible();
	});

	test.skip("should not allow removing last Owner", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// If current user is only owner, remove button should be disabled
		const currentUserRow = authenticatedPage.locator(
			'[data-member-email="test@seal.com"]',
		);

		const removeButton = currentUserRow.getByRole("button", {
			name: /remove/i,
		});

		// Should be disabled or show error on click
		if (await removeButton.isVisible()) {
			const isDisabled = await removeButton.isDisabled();
			expect(isDisabled).toBe(true);
		}
	});
});

test.describe("Team Management - Member Details", () => {
	test.skip("should view member details", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		const memberEmail = "test-member@seal.com";

		// Click on member to view details
		await teamPage.viewMemberDetails(memberEmail);

		// Verify navigated to member details page
		await expect(authenticatedPage).toHaveURL(/settings\/team\/[a-z0-9]+/);

		// Verify member details are shown
		await expect(authenticatedPage.getByText(memberEmail)).toBeVisible();
	});

	test.skip("should display member activity history", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		const memberEmail = "test-member@seal.com";

		await teamPage.viewMemberDetails(memberEmail);

		// Verify activity section exists
		await expect(authenticatedPage.getByText(/activity/i)).toBeVisible();
	});
});

test.describe("Team Management - Pending Invitations", () => {
	test.skip("should display pending invitations", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Verify pending invitations section exists
		await expect(
			authenticatedPage.getByText(/pending invitations/i),
		).toBeVisible();
	});

	test.skip("should cancel pending invitation", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Cancel an invitation
		const cancelButton = authenticatedPage
			.locator('[data-testid="pending-invitation"]')
			.first()
			.getByRole("button", { name: /cancel/i });

		await cancelButton.click();

		await waitForToast(authenticatedPage, /cancelled/i);
	});

	test.skip("should resend invitation", async ({
		authenticatedPage,
		organizationSlug,
	}) => {
		const teamPage = new TeamSettingsPage(authenticatedPage);

		await teamPage.goto(organizationSlug);

		// Resend an invitation
		const resendButton = authenticatedPage
			.locator('[data-testid="pending-invitation"]')
			.first()
			.getByRole("button", { name: /resend/i });

		await resendButton.click();

		await waitForToast(authenticatedPage, /resent/i);
	});
});
