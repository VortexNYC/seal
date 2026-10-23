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
      variant: "secondary" | "error";
    }
  > = {
    draft: {
      label: "Draft",
      variant: "secondary",
    },
    sent: {
      label: "Sent",
      variant: "secondary",
    },
    in_progress: {
      label: "In Progress",
      variant: "secondary",
    },
    waiting_for_payment: {
      label: "Awaiting Payment",
      variant: "secondary",
    },
    completed: {
      label: "Completed",
      variant: "secondary",
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
    <Badge variant={variant} className={`px-3.5 py-1.5 text-base ${className ?? ""}`}>
      {label}
    </Badge>
  );
}
