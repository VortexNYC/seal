import type { JSX } from "react";
import { useEffect, useState } from "react";
import mammoth from "mammoth";

import { cn } from "@/lib/utils";

export type DocxViewerProps = {
  /** DOCX File / ArrayBuffer, or pre-rendered HTML */
  file?: File | ArrayBuffer | null;
  html?: string | null;
  className?: string;
};

/**
 * DOCX viewer — Extend docx-viewer. Renders HTML via mammoth (no @extend).
 */
export function DocxViewer({
  file,
  html: htmlProp,
  className,
}: DocxViewerProps): JSX.Element {
  const [html, setHtml] = useState<string | null>(htmlProp ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (htmlProp != null) {
      setHtml(htmlProp);
      return;
    }
    if (!file) {
      setHtml(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const buffer =
          file instanceof ArrayBuffer ? file : await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (!cancelled) setHtml(result.value);
      } catch {
        if (!cancelled) setError("Failed to render DOCX");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, htmlProp]);

  return (
    <div
      data-kumo-docs="docx-viewer"
      className={cn("overflow-auto p-4", className)}
    >
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading document…</p>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {html ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : !loading && !error ? (
        <p className="text-muted-foreground text-sm">No DOCX loaded.</p>
      ) : null}
    </div>
  );
}
