/**
 * Dashboard Recent Documents
 *
 * Shows the 5 most recent documents with thumbnails, status badges,
 * and relative timestamps. Uses proper Link elements for accessibility.
 */

import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";

import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { getRecentDocuments } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format-relative-time";

interface RecentDocumentsProps {
  slug: string;
  organizationSlug: string;
}

export function RecentDocuments({
  slug,
  organizationSlug,
}: RecentDocumentsProps): React.ReactElement {
  const router = useRouter();

  const { data: recentDocs } = useSuspenseQuery({
    queryKey: ["api", "documents", "recent"],
    queryFn: () => getRecentDocuments(organizationSlug, 5),
  });

  return (
    <LayerCard
      style={{
        animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
        animationDelay: "300ms",
      }}
    >
      <LayerCard.Secondary>
        <div className="flex flex-row items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Recent Documents</h3>
            <p className="text-muted-foreground text-sm">
              Your latest documents
            </p>
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
        </div>
      </LayerCard.Secondary>
      <LayerCard.Primary>
        {recentDocs.length === 0 ? (
          <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-3 text-sm">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
              <FileTextIcon className="text-muted-foreground/60 h-5 w-5" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-foreground text-sm font-medium">
                Send your first document
              </p>
              <p className="text-muted-foreground max-w-xs text-xs">
                Upload a PDF, add recipients, and send it for signature.
              </p>
            </div>
            <Button
              size="sm"
              type="button"
              variant="primary"
              onClick={() =>
                router.navigate({
                  to: "/$slug/documents",
                  params: { slug },
                  search: { folderId: undefined },
                })
              }
            >
              Upload a PDF
            </Button>
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
      </LayerCard.Primary>
    </LayerCard>
  );
}
