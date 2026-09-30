import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useState } from "react";

import { DocumentPdfOpsPanel } from "@/components/kumo-docs/document-pdf-ops-panel";
import {
  DocumentSplitsPanel,
  createInitialSplits,
  type DocumentSplitGroup,
} from "@/components/kumo-docs/document-splits-panel";
import {
  compressDocumentPdf,
  cropDocumentPdf,
  exportDocumentPdfImages,
  flattenDocumentPdf,
  getDocuments,
  protectDocumentPdf,
  redactDocumentPdf,
  mergeDocumentPdf,
  numberDocumentPdfPages,
  organizeDocumentPdf,
  rotateDocumentPdf,
  splitDocument,
  watermarkDocumentPdf,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

export type DocumentPagesCapabilityPanelProps = {
  organizationSlug: string;
  documentPublicId: string;
  pageCount: number;
  currentPage: number;
  /** When true, sits under the live DocumentCanvas instead of replacing it. */
  docked?: boolean;
  onPdfChanged?: () => void;
  onPageJump?: (page: number) => void;
};

/**
 * Pages capability — rotate / organize / combine / split under the Document
 * Workspace roof. Prefer `docked` so ops chrome keeps the shared EmbedPDF mount.
 */
export function DocumentPagesCapabilityPanel({
  organizationSlug,
  documentPublicId,
  pageCount,
  currentPage,
  docked = false,
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

  const organizeMutation = useMutation({
    mutationFn: (input: { pages: number[] }) =>
      organizeDocumentPdf(organizationSlug, documentPublicId, input),
    onSuccess: (result) => {
      const removed =
        result.fieldsRemoved > 0
          ? ` Removed ${result.fieldsRemoved} field${result.fieldsRemoved === 1 ? "" : "s"} on deleted pages.`
          : "";
      toast.success(`Pages updated (${result.pageCount} pages).${removed}`);
      onPdfChanged?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to organize pages"
      );
    },
  });

  const cropMutation = useMutation({
    mutationFn: (input: {
      crops: Array<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    }) => cropDocumentPdf(organizationSlug, documentPublicId, input),
    onSuccess: (result) => {
      const removed =
        result.fieldsRemoved > 0
          ? ` Removed ${result.fieldsRemoved} field${result.fieldsRemoved === 1 ? "" : "s"} outside the crop.`
          : "";
      toast.success(`Crop applied.${removed}`);
      onPdfChanged?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to crop PDF"
      );
    },
  });

  const watermarkMutation = useMutation({
    mutationFn: (input: {
      text: string;
      position: "diagonal" | "center" | "footer";
      pages?: number[];
    }) => watermarkDocumentPdf(organizationSlug, documentPublicId, input),
    onSuccess: () => {
      toast.success("Watermark applied");
      onPdfChanged?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to watermark PDF"
      );
    },
  });

  const numberPagesMutation = useMutation({
    mutationFn: (input: {
      format: "n" | "n_of_m";
      position: "footer-center" | "footer-right" | "footer-left";
      prefix?: string;
    }) => numberDocumentPdfPages(organizationSlug, documentPublicId, input),
    onSuccess: () => {
      toast.success("Page numbers applied");
      onPdfChanged?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to number pages"
      );
    },
  });

  const compressMutation = useMutation({
    mutationFn: (input: { imageQuality?: number }) =>
      compressDocumentPdf(organizationSlug, documentPublicId, input),
    onSuccess: (result) => {
      const saved = result.sizeBefore - result.sizeAfter;
      const pct =
        result.sizeBefore > 0
          ? Math.round((saved / result.sizeBefore) * 100)
          : 0;
      toast.success(
        pct > 0 ? `Compressed — saved ${pct}%` : "Compressed PDF updated"
      );
      onPdfChanged?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to compress PDF"
      );
    },
  });

  const redactMutation = useMutation({
    mutationFn: (input: {
      regions: Array<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    }) => redactDocumentPdf(organizationSlug, documentPublicId, input),
    onSuccess: (result) => {
      const fields =
        result.fieldsRemoved > 0
          ? ` ${result.fieldsRemoved} field${result.fieldsRemoved === 1 ? "" : "s"} removed.`
          : "";
      toast.success(
        `Redacted — ${result.opsScrubbed} content op${result.opsScrubbed === 1 ? "" : "s"} scrubbed.${fields}`
      );
      onPdfChanged?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to redact PDF"
      );
    },
  });

  const [protectedDownloadUrl, setProtectedDownloadUrl] = useState<
    string | null
  >(null);
  const protectMutation = useMutation({
    mutationFn: (input: { userPassword?: string; ownerPassword?: string }) =>
      protectDocumentPdf(organizationSlug, documentPublicId, input),
    onSuccess: (result) => {
      setProtectedDownloadUrl(result.downloadUrl);
      toast.success("Protected copy ready — download link below");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to protect PDF"
      );
    },
  });

  const flattenMutation = useMutation({
    mutationFn: () => flattenDocumentPdf(organizationSlug, documentPublicId),
    onSuccess: () => {
      toast.success("PDF flattened");
      onPdfChanged?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to flatten PDF"
      );
    },
  });

  const [imagesDownloadUrl, setImagesDownloadUrl] = useState<string | null>(
    null
  );
  const exportImagesMutation = useMutation({
    mutationFn: (input: { format: "png" | "jpeg"; dpi: number }) =>
      exportDocumentPdfImages(organizationSlug, documentPublicId, input),
    onSuccess: (result) => {
      setImagesDownloadUrl(result.downloadUrl);
      toast.success("Images ready — download link below");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to export images"
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
      data-docked={docked ? "true" : "false"}
      className={
        docked
          ? "border-border bg-card flex flex-col gap-3 rounded-xl border p-3"
          : "flex flex-col gap-4"
      }
    >
      <DocumentPdfOpsPanel
        pageCount={pageCount}
        currentPage={currentPage}
        rotating={rotateMutation.isPending}
        organizing={organizeMutation.isPending}
        cropping={cropMutation.isPending}
        compressing={compressMutation.isPending}
        redacting={redactMutation.isPending}
        protecting={protectMutation.isPending}
        flattening={flattenMutation.isPending}
        exporting={exportImagesMutation.isPending}
        protectedDownloadUrl={protectedDownloadUrl}
        imagesDownloadUrl={imagesDownloadUrl}
        watermarking={watermarkMutation.isPending}
        numbering={numberPagesMutation.isPending}
        merging={mergeMutation.isPending}
        mergeCandidates={mergeCandidates}
        onRotate={(input) => rotateMutation.mutate(input)}
        onOrganize={(input) => organizeMutation.mutate(input)}
        onCrop={(input) => cropMutation.mutate(input)}
        onWatermark={(input) => watermarkMutation.mutate(input)}
        onNumberPages={(input) => numberPagesMutation.mutate(input)}
        onCompress={(input) => compressMutation.mutate(input)}
        onRedact={(input) => redactMutation.mutate(input)}
        onProtect={(input) => protectMutation.mutate(input)}
        onFlatten={() => flattenMutation.mutate()}
        onExportImages={(input) => exportImagesMutation.mutate(input)}
        onMerge={(input) => mergeMutation.mutate(input)}
        className={docked ? "p-0" : undefined}
      />
      {pageCount >= 2 ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <DocumentSplitsPanel
            className={docked ? "max-h-[16rem]" : "max-h-[28rem]"}
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
