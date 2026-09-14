import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";

import { PageWrapper } from "@/components/page-wrapper";

const surfaceCopy = {
  balances: { title: "Balances", description: "Settlement balance status." },
  disputes: { title: "Disputes", description: "Payment dispute operations." },
  history: {
    title: "Payment History",
    description: "Payment event timeline.",
  },
  payouts: { title: "Payouts", description: "Payout readiness and actions." },
  tax: { title: "Tax Documents", description: "Tax document status." },
};

export type VortexMerchantOperationalSurfaceKind =
  | "balances"
  | "payouts"
  | "history"
  | "disputes"
  | "tax";

type VortexMerchantOperationalSurfaceProps = {
  slug: string;
  surface: VortexMerchantOperationalSurfaceKind;
};

export function VortexMerchantOperationalSurface({
  surface,
}: VortexMerchantOperationalSurfaceProps) {
  const copy = surfaceCopy[surface] ?? {
    title: "Payments",
    description: "Payment operations.",
  };

  return (
    <PageWrapper title={copy.title} description={copy.description}>
      <LayerCard>
        <LayerCard.Primary>
          <Text as="h2" size="lg" variant="heading">
            {copy.title}
          </Text>
          <Text as="p" size="sm" variant="secondary">
            Merchant payment operations are managed in Vortex Payments. This
            surface will be rewired to the Cloudflare Worker backend once
            payment data is available there.
          </Text>
        </LayerCard.Primary>
        <LayerCard.Primary>
          <p className="text-kumo-secondary text-sm">No data to display.</p>
        </LayerCard.Primary>
      </LayerCard>
    </PageWrapper>
  );
}
