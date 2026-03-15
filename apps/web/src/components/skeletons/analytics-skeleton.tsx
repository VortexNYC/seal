/**
 * AnalyticsSkeleton Component
 *
 * Loading skeleton for the analytics page.
 * Matches the layout: stat cards row + tabbed chart/content area.
 *
 * @example
 * ```tsx
 * export const Route = createFileRoute("/_authenticated/$slug/analytics")({
 *   component: AnalyticsPage,
 *   pendingComponent: AnalyticsSkeleton,
 * });
 * ```
 */

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsSkeleton(): React.ReactElement {
  return (
    <PageWrapper title="Analytics">
      <div className="space-y-6" role="status" aria-label="Loading analytics">
        {/* Stat cards row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
          <CardSkeleton showDescription={false} />
        </div>

        {/* Tab bar skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>

        {/* Chart area skeleton */}
        <CardSkeleton showDescription />
      </div>
    </PageWrapper>
  );
}

/**
 * Inline skeleton for analytics sub-tabs (rendered inside the page's
 * existing PageWrapper — must NOT contain its own PageWrapper).
 */
export function AnalyticsTabSkeleton(): React.ReactElement {
  return (
    <div className="space-y-4" role="status" aria-label="Loading tab content">
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton showDescription />
        <CardSkeleton showDescription />
      </div>
    </div>
  );
}
