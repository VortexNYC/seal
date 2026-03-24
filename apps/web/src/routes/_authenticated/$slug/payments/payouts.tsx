import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { ConnectNotificationBanner, ConnectPayouts } from "@stripe/react-connect-js";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { PageWrapper } from "@/components/page-wrapper";
import { StripeConnectProvider } from "@/components/stripe/connect-provider";
import { NoStripeConnectState } from "@/components/stripe/no-connect-state";

export const Route = createFileRoute("/_authenticated/$slug/payments/payouts")({
  component: PayoutsPage,
});

function PayoutsPage() {
  const { slug } = Route.useParams();
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const connectedAccount = useQuery(api.stripe.connect_queries.getConnectedAccount, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  if (connectedAccount === undefined || !orgId) {
    return null;
  }

  if (connectedAccount.status !== "connected") {
    return <NoStripeConnectState slug={slug} title="Payouts" />;
  }

  return (
    <PageWrapper title="Payouts" description="Track payouts to your bank account.">
      <StripeConnectProvider organizationId={orgId}>
        <ConnectNotificationBanner />
        <div className="mt-6">
          <ConnectPayouts />
        </div>
      </StripeConnectProvider>
    </PageWrapper>
  );
}
