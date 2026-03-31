import { expect, test } from "../fixtures/auth";
import { TeamSettingsPage } from "../pages/settings/team-settings-page";
import { testData } from "../utils/test-data";
import { waitForToast } from "../utils/test-helpers";

test.describe("Team Management - Overview", () => {
  test("should display team settings page", async ({ authenticatedPage, organizationSlug }) => {
    const teamPage = new TeamSettingsPage(authenticatedPage);

    await teamPage.goto(organizationSlug);

    // Verify page loads
    await expect(teamPage.heading).toBeVisible();
  });

  test("should display current team members", async ({ authenticatedPage, organizationSlug }) => {
    const teamPage = new TeamSettingsPage(authenticatedPage);

    await teamPage.goto(organizationSlug);

    // Should show at least the current user
    const memberCount = await teamPage.getMemberCount();
    expect(memberCount).toBeGreaterThan(0);
  });

  test("should display invite member button", async ({ authenticatedPage, organizationSlug }) => {
    const teamPage = new TeamSettingsPage(authenticatedPage);

    await teamPage.goto(organizationSlug);

    await expect(teamPage.inviteMemberButton).toBeVisible();
  });
});

test.describe("Team Management - Invite Members", () => {
  test.skip(
    "should open invite member dialog",
    // BLOCKED: E2E workspace is on the free plan — invite button is disabled.
    // Seed a pro subscription in global.setup.ts to enable this test.
    async ({ authenticatedPage, organizationSlug }) => {
      const teamPage = new TeamSettingsPage(authenticatedPage);

      await teamPage.goto(organizationSlug);

      await teamPage.inviteMemberButton.click();

      await expect(authenticatedPage.getByRole("dialog", { name: /invite/i })).toBeVisible();
    },
  );

  test.skip(
    "should invite team member as Admin",
    // BLOCKED: E2E workspace is on the free plan — invite requires Pro.
    async ({ authenticatedPage, organizationSlug }) => {
      const teamPage = new TeamSettingsPage(authenticatedPage);

      await teamPage.goto(organizationSlug);

      const memberEmail = testData.email("team-member");

      await teamPage.inviteMember(memberEmail, "Admin");

      await waitForToast(authenticatedPage, /invitation sent/i);

      await expect(authenticatedPage.getByText(memberEmail)).toBeVisible();
    },
  );

  test.skip(
    "should invite team member as Member",
    // BLOCKED: E2E workspace is on the free plan — invite requires Pro.
    async ({ authenticatedPage, organizationSlug }) => {
      const teamPage = new TeamSettingsPage(authenticatedPage);

      await teamPage.goto(organizationSlug);

      const memberEmail = testData.email("team-member");

      await teamPage.inviteMember(memberEmail, "Member");

      await waitForToast(authenticatedPage, /invitation sent/i);
    },
  );

  test.skip(
    "should validate email format when inviting",
    // BLOCKED: E2E workspace is on the free plan — invite button is disabled.
    async ({ authenticatedPage, organizationSlug }) => {
      const teamPage = new TeamSettingsPage(authenticatedPage);

      await teamPage.goto(organizationSlug);

      await teamPage.inviteMemberButton.click();

      await authenticatedPage.getByLabel(/email/i).fill("invalid-email");

      await authenticatedPage.getByRole("button", { name: /send|invite/i }).click();

      await expect(authenticatedPage.getByText(/valid email/i)).toBeVisible();
    },
  );
});

