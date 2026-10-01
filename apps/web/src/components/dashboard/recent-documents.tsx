/**
 * Dashboard Recent Documents — documents-first work surface (SEA-96).
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
    <LayerCard data-testid="recent-documents">
      <LayerCard.Secondary className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Recent documents</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 gap-1 px-2"
            onClick={() =>
              router.navigate({
                to: "/$slug/documents",
                params: { slug },
                search: { folderId: undefined },
              })
            }
          >
            View all
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </LayerCard.Secondary>
      <LayerCard.Primary className="mx-1.5 mb-1.5 px-3 pb-3">
        {recentDocs.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 px-4 py-10 text-sm">
            <FileTextIcon className="text-muted-foreground/50 size-8" />
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
          <div className="flex flex-col">
            {recentDocs.map((doc) => (
              <Link
                key={doc._id}
                to="/$slug/documents/$documentId"
                params={{ slug, documentId: doc._id }}
                className="group hover:bg-secondary flex min-h-12 items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md">
                    {doc.thumbnailDataUrl ? (
                      <img
                        src={doc.thumbnailDataUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <FileTextIcon className="text-muted-foreground size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">
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
