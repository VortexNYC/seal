import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";

import { formatDate, getStatusLabel } from "@/lib/formatting";
import { cn } from "@/lib/utils";

import type { DocumentWorkflowStatus } from "./workflow-status-badge";

interface DocumentStatusHeroProps {
  workflowStatus: DocumentWorkflowStatus | undefined;
  createdAt: number;
  compact?: boolean;
}

export function DocumentStatusHero({
  workflowStatus,
  createdAt,
  compact = false,
}: DocumentStatusHeroProps) {
  return (
    <LayerCard
      className={cn("p-4 text-center", compact ? "py-3" : "p-6")}
      aria-live="polite"
    >
      {compact ? null : (
        <Text variant="secondary" size="xs">
          Document Status
        </Text>
      )}
      <Text as="p" variant="heading">
        {getStatusLabel(workflowStatus)}
      </Text>
      {compact ? null : (
        <Text variant="secondary" size="sm">
          Created {formatDate(createdAt)}
        </Text>
      )}
    </LayerCard>
  );
}
