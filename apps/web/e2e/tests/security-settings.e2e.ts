import { expect, test } from "../fixtures/auth";

/**
 * Confirms better-auth-ui security surfaces are wired after the 0.2.x bump:
 * sessions list + enable 2FA + change password.
 */
test.describe("Profile security settings", () => {
  test("shows sessions, enable 2FA, and change password forms", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(
      `/${organizationSlug}/settings/profile/security`
    );

    await expect(
      authenticatedPage.getByText(/active sessions/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      authenticatedPage.getByText(/enable two-factor authentication/i)
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("heading", { name: /change password/i })
    ).toBeVisible();
  });
});
