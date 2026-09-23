import type { JSX } from "react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import {
  PdfEditor,
  type PdfAnnotateOp,
} from "@/components/kumo-docs/pdf-editor";
import { annotateDocumentPdf } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export type DocumentPdfAnnotatePanelProps = {
  organizationSlug: string;
  documentPublicId: string;
  pdfUrl: string | null;
  page: number;
  numPages: number | null;
  width?: number;
  onPageChange: (page: number) => void;
  onLoadSuccess?: (info: { numPages: number }) => void;
  onApplied?: () => void;
};

/**
 * Product annotate mode — PdfEditor + session power/annotate.
 */
export function DocumentPdfAnnotatePanel({
  organizationSlug,
  documentPublicId,
  pdfUrl,
  page,
  numPages,
  width,
  onPageChange,
  onLoadSuccess,
  onApplied,
}: DocumentPdfAnnotatePanelProps): JSX.Element {
  const [operations, setOperations] = useState<PdfAnnotateOp[]>([]);

  const applyMutation = useMutation({
    mutationFn: () =>
      annotateDocumentPdf(organizationSlug, documentPublicId, operations),
    onSuccess: (result) => {
      toast.success(
        `Applied ${result.operationsApplied} annotation${result.operationsApplied === 1 ? "" : "s"}`
      );
      setOperations([]);
      onApplied?.();
    },
    onError: (error) => {
      toast.error("Failed to apply annotations", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  return (
    <PdfEditor
      file={pdfUrl}
      page={page}
      numPages={numPages}
      width={width}
      operations={operations}
      onOperationsChange={setOperations}
      onPageChange={onPageChange}
      onLoadSuccess={onLoadSuccess}
      onApply={() => {
        void applyMutation.mutateAsync();
      }}
      applying={applyMutation.isPending}
    />
  );
}
