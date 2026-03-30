import type { Locator, Page } from "@playwright/test";

import { waitForConvexMutation } from "../../fixtures/convex-helpers";

export class TeamSettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly inviteMemberButton: Locator;
  readonly membersList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Team", exact: true });
    this.inviteMemberButton = page.getByRole("button", {
      name: /invite member/i,
    });
    // The members list is rendered as a Table inside a Card — no data-testid.
    // Use the table element directly.
    this.membersList = page.locator("table").first();
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/${slug}/settings/team`);
    await this.page.waitForLoadState("domcontentloaded");
    // Wait for the page heading to appear (Convex data must resolve first)
    await this.heading.waitFor({ state: "visible", timeout: 5000 });
  }

  async inviteMember(
    email: string,
    role: "Owner" | "Admin" | "Member",
  ): Promise<void> {
    await this.inviteMemberButton.click();

    // Fill invitation form
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByRole("combobox", { name: /role/i }).click();
    await this.page.getByRole("option", { name: role }).click();

    await this.page.getByRole("button", { name: /send|invite/i }).click();

    await waitForConvexMutation(this.page, "inviteTeamMember");
  }

  async removeMember(email: string): Promise<void> {
    const memberRow = this.page.locator(`[data-member-email="${email}"]`);
    await memberRow.getByRole("button", { name: /remove|delete/i }).click();

    // Confirm deletion
    await this.page.getByRole("button", { name: /confirm|yes/i }).click();

    await waitForConvexMutation(this.page, "removeTeamMember");
  }

  async updateMemberRole(
    email: string,
    role: "Owner" | "Admin" | "Member",
  ): Promise<void> {
    const memberRow = this.page.locator(`[data-member-email="${email}"]`);
    await memberRow.getByRole("button", { name: /change role/i }).click();
    await this.page.getByRole("option", { name: role }).click();

    await waitForConvexMutation(this.page, "updateMemberRole");
  }

  async getMemberCount(): Promise<number> {
    // Wait for the members table to render with at least one row
    await this.membersList
      .locator("tbody tr")
      .first()
      .waitFor({ state: "visible", timeout: 5000 });
    const members = await this.membersList.locator("tbody tr").count();
    return members;
  }

  async viewMemberDetails(email: string): Promise<void> {
    const memberRow = this.page.locator(`[data-member-email="${email}"]`);
    await memberRow.click();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
