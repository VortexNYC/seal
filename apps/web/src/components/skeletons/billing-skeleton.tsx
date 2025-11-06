/**
 * BillingSkeleton Component
 *
 * Loading skeleton for the billing settings page.
 * Shows the page structure with a single card skeleton.
 *
 * @example
 * ```tsx
 * // In route definition
 * export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
 *   component: BillingSettingsPage,
 *   pendingComponent: BillingSkeleton,
 * });
 * ```
 */

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function BillingSkeleton() {
	return (
		<PageWrapper title="Billing">
			<div className="space-y-6">
				<Skeleton className="h-5 w-[340px]" />
				<CardSkeleton showDescription showFooter={false} />
			</div>
		</PageWrapper>
	);
}
