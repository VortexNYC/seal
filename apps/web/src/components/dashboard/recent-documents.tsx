/**
 * Dashboard Recent Documents — documents-first work surface (SEA-96).
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Empty } from "@cloudflare/kumo/components/empty";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ArrowRight as ArrowRightIcon, FileText as FileTextIcon } from "@phosphor-icons/react";

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
          <Text as="h3" size="sm">
            Recent documents
          </Text>
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowRightIcon}
            onClick={() =>
              router.navigate({
                to: "/$slug/documents",
                params: { slug },
                search: { folderId: undefined },
              })
            }
          >
            View all
          </Button>
        </div>
      </LayerCard.Secondary>
      <LayerCard.Primary className="mx-1.5 mb-1.5 px-3 pb-3">
        {recentDocs.length === 0 ? (
          <Empty
            icon={<FileTextIcon size={24} />}
            title="Send your first document"
            description="Upload a PDF, add recipients, and send it for signature."
            contents={
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
            }
          />
        ) : (
          <div className="flex flex-col">
            {recentDocs.map((doc) => (
              <Button
                key={doc._id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-between"
                onClick={() =>
                  router.navigate({
                    to: "/$slug/documents/$documentId",
                    params: { slug, documentId: doc._id },
                  })
                }
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Text size="sm" DANGEROUS_className="line-clamp-1">
                      {doc.name}
                    </Text>
                    <Text variant="secondary" size="xs">
                      {formatRelativeTime(doc.updatedAt)} · {doc.signedCount}/
                      {doc.recipientCount} signed
                    </Text>
                  </div>
                </div>
                <WorkflowStatusBadge status={doc.workflowStatus} />
              </Button>
            ))}
          </div>
        )}
      </LayerCard.Primary>
    </LayerCard>
  );
}
