/**
 * Billing Settings Page
 *
 * Route: /{slug}/settings/billing
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";
import { BillingSkeleton } from "@/components/skeletons";

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
      <LayerCard>
        <LayerCard.Secondary>
          <Text as="h2" variant="heading">
            Subscription and billing
          </Text>
          <Text variant="secondary">
            Workspace billing is managed in Vortex Payments. Plan management,
            checkout, and the customer portal will be wired into Seal's
            Cloudflare Worker backend once the payments integration is
            available.
          </Text>
        </LayerCard.Secondary>
        <LayerCard.Primary>
          <Text variant="secondary" as="p">
            No billing information to display.
          </Text>
        </LayerCard.Primary>
      </LayerCard>
    </PageWrapper>
  );
}
