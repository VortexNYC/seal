import type { JSX } from "react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

import { DocxEditor } from "@/components/kumo-docs/docx-editor";
import { XlsxEditor, type XlsxSheet } from "@/components/kumo-docs/xlsx-editor";
import { CsvViewer } from "@/components/kumo-docs/csv-viewer";
import {
  getDocumentPreview,
  replaceDocumentOriginal,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function sheetsToXlsxBase64(sheets: XlsxSheet[]): string {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  const array = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as Uint8Array;
  return bytesToBase64(array);
}

/**
 * Office edit workflow — Docx/Xlsx editors persist via replace-original + reconvert.
 */
export function DocumentOfficeEditPanel({
  organizationSlug,
  documentPublicId,
  canEdit,
  onSaved,
}: {
  organizationSlug: string;
  documentPublicId: string;
  canEdit: boolean;
  onSaved?: () => void;
}): JSX.Element {
  const [format, setFormat] = useState<"docx" | "xlsx" | "csv" | "unsupported">(
    "unsupported"
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const preview = await getDocumentPreview(
          organizationSlug,
          documentPublicId
        );
        if (cancelled) return;
        if (
          preview.format === "docx" ||
          preview.format === "xlsx" ||
          preview.format === "csv"
        ) {
          setFormat(preview.format);
        } else {
          setFormat("unsupported");
        }
        setDownloadUrl(preview.download_url);
        setCsvContent(preview.content);
        if (
          preview.download_url &&
          (preview.format === "docx" || preview.format === "xlsx")
        ) {
          const response = await fetch(preview.download_url);
          if (!response.ok) throw new Error("download failed");
          const data = await response.arrayBuffer();
          if (!cancelled) setBuffer(data);
        }
      } catch {
        if (!cancelled) setFormat("unsupported");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationSlug, documentPublicId]);

  const saveMutation = useMutation({
    mutationFn: (input: { contentBase64: string; contentType: string }) =>
      replaceDocumentOriginal(organizationSlug, documentPublicId, input),
    onSuccess: () => {
      toast.success("Original saved and PDF refreshed");
      onSaved?.();
    },
    onError: (error) => {
      toast.error("Failed to save original", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  if (loading) {
    return (
      <p className="text-muted-foreground p-4 text-sm">Loading original…</p>
    );
  }
  if (format === "unsupported") {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        Edit mode is available for DOCX, XLSX, and CSV originals. Use Annotate
        for PDF markup.
      </p>
    );
  }
  if (format === "csv") {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          CSV is viewable here. Upload a replacement file to edit cell data.
        </p>
        {csvContent ? <CsvViewer content={csvContent} /> : null}
        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="text-foreground text-sm underline underline-offset-2"
          >
            Download CSV
          </a>
        ) : null}
      </div>
    );
  }
  if (format === "docx" && buffer) {
    return (
      <DocxEditor
        file={buffer}
        saving={saveMutation.isPending}
        onSave={
          canEdit
            ? (html) => {
                const encoded = btoa(unescape(encodeURIComponent(html)));
                saveMutation.mutate({
                  contentBase64: encoded,
                  contentType: "text/html",
                });
              }
            : undefined
        }
      />
    );
  }
  if (format === "xlsx" && buffer) {
    return (
      <XlsxEditor
        file={buffer}
        saving={saveMutation.isPending}
        onSave={
          canEdit
            ? (sheets) => {
                saveMutation.mutate({
                  contentBase64: sheetsToXlsxBase64(sheets),
                  contentType:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                });
              }
            : undefined
        }
      />
    );
  }
  return (
    <p className="text-muted-foreground p-4 text-sm">No editable original.</p>
  );
}
