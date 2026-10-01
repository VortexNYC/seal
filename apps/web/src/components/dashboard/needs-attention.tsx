/**
 * Dashboard Needs Attention — blocker surface with framed next actions.
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import {
  ArrowRight,
  Clock,
  WarningCircle,
  EnvelopeSimple,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { getDocumentAttention } from "@/lib/api-client";
import { MOTION_PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface NeedsAttentionProps {
  organizationSlug: string;
}

export function NeedsAttention({
  organizationSlug,
}: NeedsAttentionProps): ReactElement | null {
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
          <WarningCircle
            className="text-warning size-4 shrink-0"
            weight="fill"
          />
          <h3 className="text-sm font-semibold">Needs you</h3>
          <span className="bg-warning/10 text-warning rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {attention.totalIssues}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Open the document and take the action — resend, fix email, or nudge.
        </p>
      </LayerCard.Secondary>
      <LayerCard.Primary className="mx-1.5 mb-1.5 flex flex-col gap-0.5 px-3 pb-3">
        {attention.staleRecipients.map((item) => (
          <AttentionRow
            key={`stale-${item.documentId}-${item.recipientEmail}`}
            slug={organizationSlug}
            documentId={item.documentId}
            icon={<Clock className="text-warning size-4 shrink-0" />}
            title={
              <>
                <span className="font-medium">{item.recipientName}</span>
                {" hasn't viewed "}
                <span className="font-medium">{item.documentName}</span>
              </>
            }
            detail={`Pending ${item.daysPending} day${item.daysPending !== 1 ? "s" : ""}`}
            action="Resend"
            focus="recipients"
          />
        ))}

        {attention.approachingDeadline.map((item) => (
          <AttentionRow
            key={`deadline-${item.documentId}`}
            slug={organizationSlug}
            documentId={item.documentId}
            icon={
              <WarningCircle className="text-destructive size-4 shrink-0" />
            }
            title={
              <>
                <span className="font-medium">{item.documentName}</span>{" "}
                deadline in {item.daysRemaining} day
                {item.daysRemaining !== 1 ? "s" : ""}
              </>
            }
            detail={`${item.unsignedCount} unsigned`}
            action="Review"
            focus="recipients"
          />
        ))}

        {attention.bouncedEmails.map((item) => (
          <AttentionRow
            key={`bounce-${item.documentId}-${item.recipientEmail}`}
            slug={organizationSlug}
            documentId={item.documentId}
            icon={
              <EnvelopeSimple className="text-destructive size-4 shrink-0" />
            }
            title={
              <>
                Bounce:{" "}
                <span className="font-medium">{item.recipientEmail}</span>
              </>
            }
            detail={item.documentName}
            action="Fix email"
            focus="recipients"
          />
        ))}
      </LayerCard.Primary>
    </LayerCard>
  );
}

function AttentionRow({
  slug,
  documentId,
  icon,
  title,
  detail,
  action,
  focus,
}: {
  slug: string;
  documentId: string;
  icon: ReactElement;
  title: ReactElement;
  detail: string;
  action: string;
  focus: "recipients" | "send";
}): ReactElement {
  return (
    <Link
      to="/$slug/documents/$documentId"
      params={{ slug, documentId }}
      search={{ focus }}
      className={cn(
        MOTION_PRESS,
        "hover:bg-warning-surface/50 focus-visible:ring-ring group flex items-center gap-2.5 rounded-md px-2 py-2 focus-visible:ring-2 focus-visible:outline-none"
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{title}</p>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </div>
      <span className="text-foreground group-hover:text-primary flex shrink-0 items-center gap-0.5 text-xs font-semibold">
        {action}
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
