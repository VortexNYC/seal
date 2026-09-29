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
        className="mx-auto flex max-w-5xl flex-col gap-5"
        role="status"
        aria-label="Loading dashboard"
      >
        <div className="space-y-1.5">
          <SkeletonLine className="h-7 w-[240px]" />
          <SkeletonLine className="h-4 w-[180px]" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription={false} showFooter={false} />
        </div>
      </div>
    </PageWrapper>
  );
}
