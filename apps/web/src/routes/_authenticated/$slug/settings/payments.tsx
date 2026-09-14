/**
 * Payments Settings Page
 *
 * Merchant payment onboarding and account management.
 * Route: /{slug}/settings/payments
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";

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
      <LayerCard>
        <LayerCard.Secondary>
          <Text as="h2" variant="heading">
            Vortex Connect
          </Text>
          <Text variant="secondary">
            Merchant onboarding, account status, and fee policies are managed in
            Vortex Payments. This surface will be rewired to Seal's Cloudflare
            Worker backend once the payments data layer is ready.
          </Text>
        </LayerCard.Secondary>
        <LayerCard.Primary>
          <Text variant="secondary" as="p">
            No merchant account to display.
          </Text>
        </LayerCard.Primary>
      </LayerCard>
    </PageWrapper>
  );
}
