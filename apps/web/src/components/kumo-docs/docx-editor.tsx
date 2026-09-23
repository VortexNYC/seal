import type { JSX } from "react";
import { useEffect, useState } from "react";
import mammoth from "mammoth";

import { Button } from "@cloudflare/kumo/components/button";

import { cn } from "@/lib/utils";

export type DocxEditorProps = {
  file?: File | ArrayBuffer | null;
  html?: string | null;
  className?: string;
  onChange?: (html: string) => void;
  onSave?: (html: string) => void;
  saving?: boolean;
};

/**
 * DOCX HTML editor — Extend docx-editor capability.
 * Edits the mammoth HTML surface; parent owns persistence (Seal has no DOCX write API yet).
 */
export function DocxEditor({
  file,
  html: htmlProp,
  className,
  onChange,
  onSave,
  saving = false,
}: DocxEditorProps): JSX.Element {
  const [html, setHtml] = useState(htmlProp ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (htmlProp != null) {
      setHtml(htmlProp);
      return;
    }
    if (!file) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const buffer =
          file instanceof ArrayBuffer ? file : await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (!cancelled) {
          setHtml(result.value);
          onChange?.(result.value);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, htmlProp, onChange]);

  return (
    <div
      data-kumo-docs="docx-editor"
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex justify-end">
        {onSave ? (
          <Button
            type="button"
            size="sm"
            disabled={saving || loading}
            onClick={() => onSave(html)}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div
          className="border-border prose prose-sm dark:prose-invert min-h-64 max-w-none rounded-lg border bg-white p-4 outline-none"
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => {
            const next = (event.currentTarget as HTMLDivElement).innerHTML;
            setHtml(next);
            onChange?.(next);
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
