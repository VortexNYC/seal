import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { LockIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";

interface FeatureGateProps {
  tier: "pro" | "enterprise";
  feature: string;
  description: string;
  children: ReactNode;
}

/**
 * Org billing UI was removed for rebuild. While plan metadata still exists,
 * gates stay unlocked via useSubscriptionLimits. Locked UI below is retained
 * only as a fallback if limits are reintroduced.
 */
export function FeatureGate({
  tier,
  feature,
  description,
  children,
}: FeatureGateProps) {
  const { isPro, isEnterprise, isLoading } = useSubscriptionLimits();

  if (isLoading)
    return <div className="pointer-events-none opacity-50">{children}</div>;

  const hasAccess = tier === "pro" ? isPro : isEnterprise;

  if (hasAccess) return <>{children}</>;

  return (
    <div className="space-y-4">
      <LayerCard className="border-dashed">
        <LayerCard.Primary>
          <div className="flex items-start gap-3 py-4">
            <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
              <LockIcon className="text-muted-foreground h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {feature} — available on{" "}
                {tier === "pro" ? "Professional" : "Enterprise"}
              </p>
              <p className="text-muted-foreground text-sm">{description}</p>
            </div>
          </div>
        </LayerCard.Primary>
      </LayerCard>
      <div className="pointer-events-none opacity-50">{children}</div>
    </div>
  );
}
