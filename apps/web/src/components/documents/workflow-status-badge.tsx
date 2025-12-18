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
			className: "bg-info hover:bg-info/90",
		},
		in_progress: {
			label: "In Progress",
			variant: "default",
			className: "bg-warning hover:bg-warning/90 text-warning-foreground",
		},
		completed: {
			label: "Completed",
			variant: "default",
			className: "bg-success hover:bg-success/90",
		},
		cancelled: {
			label: "Cancelled",
			variant: "destructive",
		},
		declined: {
			label: "Declined",
			variant: "destructive",
		},
	};

	const { label, variant, className: badgeClassName } = config[workflowStatus];

	return (
		<Badge variant={variant} className={`${badgeClassName} ${className || ""}`}>
			{label}
		</Badge>
	);
}
