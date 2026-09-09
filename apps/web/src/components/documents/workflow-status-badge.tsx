import type { DocumentWorkflowStatus } from "@/lib/document-status";
import { cn } from "@/lib/utils";

import { Badge } from "../ui/badge";

export type { DocumentWorkflowStatus };

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
    waiting_for_payment: {
      label: "Awaiting Payment",
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
    expired: {
      label: "Expired",
      variant: "destructive",
      className: "bg-expired hover:bg-expired/90 text-expired-foreground",
    },
  };

  const { label, variant, className: badgeClassName } = config[workflowStatus];

  return (
    <Badge variant={variant} className={cn(badgeClassName, className)}>
      {label}
    </Badge>
  );
}
