/**
 * CardSkeleton Component
 *
 * Loading skeleton for card-based content like dashboard stats,
 * info cards, and summary cards.
 *
 * @example
 * ```tsx
 * // Simple card skeleton
 * <CardSkeleton />
 *
 * // Card skeleton without description
 * <CardSkeleton showDescription={false} />
 *
 * // Multiple cards
 * <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 *   <CardSkeleton />
 *   <CardSkeleton />
 *   <CardSkeleton />
 * </div>
 * ```
 */

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
		<Card role="status" aria-label="Loading card content">
			<CardHeader>
				<CardTitle>
					<Skeleton className="h-5 w-[200px]" />
				</CardTitle>
				{showDescription && (
					<CardDescription>
						<Skeleton className="h-4 w-[250px]" />
					</CardDescription>
				)}
			</CardHeader>
			<CardContent className="space-y-2">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-4 w-3/4" />
			</CardContent>
			{showFooter && (
				<div className="px-6 pb-6">
					<Skeleton className="h-9 w-full" />
				</div>
			)}
		</Card>
	);
}
