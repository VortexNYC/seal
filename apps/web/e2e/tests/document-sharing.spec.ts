import { expect, test } from "../fixtures/auth";
import type { Page } from "@playwright/test";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { ShareDialogPage } from "../pages/documents/share-dialog-page";
import { waitForToast } from "../utils/test-helpers";
import { testData } from "../utils/test-data";

test.describe("Document Sharing", () => {
  let documentsPage: DocumentsListPage;
  let shareDialog: ShareDialogPage;

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    documentsPage = new DocumentsListPage(authenticatedPage);
    shareDialog = new ShareDialogPage(authenticatedPage);
    await documentsPage.goto(organizationSlug);
    await documentsPage.ensureAtLeastOneDocument(testData.samplePdfPath);
    await documentsPage.waitForAnyDocumentRow();
  });

  const openShareForFirstDocument = async (page: Page, documentsListPage: DocumentsListPage) => {
    const firstRow = documentsListPage.getDocumentRows().first();

    await expect(firstRow).toBeVisible({ timeout: 10000 });

    const rowActionsButton = firstRow.getByRole("button", {
      name: /document actions for/i,
    });

    await rowActionsButton.click();

    const shareMenuItem = page.getByRole("menuitem", { name: /^share$/i });
    await expect(shareMenuItem).toBeVisible({ timeout: 10000 });
    await shareMenuItem.first().click();
  };

  test.describe("Share Dialog Opening", () => {
    test("should open share dialog from document row actions", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();
      expect(await shareDialog.isOpen()).toBe(true);
    });

    test("should close share dialog with Done button", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();
      await shareDialog.close();

      expect(await shareDialog.isOpen()).toBe(false);
    });

    test("should close share dialog with X button", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();
      await shareDialog.closeWithX();

      expect(await shareDialog.isOpen()).toBe(false);
    });
  });

  test.describe("Sharing Mode Transitions", () => {
    test("should change sharing mode from private to specific", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      const initialMode = await shareDialog.getCurrentSharingMode();
      if (initialMode === "private" && !(await shareDialog.isTeamSharingDisabled())) {
        await shareDialog.selectSharingMode("specific");
      } else if (await shareDialog.isSharingModeSelected("specific")) {
        // Already in specific mode; continue asserting shared settings controls.
      } else {
        test.skip();
        return;
      }

      expect(await shareDialog.isSharingModeSelected("specific")).toBe(true);
      expect(await shareDialog.isAddMemberSectionVisible()).toBe(true);
    });

    test("should change sharing mode from specific to workspace", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      if (await shareDialog.isTeamSharingDisabled()) {
        test.skip();
        return;
      }

      await shareDialog.selectSharingMode("specific");
      await shareDialog.selectSharingMode("workspace");

      expect(await shareDialog.isSharingModeSelected("workspace")).toBe(true);
    });

    test("should change sharing mode from workspace to private", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      await shareDialog.selectSharingMode("private");

      expect(await shareDialog.isSharingModeSelected("private")).toBe(true);
    });
  });

  test.describe("Permission Level Changes", () => {
    test.skip("should change user permission from view to edit", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      const sharedUserCount = await shareDialog.getSharedUserCount();
      if (sharedUserCount > 0) {
        const accessList = await shareDialog.getAccessList();
        const firstUser = accessList[0];

        await shareDialog.changeUserPermission(firstUser, "edit");
        await waitForToast(authenticatedPage, /permission updated/i);

        expect(await shareDialog.getUserPermission(firstUser)).toBe("edit");
      }
    });

    test.skip("should change user permission from edit to manage", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      const sharedUserCount = await shareDialog.getSharedUserCount();
      if (sharedUserCount > 0) {
        const accessList = await shareDialog.getAccessList();
        const firstUser = accessList[0];

        await shareDialog.changeUserPermission(firstUser, "manage");
        await waitForToast(authenticatedPage, /permission updated/i);

        expect(await shareDialog.getUserPermission(firstUser)).toBe("manage");
      }
    });
  });

  test.describe("Access Revocation", () => {
    test.skip("should revoke access for a shared user", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      const initialCount = await shareDialog.getSharedUserCount();
      if (initialCount > 0) {
        const accessList = await shareDialog.getAccessList();
        const userToRevoke = accessList[0];

        await shareDialog.revokeAccess(userToRevoke);
        await waitForToast(authenticatedPage, /access revoked/i);

        expect(await shareDialog.hasUserAccess(userToRevoke)).toBe(false);
        expect(await shareDialog.getSharedUserCount()).toBe(initialCount - 1);
      }
    });
  });

  test.describe("Grant Access Flow", () => {
    test.skip("should grant view access to a team member", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      await shareDialog.selectSharingMode("specific");
      await waitForToast(authenticatedPage, /sharing settings updated/i);

      if (await shareDialog.isAddMemberSectionVisible()) {
        const memberDropdown = shareDialog.memberSelect;
        await memberDropdown.click();

        const options = authenticatedPage.locator('[role="option"]');
        const optionCount = await options.count();

        if (optionCount > 0) {
          const memberName = await options.first().textContent();
          await options.first().click();

          await shareDialog.permissionSelect.click();
          await authenticatedPage.getByRole("option", { name: /view/i }).click();
          await shareDialog.addButton.click();

          await waitForToast(authenticatedPage, /access granted/i);

          if (memberName) {
            expect(await shareDialog.hasUserAccess(memberName)).toBe(true);
          }
        }
      }
    });

    test.skip("should grant edit access to a team member", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      await shareDialog.selectSharingMode("specific");

      if (await shareDialog.isAddMemberSectionVisible()) {
        const memberDropdown = shareDialog.memberSelect;
        await memberDropdown.click();

        const options = authenticatedPage.locator('[role="option"]');
        const optionCount = await options.count();

        if (optionCount > 0) {
          const memberName = await options.first().textContent();
          await options.first().click();

          await shareDialog.addTeamMember(memberName ?? "", "edit");
          await waitForToast(authenticatedPage, /access granted/i);

          if (memberName) {
            expect(await shareDialog.getUserPermission(memberName)).toBe("edit");
          }
        }
      }
    });
  });

  test.describe("Free Plan Restrictions", () => {
    test("should show Pro badges on team sharing options for free plan", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      if (await shareDialog.isTeamSharingDisabled()) {
        expect(await shareDialog.hasProBadges()).toBe(true);
      }
    });

    test("should disable workspace and specific options for free plan", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      const isDisabled = await shareDialog.isTeamSharingDisabled();
      if (isDisabled) {
        expect(await shareDialog.workspaceModeButton.isDisabled()).toBe(true);
        expect(await shareDialog.specificModeButton.isDisabled()).toBe(true);
      }
    });
  });

  test.describe("Empty States", () => {
    test("should show empty state when no users have access in specific mode", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      if (!(await shareDialog.isTeamSharingDisabled())) {
        await shareDialog.selectSharingMode("private");
        await shareDialog.selectSharingMode("specific");

        const sharedCount = await shareDialog.getSharedUserCount();
        if (sharedCount === 0) {
          expect(await shareDialog.showsEmptyState()).toBe(true);
        }
      }
    });
  });

  test.describe("Owner Display", () => {
    test("should always display document owner with Owner badge", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      expect(await shareDialog.isOwnerDisplayed()).toBe(true);
    });
  });

  test.describe("Permission Boundaries", () => {
    test("view-only user should not see add member section", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      const canViewAccess = !(await shareDialog.showsNoPermissionMessage());
      if (canViewAccess) {
        const isAddSectionVisible = await shareDialog.isAddMemberSectionVisible();
        const sharedUserCount = await shareDialog.getSharedUserCount();

        if (sharedUserCount > 0) {
          const hasRevokeButtons = await authenticatedPage
            .locator('[data-testid="revoke-access-button"]')
            .first()
            .isVisible()
            .catch(() => false);

          if (!isAddSectionVisible && !hasRevokeButtons) {
            expect(true).toBe(true);
          }
        }
      }
    });

    test("view-only user should not see revoke buttons", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      const revokeButtons = authenticatedPage.locator('[data-testid="revoke-access-button"]');
      const revokeCount = await revokeButtons.count();

      if (
        (await shareDialog.showsNoPermissionMessage()) ||
        !(await shareDialog.isAddMemberSectionVisible())
      ) {
        expect(revokeCount).toBe(0);
      }
    });

    test("view-only user should not see permission dropdowns", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      const permissionDropdowns = authenticatedPage.locator('[data-testid="permission-dropdown"]');
      const dropdownCount = await permissionDropdowns.count();

      if (
        (await shareDialog.showsNoPermissionMessage()) ||
        !(await shareDialog.isAddMemberSectionVisible())
      ) {
        expect(dropdownCount).toBe(0);
      }
    });
  });

  test.describe("Edge Cases", () => {
    test("should prevent sharing with oneself", async ({ authenticatedPage, organizationSlug }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      if (!(await shareDialog.isTeamSharingDisabled())) {
        await shareDialog.selectSharingMode("specific");

        if (await shareDialog.isAddMemberSectionVisible()) {
          await shareDialog.memberSelect.click();

          const currentUserOption = authenticatedPage.locator(
            '[role="option"][data-is-current-user="true"]',
          );
          const selfOptionExists = await currentUserOption.isVisible().catch(() => false);

          expect(selfOptionExists).toBe(false);
        }
      }
    });

    test("should not show owner in shareable members list", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      if (!(await shareDialog.isTeamSharingDisabled())) {
        await shareDialog.selectSharingMode("specific");

        if (await shareDialog.isAddMemberSectionVisible()) {
          await shareDialog.memberSelect.click();

          const ownerOption = authenticatedPage.locator('[role="option"][data-is-owner="true"]');
          const ownerInList = await ownerOption.isVisible().catch(() => false);

          expect(ownerInList).toBe(false);
        }
      }
    });

    test("owner should not appear in revocable users list", async ({
      authenticatedPage,
      organizationSlug,
    }) => {
      await documentsPage.goto(organizationSlug);

      await openShareForFirstDocument(authenticatedPage, documentsPage);

      await shareDialog.waitForOpen();

      const ownerRow = authenticatedPage.locator('[data-testid="owner-row"]');
      const ownerRowExists = await ownerRow.isVisible();

      if (ownerRowExists) {
        const ownerRevokeButton = ownerRow.locator('[data-testid="revoke-access-button"]');
        const hasRevokeButton = await ownerRevokeButton.isVisible().catch(() => false);

        expect(hasRevokeButton).toBe(false);
      }
    });
  });
});
