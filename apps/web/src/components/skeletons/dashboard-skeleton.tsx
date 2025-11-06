/**
 * DashboardSkeleton Component
 *
 * Loading skeleton specifically for the dashboard/home page.
 * Matches the layout of stats cards and recent activity section.
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

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
	return (
		<PageWrapper title="Dashboard">
			<div className="space-y-6" role="status" aria-label="Loading dashboard">
				<div>
					<Skeleton className="h-9 w-[200px] mb-2" />
					<Skeleton className="h-5 w-[300px]" />
				</div>

				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<CardSkeleton showDescription={false} />
					<CardSkeleton showDescription={false} />
					<CardSkeleton showDescription={false} />
					<CardSkeleton showDescription={false} />
				</div>

				<CardSkeleton showDescription showFooter={false} />
			</div>
		</PageWrapper>
	);
}
