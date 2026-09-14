/**
 * ListSkeleton Component
 *
 * Loading skeleton for list-based content like member lists,
 * document lists, and invitation lists.
 *
 * @example
 * ```tsx
 * // Default list with 3 items
 * <ListSkeleton />
 *
 * // List with custom item count
 * <ListSkeleton count={5} />
 *
 * // List without avatars
 * <ListSkeleton count={4} showAvatar={false} />
 * ```
 */

import { SkeletonLine } from "@cloudflare/kumo/components/loader";

interface ListSkeletonProps {
  /** Number of list items to show (default: 3) */
  count?: number;
  /** Whether to show avatar skeleton (default: true) */
  showAvatar?: boolean;
  /** Whether to show secondary text line (default: true) */
  showSecondaryText?: boolean;
}

export function ListSkeleton({
  count = 3,
  showAvatar = true,
  showSecondaryText = true,
}: ListSkeletonProps) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading list items">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {showAvatar && <SkeletonLine className="h-10 w-10 rounded-full" />}
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-4 w-[200px] max-w-full" />
            {showSecondaryText && (
              <SkeletonLine className="h-3 w-[160px] max-w-full" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
