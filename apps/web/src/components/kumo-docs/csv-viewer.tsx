import { Table } from "@cloudflare/kumo/components/table";
import { Text } from "@cloudflare/kumo/components/text";
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

function parseDelimited(content: string, delimiter: string): string[][] {
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
      <Text variant="secondary" size="sm" DANGEROUS_className={className}>
        Empty file.
      </Text>
    );
  }

  const [header, ...body] = rows;

  return (
    <div data-kumo-docs="csv-viewer" className={cn("overflow-auto", className)}>
      <Table>
        <Table.Header>
          <Table.Row>
            {header.map((cell, i) => (
              <Table.Head key={i}>{cell}</Table.Head>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {body.map((row, ri) => (
            <Table.Row key={ri}>
              {header.map((_, ci) => (
                <Table.Cell key={ci}>{row[ci] ?? ""}</Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
