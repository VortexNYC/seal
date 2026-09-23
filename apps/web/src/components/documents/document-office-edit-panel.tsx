import type { JSX } from "react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { DocxEditor } from "@/components/kumo-docs/docx-editor";
import { XlsxEditor, type XlsxSheet } from "@/components/kumo-docs/xlsx-editor";
import {
  getDocumentPreview,
  replaceDocumentOriginal,
} from "@/lib/api-client";
import {
  DOCX_CONTENT_TYPE,
  htmlToDocxBase64,
} from "@/lib/html-to-docx";
import { toast } from "@/lib/toast";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_CONTENT_TYPE = "text/csv";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
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

function csvToSheets(content: string): XlsxSheet[] {
  const workbook = XLSX.read(content, { type: "string", raw: false });
  const name = workbook.SheetNames[0] ?? "Sheet1";
  const sheet = workbook.Sheets[name];
  const rows = sheet
    ? (XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as string[][])
    : [[""]];
  return [{ name, rows: rows.length > 0 ? rows : [[""]] }];
}

function sheetsToCsv(sheets: XlsxSheet[]): string {
  const sheet = sheets[0] ?? { name: "Sheet1", rows: [[""]] };
  const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
  return XLSX.utils.sheet_to_csv(worksheet);
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
        setCsvContent(preview.content);
        if (
          preview.download_url &&
          (preview.format === "docx" || preview.format === "xlsx")
        ) {
          const response = await fetch(preview.download_url);
          if (!response.ok) throw new Error("download failed");
          const data = await response.arrayBuffer();
          if (!cancelled) setBuffer(data);
        } else if (
          preview.format === "csv" &&
          !preview.content &&
          preview.download_url
        ) {
          const response = await fetch(preview.download_url);
          if (!response.ok) throw new Error("download failed");
          const text = await response.text();
          if (!cancelled) setCsvContent(text);
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

  const csvSheets = useMemo(
    () => (csvContent !== null ? csvToSheets(csvContent) : null),
    [csvContent]
  );

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
  if (format === "csv" && csvSheets) {
    return (
      <XlsxEditor
        sheets={csvSheets}
        saving={saveMutation.isPending}
        onSave={
          canEdit
            ? (sheets) => {
                saveMutation.mutate({
                  contentBase64: textToBase64(sheetsToCsv(sheets)),
                  contentType: CSV_CONTENT_TYPE,
                });
              }
            : undefined
        }
      />
    );
  }
  if (format === "docx" && buffer) {
    return (
      <DocxEditor
        file={buffer}
        saving={saveMutation.isPending}
        onSave={
          canEdit
            ? async (html) => {
                const contentBase64 = await htmlToDocxBase64(html);
                await saveMutation.mutateAsync({
                  contentBase64,
                  contentType: DOCX_CONTENT_TYPE,
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
                  contentType: XLSX_CONTENT_TYPE,
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
