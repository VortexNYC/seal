import { expect, test } from "@playwright/test";

test.describe("Accept invite", () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  test("missing token redirects to sign-in", async ({ page }) => {
    await page.goto("/accept-invite");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("with token renders AcceptInviteScreen actions", async ({ page }) => {
    await page.goto("/accept-invite?token=inv_e2e_placeholder");

    // Screen may error on invalid token fetch; the sign-in CTA must still render.
    await expect(
      page.getByRole("button", { name: /sign in to accept/i })
    ).toBeVisible({ timeout: 15_000 });
  });
});
