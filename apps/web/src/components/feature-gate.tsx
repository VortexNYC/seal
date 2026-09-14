import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useNavigate, useParams } from "@tanstack/react-router";
import { LockIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";

function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

interface FeatureGateProps {
  tier: "pro" | "enterprise";
  feature: string;
  description: string;
  children: ReactNode;
}

export function FeatureGate({
  tier,
  feature,
  description,
  children,
}: FeatureGateProps) {
  const { isPro, isEnterprise, isLoading } = useSubscriptionLimits();
  const { slug } = useParams({ strict: false });
  const navigate = useNavigate();

  // Show locked state while loading to prevent flash of unlocked content
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
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() =>
                  navigate({
                    to: "/$slug/settings/billing",
                    params: { slug: sealAssertPresent(slug) },
                  })
                }
              >
                {tier === "pro" ? "Start free trial" : "Contact sales"}
              </Button>
            </div>
          </div>
        </LayerCard.Primary>
      </LayerCard>
      <div className="pointer-events-none opacity-50">{children}</div>
    </div>
  );
}
