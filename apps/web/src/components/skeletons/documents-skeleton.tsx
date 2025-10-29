/**
 * DocumentsSkeleton Component
 *
 * Loading skeleton for the documents page.
 * Shows filter buttons and a grid of document card skeletons.
 *
 * @example
 * ```tsx
 * // In route definition
 * export const Route = createFileRoute("/_authenticated/$slug/documents")({
 *   component: DocumentsPage,
 *   pendingComponent: DocumentsSkeleton,
 * });
 * ```
 */

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentsSkeleton() {
	return (
		<PageWrapper title="Documents">
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<Skeleton className="h-5 w-[300px]" />
					<Skeleton className="h-10 w-[160px]" />
				</div>

				{/* Filter Tabs Skeleton */}
				<div className="flex gap-2">
					<Skeleton className="h-10 w-[130px]" />
					<Skeleton className="h-10 w-[130px]" />
					<Skeleton className="h-10 w-[140px]" />
				</div>

				{/* Documents Grid Skeleton */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					<CardSkeleton showDescription showFooter={false} />
					<CardSkeleton showDescription showFooter={false} />
					<CardSkeleton showDescription showFooter={false} />
					<CardSkeleton showDescription showFooter={false} />
					<CardSkeleton showDescription showFooter={false} />
					<CardSkeleton showDescription showFooter={false} />
				</div>
			</div>
		</PageWrapper>
	);
}
