/**
 * WorkspaceLayoutSkeleton Component
 *
 * Loading skeleton for the workspace layout.
 * Shows a sidebar skeleton and main content area.
 *
 * @example
 * ```tsx
 * // In route definition
 * export const Route = createFileRoute("/_authenticated/$slug")({
 *   component: WorkspaceLayout,
 *   pendingComponent: WorkspaceLayoutSkeleton,
 * });
 * ```
 */

import { SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceLayoutSkeleton() {
  return (
    <SidebarProvider>
      <div
        className="flex h-dvh w-full overflow-hidden"
        role="status"
        aria-label="Loading workspace"
      >
        {/* Sidebar Skeleton */}
        <aside className="bg-sidebar flex h-dvh w-[240px] flex-col gap-2 border-r p-2">
          {/* Logo/Header */}
          <div className="flex items-center gap-2 px-2 py-4">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-5 w-[120px]" />
          </div>

          {/* Navigation Items */}
          <div className="flex-1 space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-[100px]" />
              </div>
            ))}
          </div>

          {/* User Section */}
          <div className="border-t pt-2">
            <div className="flex items-center gap-2 px-2 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-[80px]" />
                <Skeleton className="h-3 w-[100px]" />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Skeleton */}
        <main className="h-full min-h-0 flex-1 overflow-hidden p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
            <div className="grid gap-4 pt-4">
              <Skeleton className="h-[200px] w-full" />
              <Skeleton className="h-[200px] w-full" />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
