import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute(
  "/_authenticated/$slug/payments/subscriptions"
)({
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return (
    <PageWrapper
      title="Subscriptions"
      description="Manage recurring payments from your documents."
    >
      <Card>
        <CardHeader>
          <CardTitle>Recurring payments</CardTitle>
          <CardDescription>
            Subscriptions are managed in Vortex Payments. This list will be
            rewired to Seal's Cloudflare Worker backend once payment data is
            available there.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No subscriptions to display.
          </p>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
