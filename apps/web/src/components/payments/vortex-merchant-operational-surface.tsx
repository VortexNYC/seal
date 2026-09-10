import { PageWrapper } from "@/components/page-wrapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>
            Merchant payment operations are managed in Vortex Payments. This
            surface will be rewired to the Cloudflare Worker backend once
            payment data is available there.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No data to display.</p>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
