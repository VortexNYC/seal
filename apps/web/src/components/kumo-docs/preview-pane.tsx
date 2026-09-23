import type { JSX } from "react";
import { useEffect, useState } from "react";

import { downloadDocument } from "@/lib/api-client";
import { generatePageThumbnailsFromUrl } from "@/lib/pdf-utils";
import { cn } from "@/lib/utils";

import { CsvViewer } from "./csv-viewer";
import { DocxViewer } from "./docx-viewer";
import { PptxViewer, type PptxSlide } from "./pptx-viewer";
import { XlsxViewer } from "./xlsx-viewer";

export type PreviewFormat =
  | "pdf"
  | "csv"
  | "text"
  | "html"
  | "docx"
  | "xlsx"
  | "pptx"
  | "unknown";

/**
 * Original-file preview pane — routes format to Seal office viewers.
 * PPTX slides come from the upload convert pipeline (LibreOffice → PDF → page images).
 */
export function PreviewPane({
  format,
  title,
  content,
  downloadUrl,
  organizationSlug,
  documentPublicId,
  pageCount,
  className,
}: {
  format: PreviewFormat;
  title?: string;
  content: string | null;
  downloadUrl?: string | null;
  organizationSlug?: string;
  documentPublicId?: string;
  pageCount?: number | null;
  className?: string;
}): JSX.Element {
  return (
    <div
      data-kumo-docs="preview-pane"
      className={cn("flex h-full flex-col", className)}
    >
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{title ?? "Preview"}</span>
        <span className="text-muted-foreground font-mono text-[10px] uppercase">
          {format}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <PreviewBody
          format={format}
          content={content}
          downloadUrl={downloadUrl}
          organizationSlug={organizationSlug}
          documentPublicId={documentPublicId}
          pageCount={pageCount}
        />
      </div>
    </div>
  );
}

function PreviewBody({
  format,
  content,
  downloadUrl,
  organizationSlug,
  documentPublicId,
  pageCount,
}: {
  format: PreviewFormat;
  content: string | null;
  downloadUrl?: string | null;
  organizationSlug?: string;
  documentPublicId?: string;
  pageCount?: number | null;
}): JSX.Element {
  if (format === "csv" && content) {
    return <CsvViewer content={content} className="max-h-full" />;
  }
  if (format === "html" && content) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  if (format === "text" && content) {
    return (
      <pre className="font-mono text-xs whitespace-pre-wrap text-pretty">
        {content}
      </pre>
    );
  }
  if ((format === "docx" || format === "xlsx") && downloadUrl) {
    return <BinaryOfficePreview format={format} downloadUrl={downloadUrl} />;
  }
  if (
    format === "pptx" &&
    organizationSlug &&
    documentPublicId
  ) {
    return (
      <PptxSlidePreview
        organizationSlug={organizationSlug}
        documentPublicId={documentPublicId}
        pageCount={pageCount}
        downloadUrl={downloadUrl}
      />
    );
  }
  if (format === "pptx") {
    return (
      <p className="text-muted-foreground text-sm">
        PowerPoint preview needs the converted PDF.{" "}
        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="text-foreground underline underline-offset-2"
          >
            Download original
          </a>
        ) : null}
      </p>
    );
  }
  if (format === "pdf" && downloadUrl) {
    return (
      <p className="text-muted-foreground text-sm">
        PDF opens in the main viewer.{" "}
        <a
          href={downloadUrl}
          className="text-foreground underline underline-offset-2"
        >
          Download original
        </a>
      </p>
    );
  }
  return <p className="text-muted-foreground text-sm">No preview available.</p>;
}

/**
 * PPTX → LibreOffice PDF (at upload) → page raster slides for PptxViewer.
 */
function PptxSlidePreview({
  organizationSlug,
  documentPublicId,
  pageCount,
  downloadUrl,
}: {
  organizationSlug: string;
  documentPublicId: string;
  pageCount?: number | null;
  downloadUrl?: string | null;
}): JSX.Element {
  const [slides, setSlides] = useState<PptxSlide[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const blob = await downloadDocument(organizationSlug, documentPublicId);
        objectUrl = URL.createObjectURL(blob);
        const thumbs = await generatePageThumbnailsFromUrl(objectUrl, {
          maxPages: pageCount ?? 40,
          maxWidth: 960,
          maxHeight: 540,
        });
        if (cancelled) return;
        setSlides(
          thumbs.map((thumb) => ({
            id: `slide-${thumb.page}`,
            title: `Slide ${thumb.page}`,
            imageUrl: thumb.src,
          }))
        );
      } catch {
        if (!cancelled) setError("Failed to build slide previews");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [organizationSlug, documentPublicId, pageCount]);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Building slides…</p>;
  }
  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-destructive text-sm">{error}</p>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="text-foreground text-sm underline underline-offset-2"
          >
            Download original PPTX
          </a>
        ) : null}
      </div>
    );
  }
  return <PptxViewer slides={slides} className="max-h-full" />;
}

function BinaryOfficePreview({
  format,
  downloadUrl,
}: {
  format: "docx" | "xlsx";
  downloadUrl: string;
}): JSX.Element {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Download failed");
        const data = await response.arrayBuffer();
        if (!cancelled) setBuffer(data);
      } catch {
        if (!cancelled) setError("Failed to load original file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [downloadUrl]);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading original…</p>;
  }
  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }
  if (!buffer) {
    return <p className="text-muted-foreground text-sm">No preview available.</p>;
  }
  if (format === "docx") {
    return <DocxViewer file={buffer} className="max-h-full p-0" />;
  }
  return <XlsxViewer file={buffer} className="max-h-full" />;
}
