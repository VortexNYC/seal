/**
 * MemberDetailsSkeleton Component
 *
 * Loading skeleton for the member details page.
 * Shows profile header and information cards.
 *
 * @example
 * ```tsx
 * // In route definition
 * export const Route = createFileRoute("/_authenticated/$slug/settings/team/$memberId")({
 *   component: MemberDetails,
 *   pendingComponent: MemberDetailsSkeleton,
 * });
 * ```
 */

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function MemberDetailsSkeleton() {
	return (
		<PageWrapper title="Member Details">
			<div
				className="space-y-6"
				role="status"
				aria-label="Loading member details"
			>
				{/* Profile Header Skeleton */}
				<div className="flex items-start gap-4">
					<Skeleton className="h-16 w-16 rounded-full" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-6 w-[200px]" />
						<Skeleton className="h-4 w-[250px]" />
					</div>
				</div>

				{/* Information Cards Skeleton */}
				<div className="grid gap-4 md:grid-cols-2">
					<CardSkeleton showDescription={false} />
					<CardSkeleton showDescription={false} />
				</div>

				{/* Danger Zone Skeleton */}
				<CardSkeleton showDescription showFooter />
			</div>
		</PageWrapper>
	);
}
