import { Badge } from "@cloudflare/kumo/components/badge";

import type { DocumentWorkflowStatus } from "@/lib/document-status";

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
      variant: "secondary" | "info" | "warning" | "success" | "error";
    }
  > = {
    draft: {
      label: "Draft",
      variant: "secondary",
    },
    sent: {
      label: "Sent",
      variant: "info",
    },
    in_progress: {
      label: "In Progress",
      variant: "warning",
    },
    waiting_for_payment: {
      label: "Awaiting Payment",
      variant: "warning",
    },
    completed: {
      label: "Completed",
      variant: "success",
    },
    cancelled: {
      label: "Cancelled",
      variant: "error",
    },
    declined: {
      label: "Declined",
      variant: "error",
    },
    expired: {
      label: "Expired",
      variant: "error",
    },
  };

  const { label, variant } = config[workflowStatus];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
