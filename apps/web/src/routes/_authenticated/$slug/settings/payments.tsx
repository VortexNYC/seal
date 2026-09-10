/**
 * Payments Settings Page
 *
 * Merchant payment onboarding and account management.
 * Route: /{slug}/settings/payments
 */

import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/$slug/settings/payments")(
  {
    component: PaymentsSettingsPage,
  }
);

function PaymentsSettingsPage() {
  return (
    <PageWrapper
      title="Vortex Connect"
      description="Configure the merchant account that accepts document payments."
    >
      <Card>
        <CardHeader>
          <CardTitle>Vortex Connect</CardTitle>
          <CardDescription>
            Merchant onboarding, account status, and fee policies are managed in
            Vortex Payments. This surface will be rewired to Seal's Cloudflare
            Worker backend once the payments data layer is ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No merchant account to display.
          </p>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
