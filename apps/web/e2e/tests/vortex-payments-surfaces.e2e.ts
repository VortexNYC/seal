import { expect, test } from "../fixtures/auth";

const routes = [
  {
    path: "/settings/payments",
    heading: "Vortex Connect",
  },
  {
    path: "/payments",
    heading: "Payments Overview",
  },
  {
    path: "/payments/balances",
    heading: "Balances",
  },
  {
    path: "/payments/payouts",
    heading: "Payouts",
  },
  {
    path: "/payments/history",
    heading: "Payment History",
  },
  {
    path: "/payments/disputes",
    heading: "Disputes",
  },
  {
    path: "/payments/tax",
    heading: "Tax Documents",
  },
  {
    path: "/payments/subscriptions",
    heading: "Subscriptions",
  },
] as const;

test.describe("Vortex payments surfaces", () => {
  for (const route of routes) {
    test(`${route.path} renders through the Vortex payments surface`, async ({
      authenticatedPage,
      organizationSlug,
    }, testInfo) => {
      await authenticatedPage.goto(`/${organizationSlug}${route.path}`);

      await expect(authenticatedPage.getByRole("heading", { name: route.heading })).toBeVisible({
        timeout: 10000,
      });
      await expect(authenticatedPage.getByText(/something went wrong/i)).not.toBeVisible({
        timeout: 1000,
      });
      await expect(authenticatedPage.getByText(/Stripe Connect|Stripe embedded/i)).not.toBeVisible({
        timeout: 1000,
      });

      await authenticatedPage.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`${route.path.replaceAll("/", "-").slice(1)}.png`),
      });
    });
  }
});