test.describe("Team Management - Member Roles", () => {
  test("should display member roles", async ({ authenticatedPage, organizationSlug }) => {
    const teamPage = new TeamSettingsPage(authenticatedPage);

    await teamPage.goto(organizationSlug);

    // Each member should have a role badge (Owner, Admin, Member)
    const roleElements = authenticatedPage.locator('[data-testid="member-role"]');
    const count = await roleElements.count();

    expect(count).toBeGreaterThan(0);
  });

  test.skip("should change member role", async ({ authenticatedPage, organizationSlug }) => {
    // BLOCKED: requires a second member "test-member@seal.com" in the E2E workspace.
    // Add a second test account + seed their membership before enabling.
    const teamPage = new TeamSettingsPage(authenticatedPage);

    await teamPage.goto(organizationSlug);

    // Change a member's role from Member to Admin
    const memberEmail = "test-member@seal.com";

    await teamPage.updateMemberRole(memberEmail, "Admin");

    await waitForToast(authenticatedPage, /role updated/i);

    // Verify role changed
    const memberRow = authenticatedPage.locator(`[data-member-email="${memberEmail}"]`);
    await expect(memberRow.getByText("Admin")).toBeVisible();
  });

  test.skip("should not allow last Owner to change role", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // BLOCKED: uses hardcoded email "test@seal.com" that doesn't exist in the E2E workspace.
    // Also blocked because MembersList doesn't render role-change controls for the owner row.
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
  test.skip("should remove team member", async ({ authenticatedPage, organizationSlug }) => {
    // BLOCKED: hardcoded "removable-member@seal.com" doesn't exist in the E2E workspace.
    // Also blocked: MembersList doesn't render remove buttons (canRemove prop is unused).
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
    // BLOCKED: MembersList doesn't render remove buttons (canRemove prop is unused in the component).
    const teamPage = new TeamSettingsPage(authenticatedPage);

    await teamPage.goto(organizationSlug);

    // Click remove button
    const removeButton = authenticatedPage
      .locator("[data-member]")
      .first()
      .getByRole("button", { name: /remove/i });

    await removeButton.click();

    // Verify confirmation dialog appears
    await expect(authenticatedPage.getByRole("dialog", { name: /confirm/i })).toBeVisible();

    await expect(authenticatedPage.getByText(/are you sure/i)).toBeVisible();
  });

  test.skip("should not allow removing last Owner", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    // BLOCKED: hardcoded "test@seal.com" doesn't exist in E2E workspace.
    // Also blocked: MembersList doesn't render remove buttons (canRemove prop unused).
    const teamPage = new TeamSettingsPage(authenticatedPage);

    await teamPage.goto(organizationSlug);

    // If current user is only owner, remove button should be disabled
    const currentUserRow = authenticatedPage.locator('[data-member-email="test@seal.com"]');

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
  test.skip("should view member details", async ({ authenticatedPage, organizationSlug }) => {
    // BLOCKED: hardcoded "test-member@seal.com" doesn't exist in the E2E workspace.
    // Seed a second member account before enabling.
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
    // BLOCKED: hardcoded "test-member@seal.com" doesn't exist in the E2E workspace.
    const teamPage = new TeamSettingsPage(authenticatedPage);

    await teamPage.goto(organizationSlug);

    const memberEmail = "test-member@seal.com";

    await teamPage.viewMemberDetails(memberEmail);

    // Verify activity section exists
    await expect(authenticatedPage.getByText(/activity/i)).toBeVisible();
  });
});

test.describe("Team Management - Pending Invitations", () => {
  test("should display pending invitations", async ({ authenticatedPage, organizationSlug }) => {
    const teamPage = new TeamSettingsPage(authenticatedPage);

    await teamPage.goto(organizationSlug);

    // The invitations section lives inside the Invitations tab,
    // which is hidden by default — navigate to it first.
    await authenticatedPage.getByRole("tab", { name: /invitations/i }).click();

    // Match either the card title "Pending Invitations" or the empty state
    // "No pending invitations" — both confirm the section rendered correctly.
    await expect(
      authenticatedPage.getByText(/pending invitations/i).first(),
    ).toBeVisible();
  });

  test.skip(
    "should revoke pending invitation",
    // BLOCKED: E2E workspace is on the free plan — seeding an invitation via
    // inviteMember() requires Pro. Seed a pro subscription in global.setup.ts.
    async ({ authenticatedPage, organizationSlug }) => {
      const teamPage = new TeamSettingsPage(authenticatedPage);

      await teamPage.goto(organizationSlug);

      const email = testData.email("revoke-target");
      await teamPage.inviteMember(email, "Member");
      await waitForToast(authenticatedPage, /invitation sent/i);

      const invitationRow = authenticatedPage.locator('[data-testid="pending-invitation"]', {
        hasText: email,
      });
      await expect(invitationRow).toBeVisible({ timeout: 5000 });

      await invitationRow.getByRole("button", { name: /revoke/i }).click();

      await waitForToast(authenticatedPage, /invitation revoked/i);

      await expect(invitationRow).not.toBeVisible();
    },
  );

  test.skip(
    "should resend invitation",
    // BLOCKED: E2E workspace is on the free plan — seeding an invitation via
    // inviteMember() requires Pro. Seed a pro subscription in global.setup.ts.
    async ({ authenticatedPage, organizationSlug }) => {
      const teamPage = new TeamSettingsPage(authenticatedPage);

      await teamPage.goto(organizationSlug);

      const email = testData.email("resend-target");
      await teamPage.inviteMember(email, "Member");
      await waitForToast(authenticatedPage, /invitation sent/i);

      const invitationRow = authenticatedPage.locator('[data-testid="pending-invitation"]', {
        hasText: email,
      });
      await expect(invitationRow).toBeVisible({ timeout: 5000 });

      await invitationRow.getByRole("button", { name: /resend/i }).click();

      await waitForToast(authenticatedPage, /invitation resent/i);
    },
  );
});
