import { expect, test } from "../fixtures/auth";

test.describe("Billing", () => {
  test("billing settings page renders for the seeded pro workspace", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/settings/billing`);

    await expect(
      authenticatedPage.getByText(/subscription|billing/i).first()
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(
      authenticatedPage.getByText(/something went wrong/i)
    ).not.toBeVisible({
      timeout: 1000,
    });
  });
});
