import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
	CheckCircle2Icon,
	ClockIcon,
	EyeIcon,
	XCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

interface DocumentProgressBarProps {
	documentId: Id<"documents">;
	className?: string;
	showDetails?: boolean;
}

/**
 * DocumentProgressBar - Visual completion indicator
 *
 * Shows the signing progress of a document with a visual
 * progress bar and breakdown of recipient statuses.
 */
export function DocumentProgressBar({
	documentId,
	className,
	showDetails = true,
}: DocumentProgressBarProps) {
	const progress = useQuery(
		api.documents.recipients_queries.getRecipientProgress,
		{
			documentId,
		},
	);

	if (progress === undefined) {
		return <DocumentProgressBarSkeleton showDetails={showDetails} />;
	}

	if (progress.total === 0) {
		return (
			<div className={cn("text-sm text-muted-foreground", className)}>
				No recipients added yet
			</div>
		);
	}

	const { total, completed, percentComplete, byStatus } = progress;

	// Determine progress bar color based on status
	const getProgressColor = () => {
		if (byStatus.declined > 0) return "bg-red-500";
		if (percentComplete === 100) return "bg-green-500";
		if (percentComplete > 0) return "bg-blue-500";
		return "bg-gray-300";
	};

	return (
		<div className={cn("space-y-3", className)}>
			{/* Progress header */}
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-foreground">
					{completed} of {total} signed
				</span>
				<span className="text-sm font-semibold text-foreground">
					{percentComplete}%
				</span>
			</div>

			{/* Progress bar */}
			<div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
				<div
					className={cn(
						"h-full transition-all duration-500 ease-out rounded-full",
						getProgressColor(),
					)}
					style={{ width: `${percentComplete}%` }}
				/>
			</div>

			{/* Status breakdown */}
			{showDetails && (
				<div className="flex flex-wrap gap-4 text-xs">
					{byStatus.pending > 0 && (
						<StatusPill
							icon={<ClockIcon className="w-3.5 h-3.5" />}
							label="Pending"
							count={byStatus.pending}
							variant="pending"
						/>
					)}
					{byStatus.viewed > 0 && (
						<StatusPill
							icon={<EyeIcon className="w-3.5 h-3.5" />}
							label="Viewed"
							count={byStatus.viewed}
							variant="viewed"
						/>
					)}
					{(byStatus.signed > 0 || byStatus.approved > 0) && (
						<StatusPill
							icon={<CheckCircle2Icon className="w-3.5 h-3.5" />}
							label="Completed"
							count={byStatus.signed + byStatus.approved}
							variant="completed"
						/>
					)}
					{byStatus.declined > 0 && (
						<StatusPill
							icon={<XCircleIcon className="w-3.5 h-3.5" />}
							label="Declined"
							count={byStatus.declined}
							variant="declined"
						/>
					)}
				</div>
			)}
		</div>
	);
}

interface StatusPillProps {
	icon: React.ReactNode;
	label: string;
	count: number;
	variant: "pending" | "viewed" | "completed" | "declined";
}

function StatusPill({ icon, label, count, variant }: StatusPillProps) {
	const variantStyles = {
		pending: "text-amber-700 bg-amber-50 border-amber-200",
		viewed: "text-blue-700 bg-blue-50 border-blue-200",
		completed: "text-green-700 bg-green-50 border-green-200",
		declined: "text-red-700 bg-red-50 border-red-200",
	};

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 px-2 py-1 rounded-full border",
				variantStyles[variant],
			)}
		>
			{icon}
			<span className="font-medium">
				{count} {label}
			</span>
		</div>
	);
}

function DocumentProgressBarSkeleton({
	showDetails,
}: {
	showDetails: boolean;
}) {
	return (
		<div className="space-y-3" role="status" aria-label="Loading progress">
			<div className="flex items-center justify-between">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-10" />
			</div>
			<Skeleton className="h-2.5 w-full rounded-full" />
			{showDetails && (
				<div className="flex gap-4">
					<Skeleton className="h-6 w-20 rounded-full" />
					<Skeleton className="h-6 w-24 rounded-full" />
				</div>
			)}
		</div>
	);
}
