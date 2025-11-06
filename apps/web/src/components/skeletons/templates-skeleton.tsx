/**
 * TemplatesSkeleton Component
 *
 * Loading skeleton for the templates page.
 * Shows the page structure with a single card skeleton.
 *
 * @example
 * ```tsx
 * // In route definition
 * export const Route = createFileRoute("/_authenticated/$slug/templates")({
 *   component: TemplatesPage,
 *   pendingComponent: TemplatesSkeleton,
 * });
 * ```
 */

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function TemplatesSkeleton() {
	return (
		<PageWrapper title="Templates">
			<div className="space-y-6">
				<Skeleton className="h-5 w-[280px]" />
				<CardSkeleton showDescription showFooter={false} />
			</div>
		</PageWrapper>
	);
}
