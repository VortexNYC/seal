import { Text } from "@cloudflare/kumo/components/text";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { cn } from "@/lib/utils";

import { CsvViewer } from "./csv-viewer";

export type XlsxSheet = {
  name: string;
  rows: string[][];
};

export type XlsxViewerProps = {
  file?: File | ArrayBuffer | null;
  sheets?: XlsxSheet[];
  className?: string;
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
 * Excel workbook viewer — Extend xlsx-viewer, sheetjs-backed, Kumo chrome.
 */
export function XlsxViewer({
  file,
  sheets: sheetsProp,
  className,
}: XlsxViewerProps): JSX.Element {
  const [sheets, setSheets] = useState<XlsxSheet[]>(sheetsProp ?? []);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sheetsProp) {
      setSheets(sheetsProp);
      setActive(0);
      return;
    }
    if (!file) {
      setSheets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const buffer =
          file instanceof ArrayBuffer ? file : await file.arrayBuffer();
        const next = workbookToSheets(buffer);
        if (!cancelled) {
          setSheets(next);
          setActive(0);
        }
      } catch {
        if (!cancelled) setError("Failed to read workbook");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, sheetsProp]);

  const csv = useMemo(() => {
    const sheet = sheets[active];
    if (!sheet) return "";
    return sheet.rows.map((row) => row.join(",")).join("\n");
  }, [sheets, active]);

  return (
    <div
      data-kumo-docs="xlsx-viewer"
      className={cn("flex flex-col", className)}
    >
      {sheets.length > 1 ? (
        <Tabs
          variant="segmented"
          size="sm"
          value={String(active)}
          onValueChange={(value) => setActive(Number(value))}
          tabs={sheets.map((sheet, index) => ({
            value: String(index),
            label: sheet.name,
          }))}
        />
      ) : null}
      {loading ? (
        <Text as="p" variant="secondary" size="sm" DANGEROUS_className="p-4">Loading workbook…</Text>
      ) : null}
      {error ? <Text as="p" variant="error" size="sm" DANGEROUS_className="p-4">{error}</Text> : null}
      {!loading && !error && sheets.length === 0 ? (
        <Text as="p" variant="secondary" size="sm" DANGEROUS_className="p-4">No workbook loaded.</Text>
      ) : null}
      {csv ? <CsvViewer content={csv} className="max-h-128" /> : null}
    </div>
  );
}
