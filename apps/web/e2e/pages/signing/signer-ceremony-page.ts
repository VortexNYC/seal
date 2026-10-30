import { expect, type Page } from "@playwright/test";

/**
 * Public `/sign/$token` pre-document gates: invite → privacy → ESIGN consent.
 * Selectors are data-testid-only (see apps/web/AGENTS.md).
 */
export class SignerCeremonyPage {
  constructor(readonly page: Page) {}

  async goto(signingToken: string): Promise<void> {
    await this.page.goto(`/sign/${signingToken}`);
  }

  async expectPreflightSurfaceVisible(timeout = 10_000): Promise<void> {
    await expect(
      this.page
        .getByTestId("signer-invite-gate")
        .or(this.page.getByTestId("signer-privacy-notice"))
        .or(this.page.getByTestId("signer-esign-consent"))
    ).toBeVisible({ timeout });
    await expect(this.page.getByText(/something went wrong/i)).not.toBeVisible({
      timeout: 1000,
    });
  }

  async passInviteGateIfVisible(timeout = 5000): Promise<void> {
    const gate = this.page.getByTestId("signer-invite-gate");
    if (await gate.isVisible({ timeout }).catch(() => false)) {
      await this.page.getByTestId("signer-invite-start").click();
    }
  }

  async passPrivacyNoticeIfVisible(timeout = 5000): Promise<void> {
    const notice = this.page.getByTestId("signer-privacy-notice");
    if (await notice.isVisible({ timeout }).catch(() => false)) {
      await this.page.getByTestId("signer-privacy-ack").click();
      await this.page.getByTestId("signer-privacy-continue").click();
      await expect(this.page.getByTestId("signer-esign-consent")).toBeVisible({
        timeout: 15_000,
      });
    }
  }

  async passEsignConsentIfVisible(timeout = 5000): Promise<void> {
    const consent = this.page.getByTestId("signer-esign-consent");
    if (await consent.isVisible({ timeout }).catch(() => false)) {
      await this.page.getByTestId("signer-esign-ack").click();
      await this.page.getByTestId("signer-esign-accept").click();
      await expect(
        this.page
          .getByTestId("signer-next-field")
          .or(
            this.page.getByRole("button", {
              name: /signature required field/i,
            })
          )
          .or(this.page.getByTestId("signer-view-toggle"))
      ).toBeVisible({ timeout: 20_000 });
    }
  }

  /** Walk invite → privacy → consent when each gate is shown. */
  async completePreflightGates(): Promise<void> {
    await this.passInviteGateIfVisible();
    await this.passPrivacyNoticeIfVisible();
    await this.passEsignConsentIfVisible();
  }
}
