/**
 * DashboardSkeleton — matches SEA-96 layout: greeting → stats → docs + actions.
 */

import { SkeletonLine } from "@cloudflare/kumo/components/loader";

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";

export function DashboardSkeleton(): React.ReactElement {
  return (
    <PageWrapper title="Dashboard">
      <div
        className="flex flex-col gap-5"
        role="status"
        aria-label="Loading dashboard"
      >
        <div className="space-y-1.5">
          <SkeletonLine className="h-7 w-60" />
          <SkeletonLine className="h-4 w-45" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
        </div>

        <div className="lg:grid-cols-split-14 grid gap-4">
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription={false} showFooter={false} />
        </div>
      </div>
    </PageWrapper>
  );
}
