import type { Locator, Page } from "@playwright/test";
import { waitForConvexMutation } from "../../fixtures/convex-helpers";

type SharingMode = "private" | "workspace" | "specific";
type PermissionLevel = "view" | "edit" | "manage";

export class ShareDialogPage {
	readonly page: Page;
	readonly dialogRoot: Locator;
	readonly closeButton: Locator;
	readonly doneButton: Locator;
	readonly privateModeButton: Locator;
	readonly workspaceModeButton: Locator;
	readonly specificModeButton: Locator;
	readonly memberSelect: Locator;
	readonly permissionSelect: Locator;
	readonly addButton: Locator;
	readonly accessList: Locator;
	readonly ownerBadge: Locator;
	readonly subscriptionWarning: Locator;
	readonly proBadges: Locator;

	constructor(page: Page) {
		this.page = page;
		this.dialogRoot = page.locator('[role="dialog"]');
		this.closeButton = this.dialogRoot
			.locator("button")
			.filter({ has: page.locator("svg.lucide-x") })
			.first();
		this.doneButton = this.dialogRoot.getByRole("button", { name: "Done" });
		this.privateModeButton = this.dialogRoot
			.locator("button", { hasText: "Private" })
			.first();
		this.workspaceModeButton = this.dialogRoot
			.locator("button", { hasText: "Workspace" })
			.first();
		this.specificModeButton = this.dialogRoot
			.locator("button", { hasText: "Specific" })
			.first();
		this.memberSelect = this.dialogRoot.locator(
			'[data-testid="member-select"]',
		);
		this.permissionSelect = this.dialogRoot.locator(
			'[data-testid="permission-select"]',
		);
		this.addButton = this.dialogRoot.getByRole("button", { name: "Add" });
		this.accessList = this.dialogRoot.locator('[data-testid="access-list"]');
		this.ownerBadge = this.dialogRoot.locator("text=Owner");
		this.subscriptionWarning = this.dialogRoot.locator(
			'[data-testid="subscription-warning"]',
		);
		this.proBadges = this.dialogRoot.locator("text=Pro");
	}

	async waitForOpen(): Promise<void> {
		await this.dialogRoot.waitFor({ state: "visible" });
		await this.page.waitForLoadState("networkidle");
	}

	async waitForClose(): Promise<void> {
		await this.dialogRoot.waitFor({ state: "hidden" });
	}

	async isOpen(): Promise<boolean> {
		return await this.dialogRoot.isVisible();
	}

	async close(): Promise<void> {
		await this.doneButton.click();
		await this.waitForClose();
	}

	async closeWithX(): Promise<void> {
		await this.closeButton.click();
		await this.waitForClose();
	}

	async selectSharingMode(mode: SharingMode): Promise<void> {
		const button = this.getSharingModeButton(mode);
		await button.click();
		await waitForConvexMutation(this.page, "updateSharingMode");
	}

	private getSharingModeButton(mode: SharingMode): Locator {
		switch (mode) {
			case "private":
				return this.privateModeButton;
			case "workspace":
				return this.workspaceModeButton;
			case "specific":
				return this.specificModeButton;
		}
	}

	async isSharingModeSelected(mode: SharingMode): Promise<boolean> {
		const button = this.getSharingModeButton(mode);
		const classes = await button.getAttribute("class");
		return classes?.includes("border-blue-500") ?? false;
	}

	async getCurrentSharingMode(): Promise<SharingMode | null> {
		for (const mode of ["private", "workspace", "specific"] as SharingMode[]) {
			if (await this.isSharingModeSelected(mode)) {
				return mode;
			}
		}
		return null;
	}

	async isTeamSharingDisabled(): Promise<boolean> {
		const workspaceDisabled = await this.workspaceModeButton.isDisabled();
		const specificDisabled = await this.specificModeButton.isDisabled();
		return workspaceDisabled && specificDisabled;
	}

