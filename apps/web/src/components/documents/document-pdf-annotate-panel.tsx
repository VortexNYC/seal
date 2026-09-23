import type { JSX } from "react";
import { useMutation } from "@tanstack/react-query";

import { PdfEditor } from "@/components/kumo-docs/pdf-editor";
import { replaceDocumentPdf } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export type DocumentPdfAnnotatePanelProps = {
  organizationSlug: string;
  documentPublicId: string;
  pdfUrl: string | null;
  onApplied?: () => void;
};

/**
 * Product annotate/edit mode — EmbedPDF PdfEditor + session replace-pdf.
 */
export function DocumentPdfAnnotatePanel({
  organizationSlug,
  documentPublicId,
  pdfUrl,
  onApplied,
}: DocumentPdfAnnotatePanelProps): JSX.Element {
  const saveMutation = useMutation({
    mutationFn: async (buffer: ArrayBuffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const contentBase64 = btoa(binary);
      return replaceDocumentPdf(organizationSlug, documentPublicId, {
        contentBase64,
      });
    },
    onSuccess: () => {
      toast.success("PDF saved to Seal");
      onApplied?.();
    },
    onError: (error) => {
      toast.error("Failed to save PDF", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  return (
    <PdfEditor
      src={pdfUrl}
      saving={saveMutation.isPending}
      onSave={async (buffer) => {
        await saveMutation.mutateAsync(buffer);
      }}
    />
  );
}
