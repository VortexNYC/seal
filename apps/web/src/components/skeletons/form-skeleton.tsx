/**
 * FormSkeleton Component
 *
 * Loading skeleton for form-based content like settings forms,
 * profile forms, and creation forms.
 *
 * @example
 * ```tsx * // Default form with 3 fields * <FormSkeleton /> * * // Form with custom field count * <FormSkeleton fields={5} /> * * // Form without submit button * <FormSkeleton fields={4} showSubmitButton={false} /> *```
 */

import { SkeletonLine } from "@cloudflare/kumo/components/loader";
import type { ReactElement } from "react";

import { PageWrapper } from "@/components/page-wrapper";

interface FormSkeletonProps {
  /** Number of form fields to show (default: 3) */
  fields?: number;
  /** Whether to show submit button skeleton (default: true) */
  showSubmitButton?: boolean;
}

export function FormSkeleton({
  fields = 3,
  showSubmitButton = true,
}: FormSkeletonProps) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonLine className="h-4 w-30" />
          <SkeletonLine className="h-10 w-full" />
        </div>
      ))}

      {showSubmitButton && (
        <div className="flex gap-2 pt-4">
          <SkeletonLine className="h-10 w-25" />
          <SkeletonLine className="h-10 w-25" />
        </div>
      )}
    </div>
  );
}

/** Pending state that keeps the same header and column as the loaded page. */
export function PageFormSkeleton({
  title,
}: {
  title: string;
}): ReactElement {
  return (
    <PageWrapper title={title}>
      <FormSkeleton />
    </PageWrapper>
  );
}
