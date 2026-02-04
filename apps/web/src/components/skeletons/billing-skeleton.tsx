/**
 * BillingSkeleton Component
 *
 * Loading skeleton for the billing settings page.
 * Shows plan card + usage card placeholders matching the billing layout.
 */

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function BillingSkeleton() {
  return (
    <PageWrapper title="Billing">
      <div className="space-y-6">
        <Skeleton className="h-5 w-[340px]" />
        {/* Current Plan card */}
        <CardSkeleton showDescription showFooter />
        {/* Usage card */}
        <CardSkeleton showDescription showFooter={false} />
      </div>
    </PageWrapper>
  );
}
