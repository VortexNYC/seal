/**
 * Billing Settings Page
 *
 * Route: /{slug}/settings/billing
 */

import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";
import { BillingSkeleton } from "@/components/skeletons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
  component: BillingSettingsPage,
  pendingComponent: BillingSkeleton,
});

function BillingSettingsPage() {
  return (
    <PageWrapper
      title="Billing"
      description="Manage your subscription and billing information."
    >
      <Card>
        <CardHeader>
          <CardTitle>Subscription and billing</CardTitle>
          <CardDescription>
            Workspace billing is managed in Vortex Payments. Plan management,
            checkout, and the customer portal will be wired into Seal's
            Cloudflare Worker backend once the payments integration is
            available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No billing information to display.
          </p>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
