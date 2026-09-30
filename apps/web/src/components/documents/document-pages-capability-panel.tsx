import type { ReactElement } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { DocumentPdfOpsPanel } from "@/components/kumo-docs/document-pdf-ops-panel";
import {
  DocumentSplitsPanel,
  createInitialSplits,
  type DocumentSplitGroup,
} from "@/components/kumo-docs/document-splits-panel";
import {
  getDocuments,
  mergeDocumentPdf,
  rotateDocumentPdf,
  splitDocument,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

export type DocumentPagesCapabilityPanelProps = {
  organizationSlug: string;
  documentPublicId: string;
  pageCount: number;
  currentPage: number;
  onPdfChanged?: () => void;
  onPageJump?: (page: number) => void;
};

/**
 * Pages capability — rotate / combine / split under the Document Workspace roof.
 */
export function DocumentPagesCapabilityPanel({
  organizationSlug,
  documentPublicId,
  pageCount,
  currentPage,
  onPdfChanged,
  onPageJump,
}: DocumentPagesCapabilityPanelProps): ReactElement {
  const navigate = useNavigate();
  const [splits, setSplits] = useState<DocumentSplitGroup[]>(() =>
    createInitialSplits(pageCount)
  );

  const draftsQuery = useQuery({
    queryKey: ["documents", organizationSlug, "drafts-for-merge"],
    queryFn: () => getDocuments(organizationSlug, { workflowStatus: "draft" }),
    staleTime: 30_000,
  });
  const mergeCandidates = (draftsQuery.data ?? [])
    .filter((doc) => doc.publicId !== documentPublicId)
    .map((doc) => ({ publicId: doc.publicId, name: doc.name }));

  const rotateMutation = useMutation({
    mutationFn: (input: { degrees: 90 | 180 | 270; pages?: number[] }) =>
      rotateDocumentPdf(organizationSlug, documentPublicId, input),
    onSuccess: () => {
      toast.success("PDF rotated");
      onPdfChanged?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to rotate PDF"
      );
    },
  });

  const mergeMutation = useMutation({
    mutationFn: (input: { sourcePublicIds: string[]; title?: string }) =>
      mergeDocumentPdf(organizationSlug, documentPublicId, input),
    onSuccess: (result) => {
      toast.success("Merged into a new draft");
      void navigate({
        to: "/$slug/documents/$documentId",
        params: {
          slug: organizationSlug,
          documentId: result.publicId,
        },
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to merge PDFs"
      );
    },
  });

  const splitMutation = useMutation({
    mutationFn: () =>
      splitDocument(
        organizationSlug,
        documentPublicId,
        splits
          .filter((s) => s.pages.length > 0 && s.title.trim().length > 0)
          .map((s) => ({ title: s.title.trim(), pages: s.pages }))
      ),
    onSuccess: (result) => {
      toast.success(
        `Created ${result.documents.length} document${result.documents.length === 1 ? "" : "s"}`
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to split document"
      );
    },
  });

  return (
    <div
      data-testid="document-pages-capability"
      className="flex flex-col gap-4"
    >
      <DocumentPdfOpsPanel
        pageCount={pageCount}
        currentPage={currentPage}
        rotating={rotateMutation.isPending}
        merging={mergeMutation.isPending}
        mergeCandidates={mergeCandidates}
        onRotate={(input) => rotateMutation.mutate(input)}
        onMerge={(input) => mergeMutation.mutate(input)}
      />
      {pageCount >= 2 ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <DocumentSplitsPanel
            className="max-h-[28rem]"
            splits={splits}
            pageCount={pageCount}
            onChange={setSplits}
            onSelectPage={onPageJump}
            onApply={() => splitMutation.mutate()}
            applying={splitMutation.isPending}
          />
        </div>
      ) : null}
    </div>
  );
}
