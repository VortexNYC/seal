/**
 * Dashboard Needs Attention
 *
 * Alert card showing stale recipients, approaching deadlines, and bounced
 * emails. Uses warning surface colors for visual urgency and proper Link
 * elements for accessibility.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangleIcon, ClockIcon, MailXIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocumentAttention } from "@/lib/api-client";

interface NeedsAttentionProps {
  slug: string;
}

export function NeedsAttention({
  slug,
}: NeedsAttentionProps): React.ReactElement | null {
  const { data: attention } = useQuery({
    queryKey: ["api", "documents", "attention", slug],
    queryFn: () => getDocumentAttention(slug),
  });

  if (!attention || attention.totalIssues === 0) return null;

  return (
    <Card
      className="border-warning/30 bg-warning-surface/30"
      style={{
        animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
        animationDelay: "500ms",
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="bg-warning/10 flex h-6 w-6 items-center justify-center rounded-full">
            <AlertTriangleIcon className="text-warning h-3.5 w-3.5" />
          </div>
          <CardTitle className="text-base">Needs Attention</CardTitle>
          <span className="bg-warning/10 text-warning rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
            {attention.totalIssues} issue
            {attention.totalIssues !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {attention.staleRecipients.map((item) => (
            <Link
              key={`stale-${item.documentId}-${item.recipientEmail}`}
              to="/$slug/documents/$documentId"
              params={{ slug, documentId: item.documentId }}
              className="group hover:bg-warning-surface/50 flex items-center gap-3 rounded-lg p-2 transition-colors duration-[var(--duration-fast)]"
            >
              <ClockIcon className="text-warning h-4 w-4 shrink-0" />
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
              params={{ slug, documentId: item.documentId }}
              className="group hover:bg-warning-surface/50 flex items-center gap-3 rounded-lg p-2 transition-colors duration-[var(--duration-fast)]"
            >
              <AlertTriangleIcon className="text-destructive h-4 w-4 shrink-0" />
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
              params={{ slug, documentId: item.documentId }}
              className="group hover:bg-warning-surface/50 flex items-center gap-3 rounded-lg p-2 transition-colors duration-[var(--duration-fast)]"
            >
              <MailXIcon className="text-destructive h-4 w-4 shrink-0" />
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
        </div>
      </CardContent>
    </Card>
  );
}
