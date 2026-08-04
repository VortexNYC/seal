/**
 * Dashboard Recent Documents
 *
 * Shows the 5 most recent documents with thumbnails, status badges,
 * and relative timestamps. Uses proper Link elements for accessibility.
 */

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";

import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format-relative-time";

interface RecentDocumentsProps {
  slug: string;
}

export function RecentDocuments({
  slug,
}: RecentDocumentsProps): React.ReactElement {
  const router = useRouter();

  const { data: recentDocs } = useSuspenseQuery(
    convexQuery(api.dashboard.queries.getRecentDocuments, { limit: 5 })
  );

  return (
    <Card
      style={{
        animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
        animationDelay: "300ms",
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Documents</CardTitle>
          <CardDescription>Your latest documents</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground gap-1.5 transition-colors"
          onClick={() =>
            router.navigate({
              to: "/$slug/documents",
              params: { slug },
              search: { folderId: undefined },
            })
          }
        >
          View all
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {recentDocs.length === 0 ? (
          <div className="text-muted-foreground flex h-32 flex-col items-center justify-center gap-2 text-sm">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
              <FileTextIcon className="text-muted-foreground/60 h-5 w-5" />
            </div>
            <span>No documents yet</span>
          </div>
        ) : (
          <div className="space-y-1">
            {recentDocs.map((doc) => (
              <Link
                key={doc._id}
                to="/$slug/documents/$documentId"
                params={{ slug, documentId: doc._id }}
                className="group hover:bg-secondary -mx-2 flex min-h-[56px] items-center justify-between rounded-lg px-2 py-3 transition-all duration-[var(--duration-fast)] ease-[var(--ease-enter)] sm:py-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="bg-muted flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md transition-shadow duration-[var(--duration-fast)] group-hover:shadow-sm">
                    {doc.thumbnailDataUrl ? (
                      <img
                        src={doc.thumbnailDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileTextIcon className="text-muted-foreground h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="group-hover:text-primary line-clamp-1 truncate text-sm font-medium transition-colors duration-[var(--duration-fast)]">
                      {doc.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelativeTime(doc.updatedAt)} · {doc.signedCount}/
                      {doc.recipientCount} signed
                    </p>
                  </div>
                </div>
                <WorkflowStatusBadge status={doc.workflowStatus} />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
