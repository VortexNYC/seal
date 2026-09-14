/**
 * TeamSettingsSkeleton Component
 *
 * Loading skeleton for the team settings page.
 * Shows tabs and list of members.
 *
 * @example
 * ```tsx
 * // In route definition
 * export const Route = createFileRoute("/_authenticated/$slug/settings/team/")({
 *   component: TeamSettings,
 *   pendingComponent: TeamSettingsSkeleton,
 * });
 * ```
 */

import { SkeletonLine } from "@cloudflare/kumo/components/loader";

import { PageWrapper } from "@/components/page-wrapper";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";

export function TeamSettingsSkeleton() {
  return (
    <PageWrapper title="Team">
      <div role="status" aria-label="Loading team settings">
        <div className="space-y-4">
          <div className="flex gap-2">
            <SkeletonLine className="h-9 w-24" />
            <SkeletonLine className="h-9 w-28" />
          </div>
          <SkeletonLine className="h-9 w-full max-w-md" />
          <ListSkeleton count={5} showAvatar showSecondaryText />
        </div>
      </div>
    </PageWrapper>
  );
}
