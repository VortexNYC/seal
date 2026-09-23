import type { JSX } from "react";

import { cn } from "@/lib/utils";

export type PreviewFormat = "pdf" | "csv" | "text" | "html" | "unknown";

/**
 * Lightweight original-file preview pane (pairs with document-agent preview API).
 * Not a DOCX/XLSX editor — view-only.
 */
export function PreviewPane({
  format,
  title,
  content,
  className,
}: {
  format: PreviewFormat;
  title?: string;
  content: string | null;
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
        {!content ? (
          <p className="text-muted-foreground text-sm">No preview available.</p>
        ) : format === "csv" ? (
          <CsvTable raw={content} />
        ) : format === "html" ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <pre className="font-mono text-xs whitespace-pre-wrap text-pretty">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}

function CsvTable({ raw }: { raw: string }): JSX.Element {
  const rows = raw
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(","));
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Empty CSV.</p>;
  }
  const [header, ...body] = rows;
  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead>
        <tr className="border-border border-b">
          {header.map((cell, i) => (
            <th key={i} className="text-muted-foreground px-2 py-1 font-medium">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, ri) => (
          <tr key={ri} className="border-border/60 border-b">
            {row.map((cell, ci) => (
              <td key={ci} className="px-2 py-1 tabular-nums">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
