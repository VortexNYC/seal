/**
 * DashboardSkeleton Component
 *
 * Loading skeleton for the dashboard/home page.
 * Matches the updated layout: greeting → stats → chart/breakdown → documents.
 *
 * @example
 * ```tsx
 * // In route definition
 * export const Route = createFileRoute("/_authenticated/$slug/home")({
 *   component: WorkspaceHome,
 *   pendingComponent: DashboardSkeleton,
 * });
 * ```
 */

import { SkeletonLine } from "@cloudflare/kumo/components/loader";

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";

export function DashboardSkeleton(): React.ReactElement {
  return (
    <PageWrapper title="Dashboard">
      <div className="space-y-6" role="status" aria-label="Loading dashboard">
        {/* Greeting skeleton */}
        <div>
          <SkeletonLine className="mb-2 h-9 w-[280px]" />
          <SkeletonLine className="h-5 w-[220px]" />
        </div>

        {/* Stats cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
        </div>

        {/* Chart + breakdown skeleton */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CardSkeleton showDescription showFooter={false} />
          </div>
          <CardSkeleton showDescription showFooter={false} />
        </div>
      </div>
    </PageWrapper>
  );
}
