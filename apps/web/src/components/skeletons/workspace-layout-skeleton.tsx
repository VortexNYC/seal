/**
 * WorkspaceLayoutSkeleton Component
 *
 * Loading skeleton for the workspace layout.
 * Shows a sidebar skeleton and main content area.
 *
 * @example
 * ```tsx * // In route definition * export const Route = createFileRoute("/_authenticated/$slug")({ * component: WorkspaceLayout, * pendingComponent: WorkspaceLayoutSkeleton, * }); *```
 */

import { SkeletonLine } from "@cloudflare/kumo/components/loader";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";

export function WorkspaceLayoutSkeleton() {
  return (
    <Sidebar.Provider>
      <div
        className="flex h-dvh w-full overflow-hidden"
        role="status"
        aria-label="Loading workspace"
      >
        {/* Sidebar Skeleton */}
        <aside className="bg-kumo-surface flex h-dvh w-60 flex-col gap-2 border-r p-2">
          {/* Logo/Header */}
          <div className="flex items-center gap-2 px-2 py-4">
            <SkeletonLine className="h-8 w-8 rounded-md" />
            <SkeletonLine className="h-5 w-30" />
          </div>

          {/* Navigation Items */}
          <div className="flex-1 space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2">
                <SkeletonLine className="h-4 w-4" />
                <SkeletonLine className="h-4 w-25" />
              </div>
            ))}
          </div>

          {/* User Section */}
          <div className="border-t pt-2">
            <div className="flex items-center gap-2 px-2 py-2">
              <SkeletonLine className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <SkeletonLine className="h-3 w-20" />
                <SkeletonLine className="h-3 w-25" />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Skeleton */}
        <main className="h-full min-h-0 flex-1 overflow-hidden p-6">
          <div className="space-y-4">
            <SkeletonLine className="h-8 w-50" />
            <SkeletonLine className="h-4 w-75" />
            <div className="grid gap-4 pt-4">
              <SkeletonLine className="h-50 w-full" />
              <SkeletonLine className="h-50 w-full" />
            </div>
          </div>
        </main>
      </div>
    </Sidebar.Provider>
  );
}
