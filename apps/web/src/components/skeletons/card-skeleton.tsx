import { LayerCard } from "@cloudflare/kumo/components/layer-card";

import { Skeleton } from "@/components/ui/skeleton";

interface CardSkeletonProps {
  /** Whether to show description skeleton (default: true) */
  showDescription?: boolean;
  /** Whether to show footer skeleton (default: false) */
  showFooter?: boolean;
}

export function CardSkeleton({
  showDescription = true,
  showFooter = false,
}: CardSkeletonProps) {
  return (
    <LayerCard role="status" aria-label="Loading card content">
      <LayerCard.Secondary>
        <div className="space-y-2">
          <Skeleton className="h-5 w-[200px]" />
          {showDescription && <Skeleton className="h-4 w-[250px]" />}
        </div>
      </LayerCard.Secondary>
      <LayerCard.Primary>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </LayerCard.Primary>
      {showFooter && (
        <LayerCard.Primary>
          <Skeleton className="h-9 w-full" />
        </LayerCard.Primary>
      )}
    </LayerCard>
  );
}
