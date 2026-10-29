/**
 * TemplatesSkeleton Component
 *
 * Loading skeleton for the templates page.
 * Matches the list chrome (flat toolbar rhythm). Width comes from PageWrapper.
 * Uses Kumo SkeletonLine — never hand-rolled animate-pulse blocks.
 */

import { SkeletonLine } from "@cloudflare/kumo/components/loader";

import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";

export function TemplatesSkeleton() {
  return (
    <PageWrapper title="Templates">
      <div className="flex w-full flex-col gap-4">
        <SkeletonLine className="h-10 w-full max-w-md" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription showFooter={false} />
        </div>
      </div>
    </PageWrapper>
  );
}
