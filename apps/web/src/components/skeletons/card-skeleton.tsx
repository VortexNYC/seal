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
			<CardContent>
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
			</CardContent>
			{showFooter && (
				<div className="px-6 pb-6">
					<Skeleton className="h-9 w-full" />
				</div>
			)}
		</Card>
	);
}
