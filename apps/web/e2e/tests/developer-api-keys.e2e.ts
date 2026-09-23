import { expect, test } from "../fixtures/auth";

/**
 * Locks the dogfood regression from #696: create API key must surface the
 * one-time plaintext token. A Zod mismatch used to swallow the 201 response.
 */
test.describe("Developer API keys", () => {
  test("creates a key and shows the one-time plaintext token", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(60_000);

    await authenticatedPage.goto(
      `/${organizationSlug}/settings/developer/api-keys`
    );
    await expect(
      authenticatedPage.getByRole("heading", { name: /api keys/i }).first()
    ).toBeVisible();

    await authenticatedPage
      .getByRole("button", { name: /create api key/i })
      .click();

    const dialog = authenticatedPage.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const nameInput = dialog.getByLabel(/token name|name/i);
    await nameInput.fill("e2e-dogfood-key");
    // Default scope is "read". Submit via keyboard — Kumo dialog controls can
    // sit outside the Playwright click viewport with the floating chrome present.
    await nameInput.press("Enter");

    // Success surface shows the seal_… secret once.
    const createdDialog = authenticatedPage.getByRole("dialog");
    await expect(
      createdDialog.getByRole("heading", { name: /api key created/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(createdDialog.getByLabel(/created token/i)).toHaveValue(
      /^seal_/
    );
  });
});
