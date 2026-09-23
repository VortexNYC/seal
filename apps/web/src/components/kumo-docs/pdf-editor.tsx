import type { JSX } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { PdfViewer } from "./pdf-viewer";

export type PdfAnnotateOp =
  | {
      op: "text";
      page: number;
      x: number;
      y: number;
      text: string;
      size?: number;
    }
  | {
      op: "highlight";
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      color?: string;
    };

export type PdfEditorProps = {
  file: string | File | ArrayBuffer | null;
  page: number;
  numPages: number | null;
  width?: number;
  operations: PdfAnnotateOp[];
  className?: string;
  onLoadSuccess?: (info: { numPages: number }) => void;
  onPageChange?: (page: number) => void;
  onOperationsChange: (ops: PdfAnnotateOp[]) => void;
  onApply?: () => void;
  applying?: boolean;
};

/**
 * PDF annotate editor — Extend pdf-editor capability mapped to Seal annotate ops.
 */
export function PdfEditor({
  file,
  page,
  numPages,
  width,
  operations,
  className,
  onLoadSuccess,
  onPageChange,
  onOperationsChange,
  onApply,
  applying = false,
}: PdfEditorProps): JSX.Element {
  const [draftText, setDraftText] = useState("");

  function addTextOp(): void {
    if (!draftText.trim()) return;
    onOperationsChange([
      ...operations,
      {
        op: "text",
        page,
        x: 72,
        y: 72,
        text: draftText.trim(),
        size: 12,
      },
    ]);
    setDraftText("");
  }

  function removeOp(index: number): void {
    onOperationsChange(operations.filter((_, i) => i !== index));
  }

  return (
    <div
      data-kumo-docs="pdf-editor"
      className={cn("grid gap-4 lg:grid-cols-[1fr_18rem]", className)}
    >
      <PdfViewer
        file={file}
        page={page}
        numPages={numPages}
        width={width}
        onLoadSuccess={onLoadSuccess}
        onPageChange={onPageChange}
      />
      <aside className="border-border bg-card flex flex-col rounded-xl border">
        <div className="border-border border-b px-3 py-2 text-sm font-medium">
          Annotations
        </div>
        <div className="space-y-3 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-editor-text">Add text</Label>
            <Input
              id="pdf-editor-text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Annotation text"
            />
            <Button type="button" size="sm" onClick={addTextOp}>
              <Plus className="size-3.5" />
              Place on page {page}
            </Button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {operations.map((op, index) => (
              <li
                key={index}
                className="border-border flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium capitalize">{op.op}</div>
                  <div className="text-muted-foreground tabular-nums">
                    p.{op.page}
                    {op.op === "text" ? ` · ${op.text}` : ""}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOp(index)}
                  aria-label="Remove"
                >
                  <Trash className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          {onApply ? (
            <Button
              type="button"
              onClick={onApply}
              disabled={applying || operations.length === 0}
              className="w-full"
            >
              {applying ? "Applying…" : "Apply to PDF"}
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
