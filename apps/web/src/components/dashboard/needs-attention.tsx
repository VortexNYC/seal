/**
 * Dashboard Needs Attention — blocker surface only (SEA-96).
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangleIcon, ClockIcon, MailXIcon } from "lucide-react";

import { getDocumentAttention } from "@/lib/api-client";

interface NeedsAttentionProps {
  organizationSlug: string;
}

export function NeedsAttention({
  organizationSlug,
}: NeedsAttentionProps): React.ReactElement | null {
  const { data: attention } = useQuery({
    queryKey: ["api", "documents", "attention", organizationSlug],
    queryFn: () => getDocumentAttention(organizationSlug),
  });

  if (!attention || attention.totalIssues === 0) return null;

  return (
    <LayerCard
      className="border-warning/30 bg-warning-surface/20"
      data-testid="needs-attention"
    >
      <LayerCard.Secondary className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="text-warning size-4 shrink-0" />
          <h3 className="text-sm font-semibold">Needs attention</h3>
          <span className="bg-warning/10 text-warning rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {attention.totalIssues}
          </span>
        </div>
      </LayerCard.Secondary>
      <LayerCard.Primary className="flex flex-col gap-0.5 px-2 pb-2">
        {attention.staleRecipients.map((item) => (
          <Link
            key={`stale-${item.documentId}-${item.recipientEmail}`}
            to="/$slug/documents/$documentId"
            params={{ slug: organizationSlug, documentId: item.documentId }}
            className="hover:bg-warning-surface/50 flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors"
          >
            <ClockIcon className="text-warning size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-medium">{item.recipientName}</span>{" "}
                hasn&apos;t viewed{" "}
                <span className="font-medium">{item.documentName}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                Pending for {item.daysPending} day
                {item.daysPending !== 1 ? "s" : ""}
              </p>
            </div>
          </Link>
        ))}

        {attention.approachingDeadline.map((item) => (
          <Link
            key={`deadline-${item.documentId}`}
            to="/$slug/documents/$documentId"
            params={{ slug: organizationSlug, documentId: item.documentId }}
            className="hover:bg-warning-surface/50 flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors"
          >
            <AlertTriangleIcon className="text-destructive size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-medium">{item.documentName}</span>{" "}
                deadline in {item.daysRemaining} day
                {item.daysRemaining !== 1 ? "s" : ""}
              </p>
              <p className="text-muted-foreground text-xs">
                {item.unsignedCount} unsigned recipient
                {item.unsignedCount !== 1 ? "s" : ""}
              </p>
            </div>
          </Link>
        ))}

        {attention.bouncedEmails.map((item) => (
          <Link
            key={`bounce-${item.documentId}-${item.recipientEmail}`}
            to="/$slug/documents/$documentId"
            params={{ slug: organizationSlug, documentId: item.documentId }}
            className="hover:bg-warning-surface/50 flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors"
          >
            <MailXIcon className="text-destructive size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                Email bounced for{" "}
                <span className="font-medium">{item.recipientEmail}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                {item.documentName}
              </p>
            </div>
          </Link>
        ))}
      </LayerCard.Primary>
    </LayerCard>
  );
}
