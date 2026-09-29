/**
 * TemplatesSkeleton Component
 *
 * Loading skeleton for the templates page.
 * Matches SEA-99 list chrome (max-w-6xl + flat toolbar rhythm).
 */

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";

export function TemplatesSkeleton() {
  return (
    <PageWrapper title="Templates">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="bg-muted h-10 w-full max-w-md animate-pulse rounded-md" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription showFooter={false} />
        </div>
      </div>
    </PageWrapper>
  );
}
