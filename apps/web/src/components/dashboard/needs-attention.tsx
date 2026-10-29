/**
 * Dashboard Needs Attention — blocker surface with framed next actions.
 */

import { Text } from "@cloudflare/kumo/components/text";
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
      className="border-kumo-warning/30 bg-kumo-warning-tint/20"
      data-testid="needs-attention"
    >
      <LayerCard.Secondary className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <WarningCircle
            className="text-kumo-warning size-4 shrink-0"
            weight="fill"
          />
          <Text as="h3" variant="heading">Needs you</Text>
          <span className="bg-kumo-warning/10 text-kumo-warning rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {attention.totalIssues}
          </span>
        </div>
        <Text as="p" variant="secondary" size="xs" DANGEROUS_className="mt-1">Open the document and take the action — resend, fix email, or nudge.</Text>
      </LayerCard.Secondary>
      <LayerCard.Primary className="mx-1.5 mb-1.5 flex flex-col gap-0.5 px-3 pb-3">
        {attention.staleRecipients.map((item) => (
          <AttentionRow
            key={`stale-${item.documentId}-${item.recipientEmail}`}
            slug={organizationSlug}
            documentId={item.documentId}
            icon={<Clock className="text-kumo-warning size-4 shrink-0" />}
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
              <WarningCircle className="text-kumo-danger size-4 shrink-0" />
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
              <EnvelopeSimple className="text-kumo-danger size-4 shrink-0" />
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
        "hover:bg-kumo-warning-tint/50 focus-visible:ring-kumo-focus group flex items-center gap-2.5 rounded-md px-2 py-2 focus-visible:ring-2 focus-visible:outline-none"
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <Text as="p" size="sm" truncate>{title}</Text>
        <Text as="p" variant="secondary" size="xs">{detail}</Text>
      </div>
      <span className="text-kumo-default group-hover:text-kumo-link flex shrink-0 items-center gap-0.5 text-xs font-semibold">
        {action}
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
