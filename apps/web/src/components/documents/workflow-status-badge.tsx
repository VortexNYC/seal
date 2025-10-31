import { Badge } from "../ui/badge";

export type DocumentWorkflowStatus =
	| "draft"
	| "sent"
	| "in_progress"
	| "completed"
	| "cancelled"
	| "declined";

interface WorkflowStatusBadgeProps {
	status: DocumentWorkflowStatus | undefined;
	className?: string;
}

export function WorkflowStatusBadge({
	status,
	className,
}: WorkflowStatusBadgeProps) {
	// Default to draft if undefined (for backward compatibility)
	const workflowStatus = status ?? "draft";

	const config: Record<
		DocumentWorkflowStatus,
		{
			label: string;
			variant: "default" | "secondary" | "destructive" | "outline";
			className?: string;
		}
	> = {
		draft: {
			label: "Draft",
			variant: "secondary",
		},
		sent: {
			label: "Sent",
			variant: "default",
			className: "bg-blue-500 hover:bg-blue-600",
		},
		in_progress: {
			label: "In Progress",
			variant: "default",
			className: "bg-yellow-500 hover:bg-yellow-600",
		},
		completed: {
			label: "Completed",
			variant: "default",
			className: "bg-green-500 hover:bg-green-600",
		},
		cancelled: {
			label: "Cancelled",
			variant: "destructive",
		},
		declined: {
			label: "Declined",
			variant: "destructive",
			className: "bg-orange-500 hover:bg-orange-600",
		},
	};

	const { label, variant, className: badgeClassName } = config[workflowStatus];

	return (
		<Badge variant={variant} className={`${badgeClassName} ${className || ""}`}>
			{label}
		</Badge>
	);
}
