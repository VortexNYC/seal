import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { Clock as ClockIcon } from "@phosphor-icons/react";

import { SealLogo } from "@/components/seal-logo";

interface DocumentExpiredPageProps {
  ownerName: string;
}

export function DocumentExpiredPage({ ownerName }: DocumentExpiredPageProps) {
  return (
    <div className="bg-kumo-canvas flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <SealLogo className="mx-auto h-10 w-auto" />

        <LayerCard className="p-8">
          <ClockIcon className="text-kumo-danger mx-auto mb-4 h-6 w-6" />
          <Text as="h1" variant="heading">
            This document has expired
          </Text>
          <Text variant="secondary" size="sm">
            The sender set an expiration date that has passed. Please contact{" "}
            <span className="font-medium">{ownerName}</span> for a new signing
            link.
          </Text>
        </LayerCard>
      </div>
    </div>
  );
}
