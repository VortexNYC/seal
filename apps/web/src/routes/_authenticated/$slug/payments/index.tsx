import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/$slug/payments/")({
  component: PaymentsOverviewPage,
});

function PaymentsOverviewPage() {
  return (
    <PageWrapper
      title="Payments Overview"
      description="Revenue summary and recent transactions."
    >
      <Card>
        <CardHeader>
          <CardTitle>Revenue and transactions</CardTitle>
          <CardDescription>
            Payment revenue, transactions, and subscription data are managed in
            Vortex Payments. This overview will be rewired to Seal's Cloudflare
            Worker backend once payment data is available there.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No data to display.</p>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
