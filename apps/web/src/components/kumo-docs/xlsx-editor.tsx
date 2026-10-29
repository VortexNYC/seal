import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Table } from "@cloudflare/kumo/components/table";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Text } from "@cloudflare/kumo/components/text";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

import { cn } from "@/lib/utils";

import type { XlsxSheet } from "./xlsx-viewer";

export type { XlsxSheet };

export type XlsxEditorProps = {
  file?: File | ArrayBuffer | null;
  sheets?: XlsxSheet[];
  className?: string;
  onChange?: (sheets: XlsxSheet[]) => void;
  onSave?: (sheets: XlsxSheet[]) => void;
  saving?: boolean;
};

function workbookToSheets(data: ArrayBuffer): XlsxSheet[] {
  const workbook = XLSX.read(data, { type: "array" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as string[][];
    return { name, rows };
  });
}

/**
 * Editable spreadsheet grid — Extend xlsx-editor capability, Kumo-owned.
 */
export function XlsxEditor({
  file,
  sheets: sheetsProp,
  className,
  onChange,
  onSave,
  saving = false,
}: XlsxEditorProps): JSX.Element {
  const [sheets, setSheets] = useState<XlsxSheet[]>(sheetsProp ?? []);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (sheetsProp) {
      setSheets(sheetsProp);
      return;
    }
    if (!file) return;
    let cancelled = false;
    void (async () => {
      const buffer =
        file instanceof ArrayBuffer ? file : await file.arrayBuffer();
      const next = workbookToSheets(buffer);
      if (!cancelled) {
        setSheets(next);
        onChange?.(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, sheetsProp, onChange]);

  const sheet = sheets[active];

  function updateCell(rowIndex: number, colIndex: number, value: string): void {
    setSheets((prev) => {
      const next = prev.map((s, si) => {
        if (si !== active) return s;
        const rows = s.rows.map((row, ri) => {
          if (ri !== rowIndex) return row;
          const copy = [...row];
          while (copy.length <= colIndex) copy.push("");
          copy[colIndex] = value;
          return copy;
        });
        return { ...s, rows };
      });
      onChange?.(next);
      return next;
    });
  }

  const colCount = Math.max(1, ...(sheet?.rows.map((r) => r.length) ?? [1]));

  return (
    <div
      data-kumo-docs="xlsx-editor"
      className={cn("flex flex-col", className)}
    >
      <div className="border-kumo-line flex items-center justify-between gap-2 border-b px-2 py-1">
        <Tabs
          variant="segmented"
          size="sm"
          value={String(active)}
          onValueChange={(value) => setActive(Number(value))}
          tabs={sheets.map((s, index) => ({
            value: String(index),
            label: s.name,
          }))}
        />
        {onSave ? (
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => onSave(sheets)}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
      {!sheet ? (
        <Text variant="secondary" size="sm">
          No sheet loaded.
        </Text>
      ) : (
        <div className="max-h-128 overflow-auto">
          <Table>
            <Table.Body>
              {sheet.rows.map((row, ri) => (
                <Table.Row key={ri}>
                  {Array.from({ length: colCount }, (_, ci) => (
                    <Table.Cell key={ci} className="p-0">
                      <Input
                        aria-label={`Cell row ${ri + 1} column ${ci + 1}`}
                        value={row[ci] ?? ""}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                      />
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  );
}
