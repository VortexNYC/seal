/**
 * FormSkeleton Component
 *
 * Loading skeleton for form-based content like settings forms,
 * profile forms, and creation forms.
 *
 * @example
 * ```tsx
 * // Default form with 3 fields
 * <FormSkeleton />
 *
 * // Form with custom field count
 * <FormSkeleton fields={5} />
 *
 * // Form without submit button
 * <FormSkeleton fields={4} showSubmitButton={false} />
 * ```
 */

import { Skeleton } from "@/components/ui/skeleton";

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
					<Skeleton className="h-4 w-[120px]" />
					<Skeleton className="h-10 w-full" />
				</div>
			))}

			{showSubmitButton && (
				<div className="flex gap-2 pt-4">
					<Skeleton className="h-10 w-[100px]" />
					<Skeleton className="h-10 w-[100px]" />
				</div>
			)}
		</div>
	);
}
