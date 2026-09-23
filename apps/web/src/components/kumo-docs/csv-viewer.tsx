import type { JSX } from "react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type CsvViewerProps = {
  /** Raw CSV / TSV text */
  content: string;
  delimiter?: "," | "\t" | ";";
  className?: string;
  maxRows?: number;
};

function parseDelimited(
  content: string,
  delimiter: string
): string[][] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(delimiter));
}

/**
 * CSV / TSV table viewer — Extend csv-tsv-viewer capability, Kumo-owned.
 */
export function CsvViewer({
  content,
  delimiter = ",",
  className,
  maxRows = 500,
}: CsvViewerProps): JSX.Element {
  const rows = useMemo(
    () => parseDelimited(content, delimiter).slice(0, maxRows + 1),
    [content, delimiter, maxRows]
  );

  if (rows.length === 0) {
    return (
      <p className={cn("text-muted-foreground p-4 text-sm", className)}>
        Empty file.
      </p>
    );
  }

  const [header, ...body] = rows;

  return (
    <div
      data-kumo-docs="csv-viewer"
      className={cn("overflow-auto", className)}
    >
      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-muted sticky top-0">
          <tr className="border-border border-b">
            {header.map((cell, i) => (
              <th
                key={i}
                className="text-muted-foreground px-2 py-1.5 font-medium whitespace-nowrap"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-border/60 border-b">
              {header.map((_, ci) => (
                <td key={ci} className="px-2 py-1 whitespace-nowrap tabular-nums">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