	async hasProBadges(): Promise<boolean> {
		return await this.proBadges.first().isVisible();
	}

	async hasSubscriptionWarning(): Promise<boolean> {
		return await this.subscriptionWarning.isVisible();
	}

	async getSubscriptionWarningText(): Promise<string | null> {
		if (await this.hasSubscriptionWarning()) {
			return await this.subscriptionWarning.textContent();
		}
		return null;
	}

	async addTeamMember(
		memberName: string,
		permission: PermissionLevel = "view",
	): Promise<void> {
		await this.memberSelect.click();
		await this.page.getByRole("option", { name: memberName }).click();

		await this.permissionSelect.click();
		await this.page
			.getByRole("option", { name: new RegExp(permission, "i") })
			.click();

		await this.addButton.click();
		await waitForConvexMutation(this.page, "grantAccess");
	}

	async getAccessList(): Promise<string[]> {
		const items = this.accessList.locator('[data-testid="access-item"]');
		const count = await items.count();
		const names: string[] = [];
		for (let i = 0; i < count; i++) {
			const name = await items
				.nth(i)
				.locator('[data-testid="access-name"]')
				.textContent();
			if (name) names.push(name);
		}
		return names;
	}

	async getSharedUserCount(): Promise<number> {
		const sharedUsers = this.dialogRoot.locator('[data-testid="shared-user"]');
		return await sharedUsers.count();
	}

	async changeUserPermission(
		userName: string,
		newPermission: PermissionLevel,
	): Promise<void> {
		const userRow = this.dialogRoot.locator('[data-testid="shared-user"]', {
			hasText: userName,
		});
		const permissionDropdown = userRow.locator(
			'[data-testid="permission-dropdown"]',
		);
		await permissionDropdown.click();
		await this.page
			.getByRole("option", { name: new RegExp(newPermission, "i") })
			.click();
		await waitForConvexMutation(this.page, "updateAccessLevel");
	}

	async revokeAccess(userName: string): Promise<void> {
		const userRow = this.dialogRoot.locator('[data-testid="shared-user"]', {
			hasText: userName,
		});
		const revokeButton = userRow.locator(
			'[data-testid="revoke-access-button"]',
		);
		await revokeButton.click();
		await waitForConvexMutation(this.page, "revokeAccess");
	}

	async hasUserAccess(userName: string): Promise<boolean> {
		const userRow = this.dialogRoot.locator('[data-testid="shared-user"]', {
			hasText: userName,
		});
		return await userRow.isVisible();
	}

	async getUserPermission(userName: string): Promise<PermissionLevel | null> {
		const userRow = this.dialogRoot.locator('[data-testid="shared-user"]', {
			hasText: userName,
		});
		if (!(await userRow.isVisible())) return null;

		const permissionDropdown = userRow.locator(
			'[data-testid="permission-dropdown"]',
		);
		const text = await permissionDropdown.textContent();

		if (text?.toLowerCase().includes("view")) return "view";
		if (text?.toLowerCase().includes("edit")) return "edit";
		if (text?.toLowerCase().includes("manage")) return "manage";
		return null;
	}

	async isOwnerDisplayed(): Promise<boolean> {
		return await this.ownerBadge.isVisible();
	}

	async getOwnerName(): Promise<string | null> {
		const ownerRow = this.dialogRoot.locator('[data-testid="owner-row"]');
		if (!(await ownerRow.isVisible())) return null;
		return await ownerRow.locator('[data-testid="owner-name"]').textContent();
	}

	async isAddMemberSectionVisible(): Promise<boolean> {
		return await this.memberSelect.isVisible();
	}

	async showsNoPermissionMessage(): Promise<boolean> {
		const message = this.dialogRoot.getByText("don't have permission");
		return await message.isVisible();
	}

	async showsEmptyState(): Promise<boolean> {
		const emptyState = this.dialogRoot.getByText("No one else has access yet");
		return await emptyState.isVisible();
	}
}
